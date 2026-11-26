from pathlib import Path
import os
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text().replace('\nboot();\n','\n/* Offline race test */\n')
with sync_playwright() as w:
    browser=w.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox'])
    p=browser.new_page(); errors=[]; dialogs=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
    p.route('**/*',lambda r:r.abort())
    p.set_content(html,wait_until='domcontentloaded')
    result=p.evaluate('''async () => {
      currentUser={uid:'alice',email:'alice@example.test'};currentProfile={role:'admin',alias:'Alice'};
      firebaseDb={};appLoaded=true;currentSprintId='s1';sprintName.value='Sprint';
      sprintLifecycleStatus='active';sprintStartedAt='2026-11-25T10:00:00Z';
      sprintGitLabIteration={id:3,title:'Sprint'};
      selectedTaskIds=['a'];completedTaskIds=[];sprintReturnedTaskIds=[];
      taskPool=Object.fromEntries(['a','b','c','d'].map((id,i)=>[id,{id,title:id,estimates:{backend:2},externalTaskUrl:`https://example.test/p/-/issues/${i+1}`} ]));
      taskPool.a.plannedSprintId='s1';sprintTaskSnapshots={a:JSON.parse(JSON.stringify(taskPool.a))};
      sprintBaseline={selectedTaskIds:['a'],taskSnapshots:sprintTaskSnapshots};
      sprintTaskActuals={};
      setSavedSprints({s1:{id:'s1',name:'Sprint',createdByUid:'alice',input:{selectedTaskIds:['a'],sprintLifecycleStatus:'active',sprintBaseline:{selectedTaskIds:['a']}},result:{}}});
      setSprintUrl=()=>{};window.confirm=()=>true;
      // Actual saveSprintSet/addTaskToSprint/requestUnexpectedGitLabLabel.
      // Only external writes and secondary navigation copy are mocked.
      saveCurrentStateNow=async()=>true;
      stageSprintStorage=async(_fs,saved)=>({...JSON.parse(JSON.stringify(saved)),payloadRef:{revision:'mock'}});
      cleanupObsoletePayloadChunks=()=>{};
      let releaseFirst, startedFirst, fail=false, commits=0, standalone=0;
      const firstStarted=new Promise(r=>startedFirst=r);
      const firstGate=new Promise(r=>releaseFirst=r);
      const docs=new Map();const jobs=[];
      const fsMod={doc:(_db,...parts)=>parts.join('/'),writeBatch:()=>{
        const writes=[];return {set:(path,data,opts)=>writes.push([path,JSON.parse(JSON.stringify(data)),opts]),commit:async()=>{
          commits++;if(commits===1){startedFirst();await firstGate;}
          if(fail)throw Error('simulated permission-denied');
          for(const [path,data,opts] of writes)docs.set(path,opts?.merge?{...docs.get(path),...data}:data);
        }};
      }};
      loadFirebaseModules=async()=>({fsMod});
      saveTaskPlanningFields=async()=>{standalone++;};
      configuredTeamCalculatorGitLabSync=()=>({endpoint:'https://example.test/gitlab-sync'});
      enqueueGitLabJob=async({payload})=>{
        const id=payload.tasks[0].taskId;
        const stored=docs.get('workspaces/main/sprints/s1');
        if(!stored?.input.selectedTaskIds.includes(id))throw Error('job before confirmed parent');
        if(docs.get('workspaces/main/taskPool/'+id)?.plannedSprintId!=='s1')throw Error('job before confirmed pool link');
        if(payload.iterationMutation.addLabels.join()!=='Unexpected')throw Error('bad label');
        jobs.push(id);return {jobId:id};
      };
      markCloudSavePending();const initial=runSprintAutoSave();await firstStarted;
      const addB=addTaskToSprint('b');const addC=addTaskToSprint('c');
      await Promise.resolve();
      const before={jobs:jobs.length,commits,waiting:unexpectedGitLabRequests.size};
      releaseFirst();await Promise.all([initial,addB,addC]);
      clearTimeout(sprintAutoSaveTimer);clearTimeout(saveTimer);
      const after={jobs:[...jobs].sort(),commits,standalone,selected:docs.get('workspaces/main/sprints/s1').input.selectedTaskIds};
      // Real commit failure: no job, non-modal error and explicit retry.
      fail=true;await addTaskToSprint('d');clearTimeout(sprintAutoSaveTimer);
      const failed={jobs:[...jobs].sort(),pending:cloudSavePending,stillInSprint:selectedTaskIds.includes('d'),retry:!!document.querySelector('[data-retry-unexpected=d]'),message:sprintGitLabSyncStatus.textContent};
      fail=false;const retried=await requestUnexpectedGitLabLabel('d');clearTimeout(sprintAutoSaveTimer);clearTimeout(saveTimer);
      return {before,after,failed,retried,finalJobs:jobs.sort()};
    }''')
    assert result['before']=={'jobs':0,'commits':1,'waiting':2},result
    assert result['after']['jobs']==['b','c'] and result['after']['standalone']==0,result
    assert result['after']['selected']==['a','b','c'],result
    assert result['failed']['jobs']==['b','c'] and result['failed']['pending'] and result['failed']['stillInSprint'] and result['failed']['retry'],result
    assert 'Не удалось отправить Unexpected' in result['failed']['message'],result
    assert result['retried'] and result['finalJobs']==['b','c','d'],result
    assert not errors,errors
    assert not dialogs,dialogs
    print('PASS: real browser save-lock race, two late tasks, atomic parent/pool before job, failed commit with no modal, retry')
    browser.close()
