const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const functions=html.slice(html.indexOf('function markCloudSavePending(){'),html.indexOf('async function loadSprintSet('));
const saveState=html.slice(html.indexOf('function saveState(){'),html.indexOf('function loadState(){'));
const hooks=html.slice(html.indexOf('document.addEventListener("visibilitychange"'),html.indexOf('document.getElementById("resetDefaults").onclick'));
const calls=[],handlers={},timers=new Map(); let id=0;
const c=vm.createContext({console:{warn:()=>{}},Error,Math,
  cloudSavePending:false,cloudSaveRevision:0,cloudSaveInProgress:false,cloudSaveRetryDelay:5000,
  SPRINT_AUTOSAVE_DELAY:1000,CLOUD_SAVE_MAX_RETRY_DELAY:60000,
  sprintSaveInProgress:false,sprintLifecycleInProgress:false,currentStateSaveInProgress:false,
  unsavedSprintFailure:false,appLoaded:true,currentUser:{uid:'a'},firebaseDb:{},isHydrating:false,
  sprintAutoSaveTimer:null,saveTimer:null,sprintName:{value:'Sprint'},currentSprintId:'s1',
  getSavedSprints:()=>({s1:{id:'s1'}}),sprintEditingBlocked:()=>false,taskRouteBrowseOnly:()=>false,
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id},clearTimeout:n=>timers.delete(n),
  setSyncState:(message,tone)=>{c.status={message,tone}},
  saveSprintSet:async()=>{calls.push('sprint');return true},
  saveCurrentStateNow:async()=>{calls.push('state');return true},
  document:{visibilityState:'visible',addEventListener:(name,fn)=>handlers[name]=fn},
  window:{addEventListener:(name,fn)=>handlers[name]=fn}
});
vm.runInContext(functions+saveState+hooks,c);
const run=()=>c.runSprintAutoSave();
const leave=()=>{let prevented=false;handlers.beforeunload({preventDefault:()=>{prevented=true}});return prevented};
(async()=>{
  assert.equal(leave(),false,'No warning on a clean page');
  c.saveState();assert.equal(c.cloudSavePending,true);assert.equal(leave(),true);
  assert.equal(timers.get(c.sprintAutoSaveTimer).delay,1000);
  c.saveState();assert.equal(timers.size,1,'debounce');
  assert.equal(await run(),true);assert.deepEqual(calls,['sprint','state']);assert.equal(leave(),false);
  assert.equal(c.status.message,'Автосохранено в Firestore');
  calls.length=0;c.saveSprintSet=async()=>{calls.push('sprint');return false};c.saveState();
  assert.equal(await run(),false);assert.deepEqual(calls,['sprint'],'secondary state cannot replace failed sprint save');
  assert.equal(leave(),true);assert.equal(c.status.tone,'bad');assert.equal(timers.get(c.sprintAutoSaveTimer).delay,5000);
  assert.equal(await c.flushBeforeNavigation(),false,'do not abandon pending edits');
  c.saveSprintSet=async()=>{calls.push('sprint');return true};calls.length=0;
  handlers.online();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,['sprint','state']);assert.equal(c.cloudSavePending,false);assert.equal(leave(),false);
  c.saveCurrentStateNow=async()=>false;c.saveState();assert.equal(await run(),false);assert.equal(leave(),true);
  c.saveCurrentStateNow=async()=>true;assert.equal(await c.flushBeforeNavigation(),true);assert.equal(leave(),false);
  let resolveSave; c.saveSprintSet=()=>new Promise(resolve=>{resolveSave=resolve});c.saveState();const inFlight=run();
  c.saveState();resolveSave(true);assert.equal(await inFlight,false);assert.equal(c.cloudSavePending,true,'newer edit cannot be acknowledged by earlier save');
  c.saveSprintSet=async()=>true;assert.equal(await run(),true);
  c.sprintName.value='';c.saveSprintSet=async()=>{throw Error('Must not create unnamed sprint')};c.saveState();assert.equal(await run(),true);
  c.appLoaded=false;c.saveState();assert.equal(c.cloudSavePending,false,'startup hydration is not an edit');
  assert.ok(!html.includes('Есть несохранённая локальная копия плана'));
  assert.ok(!html.includes('indexedDB.open("teamCalculatorEmergencyDrafts"'));
  console.log('PASS: cloud autosave, debounce, server-first commit, retry, new edits during commit, unload guard, navigation guard, no IndexedDB recovery');
})().catch(e=>{console.error(e);process.exit(1)});
