// Execute the real release functions in a sandbox with mocked Firestore/GitLab.
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>')));
const part=(a,b)=>{const i=js.indexOf(a),j=js.indexOf(b,i+1);assert(i>=0&&j>i);return js.slice(i,j)};
const calls=[];
const context=vm.createContext({
  console:{error:()=>{}},Date,Set,Map,JSON,Array,Number,String,
  SPRINT_STATUS_PLANNING:'planning',SPRINT_STATUS_ACTIVE:'active',SPRINT_STATUS_COMPLETED:'completed',
  sprintLifecycleStatus:'planning',sprintBaseline:null,sprintLifecycleInProgress:false,
  sprintReturnedTaskIds:[],selectedTaskIds:['a','b','c'],
  taskPool:{a:{id:'a',externalTaskUrl:'https://gitlab.example/p/-/issues/1'},b:{id:'b',externalTaskUrl:'https://gitlab.example/p/-/issues/2'},c:{id:'c'}},
  currentSprintId:'s1',sprintName:{value:'Sprint 1'},sprintGitLabIteration:{id:3,title:'Sprint 1'},
  TEAM_CALCULATOR_WORKSPACE_ID:'main',
  taskTotalEstimate:t=>t.plan||0,taskEffectiveActualTotal:(id,t)=>t.actual||0,
  gitLabEnqueueJobPrefix:()=> 'metadata',gitLabDirectJobRequester:()=>({requestedByUid:'user'}),gitLabConfiguredStatusLabels:()=>['Open'],
  configuredTeamCalculatorGitLabSync:()=>({endpoint:'https://example.com/gitlab-sync'}),
  normalizeTask:x=>x,normalizeSprintGitLabIteration:x=>x,
  guardSharedSprintEdit:()=>true,renderSprintTasks:()=>{},alert:()=>{},setSprintGitLabSyncStatus:()=>{},
  saveSprintSet:async()=>{calls.push('save');return true},
  enqueueGitLabJob:async x=>{calls.push(x);return {jobId:'test'}},
  sprintTaskDirectionFilter:{value:'all'},sprintTaskStatusFilter:{value:'all'},sprintTaskAssigneeFilter:{value:'all'},
  sprintTaskIterationFilter:{value:'all'},sprintTaskScopeFilter:{value:'all'}
});
vm.runInContext([
  part('function sprintLifecycleIsCompleted(){','function activeSprintTaskIdsFromState('),
  part('function baselineTaskIds(){','function baselineTotalEstimate(){'),
  part('function buildDirectGitLabJob({','function validateExistingDirectGitLabJob('),
  part('function taskHasGitLabLink(task){','function configuredTeamCalculatorGitLabSync(){'),
  part('function sprintTaskMatchesFilters(item){','function sprintAnalyticsTaskItems(){'),
  part('async function addTaskToSprint(taskId){','async function removeTaskFromSprint(taskId){')
].join('\n'),context);
const run=s=>vm.runInContext(s,context);
const plain=x=>JSON.parse(JSON.stringify(x));
(async()=>{
  assert.equal(run('sprintTaskScope("b")'),'planned');
  assert.equal(run('isUnexpectedSprintTask("b")'),false);
  context.sprintLifecycleStatus='active';
  assert.equal(run('sprintTaskScope("b")'),'unknown');
  assert.equal(run('isUnexpectedSprintTask("b")'),false);
  context.sprintBaseline={selectedTaskIds:['a']};
  assert.equal(run('isUnexpectedSprintTask("a")'),false);
  assert.equal(run('isUnexpectedSprintTask("b")'),true);
  assert.equal(run('isUnexpectedSprintTask("c")'),true);
  assert.equal(run('isUnexpectedSprintTask("not-member")'),false);
  // GitLab metadata never determines whether a task was added after the start.
  context.taskPool.a.gitlab={labels:['Unexpected']};
  assert.equal(run('isUnexpectedSprintTask("a")'),false);
  assert.equal(run('gitLabUnexpectedLabelPresent({labels:["Unexpected"]})'),true);
  assert.equal(run('gitLabUnexpectedLabelPresent({labels:["unexpected"]})'),false);
  context.sprintTaskScopeFilter.value='unexpected';
  assert.equal(run('sprintTaskMatchesFilters({id:"a"})'),false);
  assert.equal(run('sprintTaskMatchesFilters({id:"b"})'),true);
  context.sprintTaskScopeFilter.value='planned';
  assert.equal(run('sprintTaskMatchesFilters({id:"a"})'),true);
  assert.equal(run('sprintTaskMatchesFilters({id:"b"})'),false);
  context.sprintReturnedTaskIds=['c'];
  const stats='unexpectedSprintStats([{id:"a",task:{plan:10,actual:5}},{id:"b",task:{plan:4,actual:2}},{id:"c",task:{plan:3,actual:1}}],new Set())';
  assert.deepEqual(plain(run(stats)),{count:2,currentCount:1,plan:4,actual:3});
  // On completion, historical plan includes all participants, as in 23.4.61.
  context.sprintLifecycleStatus='completed';
  assert.deepEqual(plain(run(stats)),{count:2,currentCount:1,plan:7,actual:3});
  assert.equal(await run('requestUnexpectedGitLabLabel("b")'),false);
  assert.equal(calls.length,0);
  context.sprintLifecycleStatus='active';
  assert.equal(await run('requestUnexpectedGitLabLabel("a")'),false);
  assert.equal(await run('requestUnexpectedGitLabLabel("c")'),false);
  assert.equal(calls.length,0);
  // Queue only after save, and only for a late, active GitLab-linked task.
  assert.equal(await run('requestUnexpectedGitLabLabel("b")'),true);
  assert.equal(calls[0],'save');
  const req=calls[1];
  assert.deepEqual(plain(req.payload.iterationMutation),{mode:'set',iterationId:3,iterationTitle:'Sprint 1',addLabels:['Unexpected']});
  const makeJob=payload=>context.buildDirectGitLabJob({endpoint:'https://example.com/gitlab-sync',payload,clientRequestId:'req',jobId:'metadata_test'});
  assert.deepEqual(plain(makeJob(req.payload).iterationMutation.addLabels),['Unexpected']);
  // No new label in the ordinary set/clear flows or regular metadata refresh.
  await run('enqueueTaskGitLabIterationMutation(taskPool.a,"set")');
  assert.equal(calls.at(-1).payload.iterationMutation.addLabels,undefined);
  await run('enqueueTaskGitLabIterationMutation(taskPool.b,"clear",{addUnexpected:true})');
  assert.equal(calls.at(-1).payload.iterationMutation.addLabels,undefined);
  const {iterationMutation,...metadataPayload}=req.payload;
  assert.equal(makeJob(metadataPayload).iterationMutation,undefined);
  assert.equal(makeJob({...req.payload,sprintLifecycleStatus:'planning'}).iterationMutation.addLabels,undefined);
  assert.equal(makeJob({...req.payload,iterationMutation:{...iterationMutation,addLabels:['other']}}).iterationMutation.addLabels,undefined);
  assert.equal(makeJob({...req.payload,tasks:[...req.payload.tasks,...req.payload.tasks]}).iterationMutation.addLabels,undefined);
  calls.length=0;context.saveSprintSet=async()=>false;
  assert.equal(await run('requestUnexpectedGitLabLabel("b")'),false);
  assert.equal(calls.length,0);
  // Moving to a new sprint resets the sprint-local classification, not GitLab labels.
  context.sprintLifecycleStatus='planning';context.sprintBaseline=null;
  assert.equal(run('isUnexpectedSprintTask("b")'),false);
  // Exercise the actual Team Calculator add action, not just the helper.
  Object.assign(context,{sprintTaskSnapshots:{a:context.taskPool.a},completedTaskIds:[],selectedTaskIds:['a'],sprintReturnedTaskIds:[],
    sprintLifecycleStatus:'active',sprintBaseline:{selectedTaskIds:['a']},
    saveSprintSet:async()=>{calls.push('save');return true},
    isTaskReady:()=>true,confirm:()=>true,pushSprintRecoverySnapshot:()=>{},taskCarryoverInfo:()=>null,
    recalculateRolePlanFact:()=>{},saveState:()=>{},render:()=>{},saveTaskPlanningFields:async()=>{},
    sprintGitLabIterationSelect:{focus:()=>{}}});
  calls.length=0;
  await run('addTaskToSprint("b")');
  assert.equal(run('isUnexpectedSprintTask("b")'),true);
  assert.deepEqual(plain(calls[1].payload.iterationMutation.addLabels),['Unexpected']);
  calls.length=0;
  await run('addTaskToSprint("b")');
  assert.equal(calls.length,0); // duplicate click
  await run('addTaskToSprint("c")');
  assert.equal(run('isUnexpectedSprintTask("c")'),true);
  assert.equal(calls.length,0); // no GitLab URL
  context.selectedTaskIds=['a'];context.sprintReturnedTaskIds=['a'];
  await run('addTaskToSprint("a")');
  assert.equal(run('isUnexpectedSprintTask("a")'),false);
  assert.equal(calls.at(-1).payload.iterationMutation.addLabels,undefined);
  context.sprintLifecycleStatus='planning';context.sprintBaseline=null;
  calls.length=0;
  await run('addTaskToSprint("b")');
  assert.equal(calls.at(-1).payload.iterationMutation.addLabels,undefined);
  console.log('PASS: sprint scope, filter, historical plan/fact, actual add handler, GitLab label job, save-before-send, exclusions and retry');
})().catch(e=>{console.error(e);process.exit(1)});
