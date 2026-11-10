const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));
const storage=js.slice(js.indexOf('function safePayloadChunks('),js.indexOf('function openEmergencyDraftDb(){'));
const saveFn=js.slice(js.indexOf('async function saveSprintSet('),js.indexOf('function scheduleSprintAutoSave(){'));
const startFn=js.slice(js.indexOf('async function startSprintLifecycle(){'),js.indexOf('async function completeSprintLifecycle(){'));
const completeFn=js.slice(js.indexOf('async function completeSprintLifecycle(){'),js.indexOf('async function handleSprintLifecycleAction(){'));
const currentFn=js.slice(js.indexOf('async function saveCurrentStateNow(){'),js.indexOf('function updateAccountUi(){'));
const hash=js.slice(js.indexOf('function hashString('),js.indexOf('function taskDocumentId('));
let docs=new Map(); let failParentCommit=false; let failChunkCommit=false; let failAppCommit=false; let batchCount=0;
let parentCommitAttempts=0; let failParentOnAttempt=null;
const fakeFS={
  collection:(...a)=>({path:a.slice(1).join('/')}),
  doc:(...a)=>({path:a[0]?.path?a[0].path+'/'+a[1]:a.slice(1).join('/')}),
  getDoc:async r=>({exists:()=>docs.has(r.path),data:()=>docs.get(r.path)}),
  getDocFromServer:async r=>({exists:()=>docs.has(r.path),data:()=>docs.get(r.path)}),
  getDocs:async r=>({docs:[...docs.entries()].filter(([key])=>key.startsWith(r.path+'/')).map(([key,data])=>({ref:{path:key},id:key.split('/').at(-1),data:()=>data}))}),
  writeBatch:()=>{
    let changes=[];
    return {
      set:(ref,value,opts)=>changes.push({type:'set',ref,value,opts}),
      delete:ref=>changes.push({type:'delete',ref}),
      commit:async()=>{
        batchCount++;
        const containsParent=changes.some(x=>x.ref.path.match(/\/sprints\/sp_[^/]+$/));
        if(containsParent)parentCommitAttempts++;
        if((containsParent&&(failParentCommit||parentCommitAttempts===failParentOnAttempt))||(!containsParent&&failChunkCommit))throw Error('simulated Firestore failure');
        for(const c of changes){
          if(c.type==='delete')docs.delete(c.ref.path);
          else docs.set(c.ref.path,c.opts?.merge?{...docs.get(c.ref.path),...c.value}:c.value);
        }
      }
    }
  },
  setDoc:async(ref,value)=>{if(failAppCommit)throw Error('simulated user state failure');docs.set(ref.path,value);}
};
const context=vm.createContext({
  console,JSON,Date,Math,Set,Map,TextEncoder,Array,Promise,Error,
  SPRINT_PAYLOAD_CHUNK_CHARS:80000,MAX_SPRINT_DOCUMENT_BYTES:800000,
  TEAM_CALCULATOR_WORKSPACE_ID:'main',firebaseDb:{},
  currentUser:{uid:'alice',email:'alice@example.test'}, currentProfile:{alias:'Alice'},
  loadFirebaseModules:async()=>({fsMod:fakeFS}),
  saveEmergencyDraft:async()=>true,clearEmergencyDraft:async()=>true,
  saveCurrentStateNow:async()=>true,
  renderSavedSprints:()=>{},renderSprintLifecycle:()=>{},updateActiveSprintHeader:()=>{},setSprintUrl:()=>{},
  setSyncState:t=>{context.lastSyncMessage=t},
  alert:t=>{context.lastAlert=t},
  taskPool:{t1:{id:'t1',title:'Test task'}},
  sprintTaskSnapshots:{t1:{id:'t1',title:'Test task'}},
  selectedTaskIds:['t1'],completedTaskIds:[],sprintTaskActuals:{},
  currentSprintId:null,sprintSaveInProgress:false,sprintAutoSaveQueued:false,
  sprintAutoSaveTimer:null, sprintFingerprints:new Map(),sprintPayloadCache:new Map(),
  getSavedSprints:()=>context.savedSprintSets,setSavedSprints:data=>{context.savedSprintSets=data},savedSprintSets:{},
  makeSprintId:()=> 'sp_123456_mock',
  sprintName:{value:'Sprint Test'},
  sprintLifecycleStatus:'planning',sprintStartedAt:null,sprintCompletedAt:null,sprintBaseline:null,sprintReturnedTaskIds:[],
  getSprintInputState:()=>({selectedTaskIds:context.selectedTaskIds,completedTaskIds:context.completedTaskIds,
    sprintTaskSnapshots:context.sprintTaskSnapshots,sprintTaskActuals:context.sprintTaskActuals,
    sprintLifecycleStatus:context.sprintLifecycleStatus,sprintBaseline:context.sprintBaseline,
    sprintStartedAt:context.sprintStartedAt,sprintCompletedAt:context.sprintCompletedAt,
    sprintReturnedTaskIds:context.sprintReturnedTaskIds}),
  getCurrentInputState:()=>({selectedTaskIds:[...context.selectedTaskIds],completedTaskIds:[],
    sprintTaskSnapshots:context.sprintTaskSnapshots,sprintTaskActuals:context.sprintTaskActuals,
    sprintLifecycleStatus:context.sprintLifecycleStatus,sprintBaseline:context.sprintBaseline,
    sprintStartedAt:context.sprintStartedAt,sprintCompletedAt:context.sprintCompletedAt,
    sprintReturnedTaskIds:context.sprintReturnedTaskIds,sprintName:context.sprintName.value,
    currentSprintId:context.currentSprintId}),
  getCurrentResultSnapshot:()=>({taskSnapshots:context.sprintTaskSnapshots,taskCount:context.selectedTaskIds.length}),
  activeSprintTaskIds:()=>context.selectedTaskIds,
  recalculateRolePlanFact:()=>{},taskCarryoverInfo:()=>null,normalizeTask:x=>x,
  sharedSprintIsReadOnly:()=>false,guardSharedSprintEdit:()=>true,
  canEditSharedSprint:()=>true,
  getCurrentInputStateDummy:()=>{},
  sprintPayloadFingerprint:(name,input,result)=>JSON.stringify({name,input,result}),
  setTimeout,clearTimeout,
  savedSprintSelect:{value:''},
  captureSprintBaseline:()=>({taskSnapshots:context.sprintTaskSnapshots,
    result:{taskSnapshots:context.sprintTaskSnapshots,taskCount:context.selectedTaskIds.length}}),
  pushSprintRecoverySnapshot:()=>{},
  render:()=>{},applyInputState:before=>{
    context.sprintLifecycleStatus=before.sprintLifecycleStatus;
    context.sprintBaseline=before.sprintBaseline;
    context.sprintStartedAt=before.sprintStartedAt;
    context.currentSprintId=before.currentSprintId;
    context.selectedTaskIds=before.selectedTaskIds;
    context.sprintReturnedTaskIds=before.sprintReturnedTaskIds;
    context.sprintCompletedAt=before.sprintCompletedAt;
  },
  confirm:()=>true,
  sprintLifecycleInProgress:false,sprintLifecycleCommitConfirmed:false,unsavedSprintFailure:false,
  saveTimer:null,currentStateSaveQueued:false,
  SPRINT_STATUS_ACTIVE:'active',SPRINT_STATUS_PLANNING:'planning',SPRINT_STATUS_COMPLETED:'completed',
  sprintEditingBlocked:()=>false,normalizeSprintLifecycleStatus:s=>s||'planning',
  sharedSprintDocument:(fsMod,id)=>({path:'workspaces/main/sprints/'+id}),
  stateFingerprint:x=>JSON.stringify(x),currentStatePayload:()=>({currentState:context.getCurrentInputState(),result:context.getCurrentResultSnapshot()}),
  lastCurrentStateFingerprint:'dummy',lastCurrentStatePayloadRef:null,
  currentStateSaveInProgress:false,currentStateSaveQueued:false,isHydrating:false,
  buildTaskCarryover:()=>({fromSprintId:'previous',pending:true}),
});
vm.runInContext(hash+storage+saveFn+startFn+completeFn+currentFn,context);
(async()=>{
  const large=Object.fromEntries(Array.from({length:300},(_,i)=>[
    'task'+i,{id:'task'+i,title:'Названия задач 👩🏽‍💻 '.repeat(80),details:'Причина и описание. '.repeat(40)}
  ]));
  const item={id:'sp_bigsprint',input:{sprintTaskSnapshots:large,sprintTaskActuals:{},
    sprintBaseline:{taskSnapshots:large,result:{taskSnapshots:large,taskCount:300}},
    selectedTaskIds:Object.keys(large)},result:{taskSnapshots:large},name:'Large sprint'};
  assert.ok(new TextEncoder().encode(JSON.stringify(item)).length>1048576,'Sample should exceed Firestore hard limit');
  const st=vm.runInContext('prepareSprintForStorage',context)(item);
  assert.ok(new TextEncoder().encode(JSON.stringify(st.compact)).length<800000);
  assert.ok(!Object.hasOwn(st.compact.input.sprintBaseline.result,'taskSnapshots'),
    'nested baseline.result.taskSnapshots must NOT remain in the Firestore parent');
  const pieces=vm.runInContext('safePayloadChunks',context)(st.serialized);
  assert.ok(pieces.length>1);
  assert.ok(pieces.every(x=>new TextEncoder().encode(JSON.stringify({data:x})).length<250000));
  const staged=await vm.runInContext('stageSprintStorage',context)(fakeFS,item,null);
  docs.set('workspaces/main/sprints/sp_bigsprint',staged);
  const hydrated=await vm.runInContext('hydrateSprintDocument',context)(fakeFS,staged);
  assert.equal(JSON.stringify(hydrated.input.sprintTaskSnapshots),JSON.stringify(large));
  assert.equal(JSON.stringify(hydrated.result.taskSnapshots),JSON.stringify(large));
  assert.equal(JSON.stringify(hydrated.input.sprintBaseline.taskSnapshots),JSON.stringify(large));
  assert.equal(JSON.stringify(hydrated.input.sprintBaseline.result.taskSnapshots),JSON.stringify(large));
  // Unicode surrogate near boundary of a UTF-16 chunk must round-trip.
  const emoji='A'.repeat(79999)+'🔥'+'К'.repeat(90000);
  assert.equal(vm.runInContext('safePayloadChunks',context)(emoji).join(''),emoji);
  // Corrupted/incomplete chunks are never accepted silently.
  const badRef={...staged.payloadRef};
  docs.delete('workspaces/main/sprints/sp_bigsprint/payloadChunks/'+badRef.revision+'_1');
  let refused=false;
  try{await vm.runInContext('readVersionedPayload',context)(fakeFS,{path:'workspaces/main/sprints/sp_bigsprint/payloadChunks'},badRef)}
  catch(e){refused=true}
  assert.ok(refused);

  // All-or-nothing: if final parent+pool batch fails, no parent published,
  // no taskPool link changed and no currentSprintId is adopted.
  failParentCommit=true;
  assert.equal(await vm.runInContext('saveSprintSet',context)(false,{silent:true}),false);
  assert.equal(context.currentSprintId,null);
  assert.equal(context.taskPool.t1.plannedSprintId,undefined);
  assert.ok(!docs.has('workspaces/main/sprints/sp_123456_mock'));
  failParentCommit=false;
  assert.equal(await vm.runInContext('saveSprintSet',context)(false,{silent:true}),true);
  assert.equal(context.currentSprintId,'sp_123456_mock');
  assert.equal(context.taskPool.t1.plannedSprintId,'sp_123456_mock');
  assert.ok(docs.get('workspaces/main/sprints/sp_123456_mock').payloadRef.revision);

  // Failed start leaves planning state and task selection intact.
  context.currentSprintId=null;context.savedSprintSets={};context.sprintFingerprints.clear();
  context.sprintLifecycleStatus='planning';context.sprintBaseline=null;
  failParentCommit=true;
  await vm.runInContext('startSprintLifecycle',context)();
  assert.equal(context.sprintLifecycleStatus,'planning');
  assert.equal(context.currentSprintId,null);
  assert.deepEqual(context.selectedTaskIds,['t1']);
  assert.equal(context.sprintLifecycleInProgress,false);


  // The real incident: a full plan ALREADY EXISTS in Firestore as planning.
  // Starting it used to duplicate snapshots under baseline.result.taskSnapshots
  // and exceed 1MiB; a failed start MUST NOT create/clear another sprint.
  failParentCommit=false;
  const existingId='sp_123456_mock';
  const existingPath='workspaces/main/sprints/'+existingId;
  context.currentSprintId=existingId;
  context.sprintLifecycleStatus='planning';
  context.sprintStartedAt=null;
  context.sprintBaseline=null;
  context.sprintReturnedTaskIds=[];
  context.selectedTaskIds=['t1'];
  context.sprintTaskSnapshots={t1:{id:'t1',title:'Test task'}};
  context.savedSprintSets={
    [existingId]:{id:existingId,name:'Sprint Test',createdByUid:'alice',
      input:{selectedTaskIds:['t1'],completedTaskIds:[],sprintLifecycleStatus:'planning',
        sprintTaskSnapshots:context.sprintTaskSnapshots,sprintTaskActuals:{}},
      result:{taskSnapshots:context.sprintTaskSnapshots}}
  };
  // Simulate a legacy v23.4.60 planning document (no payloadRef).
  docs.set(existingPath,JSON.parse(JSON.stringify(context.savedSprintSets[existingId])));
  const oldPlanning=JSON.stringify(docs.get(existingPath).input.selectedTaskIds);
  const startTaskIds=JSON.stringify(context.selectedTaskIds);
  failParentOnAttempt=parentCommitAttempts+2; // preparation succeeds, start fails
  await vm.runInContext('startSprintLifecycle',context)();
  assert.equal(context.currentSprintId,existingId,'existing sprint ID must remain');
  assert.equal(context.sprintLifecycleStatus,'planning');
  assert.equal(docs.get(existingPath).input.sprintLifecycleStatus,'planning');
  assert.equal(JSON.stringify(docs.get(existingPath).input.selectedTaskIds),oldPlanning);
  assert.equal(JSON.stringify(context.selectedTaskIds),startTaskIds);
  assert.equal(context.sprintBaseline,null);
  assert.equal(context.sprintLifecycleInProgress,false);
  assert.ok(docs.get(existingPath).payloadRef,'legacy planning sprint migrated safely');
  assert.equal(context.taskPool.t1.plannedSprintId,existingId);
  assert.match(context.lastAlert,/Спринт не запущен/);
  // Repeating start now succeeds, with no new sprint and no missing tasks.
  failParentOnAttempt=null;
  await vm.runInContext('startSprintLifecycle',context)();
  assert.equal(context.currentSprintId,existingId);
  assert.equal(context.sprintLifecycleStatus,'active');
  assert.equal(docs.get(existingPath).input.sprintLifecycleStatus,'active');
  assert.equal(JSON.stringify(docs.get(existingPath).input.selectedTaskIds),oldPlanning);
  assert.equal(context.taskPool.t1.plannedSprintId,existingId);
  const loadedActive=await vm.runInContext('hydrateSprintDocument',context)(fakeFS,docs.get(existingPath));
  assert.equal(loadedActive.input.sprintBaseline.result.taskSnapshots.t1.title,'Test task');
  assert.deepEqual(loadedActive.input.selectedTaskIds,['t1']);
  assert.equal(loadedActive.input.sprintStartedAt!=null,true);
  // Stale client must not be allowed to 'start' the already active server sprint.
  context.sprintLifecycleStatus='planning';context.sprintBaseline=null;
  await vm.runInContext('startSprintLifecycle',context)();
  assert.equal(docs.get(existingPath).input.sprintLifecycleStatus,'active');
  assert.equal(context.sprintLifecycleStatus,'planning');
  assert.match(context.lastAlert,/уже не в статусе/);
  // Restore active state for the next independent tests.
  context.sprintLifecycleStatus='active';

  // User current state uses the same versioned scheme, not an oversized app/main.
  context.lastCurrentStateFingerprint='dummy';
  context.sprintBaseline={taskSnapshots:context.sprintTaskSnapshots,
    result:{taskSnapshots:context.sprintTaskSnapshots}};
  context.sprintLifecycleInProgress=false;
  assert.equal(await vm.runInContext('saveCurrentStateNow',context)(),true);
  const currentStored=docs.get('users/alice/app/main');
  assert.ok(currentStored.statePayloadRef?.version===2);
  assert.ok(!Object.hasOwn(currentStored.currentState,'sprintTaskSnapshots'));
  const restored=await vm.runInContext('hydrateCurrentStateDocument',context)(fakeFS,currentStored);
  assert.equal(restored.currentState.sprintTaskSnapshots.t1.title,'Test task');
  assert.equal(restored.result.taskSnapshots.t1.title,'Test task');
  assert.equal(restored.currentState.sprintBaseline.result.taskSnapshots.t1.title,'Test task');
  assert.ok(!Object.hasOwn(currentStored.currentState.sprintBaseline.result,'taskSnapshots'));
  const prevRef=currentStored.statePayloadRef;
  failAppCommit=true;
  context.lastCurrentStateFingerprint='new-dirty-state';
  assert.equal(await vm.runInContext('saveCurrentStateNow',context)(),false);
  assert.equal(docs.get('users/alice/app/main').statePayloadRef.revision,prevRef.revision);
  failAppCommit=false;

  // Failed completion must not return tasks to pool or mark sprint completed.
  context.currentSprintId='sp_123456_mock';
  context.sprintLifecycleStatus='active';
  context.sprintStartedAt='2026-11-10T09:00:00.000Z';
  context.sprintCompletedAt=null;
  context.sprintReturnedTaskIds=[];
  context.completedTaskIds=[];
  context.sprintLifecycleInProgress=false;
  context.sprintSaveInProgress=false;
  context.savedSprintSets['sp_123456_mock']={id:'sp_123456_mock',name:'Sprint Test',
    input:{selectedTaskIds:['t1'],sprintTaskSnapshots:context.sprintTaskSnapshots,completedTaskIds:[],sprintReturnedTaskIds:[]},
    result:{taskSnapshots:context.sprintTaskSnapshots},payloadRef:docs.get('workspaces/main/sprints/sp_123456_mock').payloadRef};
  context.saveCurrentStateNow=async()=>true;
  failParentCommit=true;
  await vm.runInContext('completeSprintLifecycle',context)();
  assert.equal(context.sprintLifecycleStatus,'active');
  assert.equal(context.sprintCompletedAt,null);
  assert.deepEqual(context.sprintReturnedTaskIds,[]);
  assert.equal(context.taskPool.t1.plannedSprintId,'sp_123456_mock');
  failParentCommit=false;
  await vm.runInContext('completeSprintLifecycle',context)();
  assert.equal(context.sprintLifecycleStatus,'completed');
  assert.equal(context.taskPool.t1.plannedSprintId,null);
  assert.deepEqual(context.sprintReturnedTaskIds,['t1']);
  assert.equal(docs.get('workspaces/main/sprints/sp_123456_mock').input.sprintLifecycleStatus,'completed');

  console.log('PASS: saved planning sprint -> safe migration -> failed/successful start, nested baseline/result snapshots, >1MiB chunks, atomic lifecycle, user-state migration');
})().catch(e=>{console.error(e);process.exit(1)});
