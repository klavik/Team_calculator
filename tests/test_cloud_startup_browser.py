from playwright.sync_api import sync_playwright
from pathlib import Path
import os
root=Path(__file__).resolve().parent.parent
html=(root/'index.html').read_text().replace('\nboot();\n','\n/* Offline startup test */\n')
with sync_playwright() as w:
    b=w.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox'])
    p=b.new_page(); errors=[]; dialogs=[]
    p.on('pageerror',lambda e:errors.append(str(e)))
    p.on('dialog',lambda d:(dialogs.append(d.message),d.dismiss()))
    p.route('**/*',lambda r:r.abort())
    p.set_content(html,wait_until='domcontentloaded')
    result=p.evaluate('''async () => {
      // A legacy recovery provider must never be consulted, even if newer.
      let recoveryReads=0;
      window.getEmergencyDraft=async()=>{recoveryReads++;return {savedAt:'2099-01-01T00:00:00Z',state:{sprintName:'Wrong local copy',selectedTaskIds:['local']}}};
      setSprintUrl=()=>{};
      currentUser={uid:'alice',email:'alice@example.test'};firebaseDb={};
      const base=getCurrentInputState();
      const personal={...base,currentSprintId:'s1',sprintName:'Stale personal state',selectedTaskIds:['old'],taskPoolSort:{key:'title',direction:'desc'},taskPoolSortVersion:TASK_POOL_SORT_VERSION};
      const saved={id:'s1',name:'Firestore sprint',createdByUid:'alice',input:{...base,currentSprintId:'s1',sprintName:'Firestore sprint',selectedTaskIds:[],sprintLifecycleStatus:'planning'},result:{}};
      const snap=data=>({exists:()=>data!=null,data:()=>data});
      const fsMod={doc:(_db,...a)=>a.join('/'),collection:(_db,...a)=>a.join('/'),
        getDoc:async path=>snap(path==='users/alice'?{active:true,role:'admin',alias:'Alice'}:null),
        getDocFromServer:async path=>{if(path!=='users/alice/app/main')throw Error(path);return snap({currentState:personal,result:{},updatedAt:'2026-11-25T00:00:00Z'})},
        getDocsFromServer:async path=>{if(!path.endsWith('/sprints'))throw Error(path);return {docs:[{id:'s1',data:()=>saved}]}},
        getDocs:async()=>({docs:[],forEach:()=>{}})};
      loadFirebaseModules=async()=>({fsMod,authMod:{signOut:async()=>{throw Error('unexpected signout')}}});
      migrateOwnLegacySprints=async()=>({copied:0,failed:0});
      startTaskPoolRealtime=async()=>{};startSharedSprintsRealtime=async()=>{};
      await loadUserWorkspace();
      return {name:sprintName.value,id:currentSprintId,ids:selectedTaskIds,pending:cloudSavePending,loaded:appLoaded,sort:taskPoolSort.direction,recoveryReads};
    }''')
    assert result=={'name':'Firestore sprint','id':'s1','ids':[],'pending':False,'loaded':True,'sort':'desc','recoveryReads':0},result
    assert not dialogs,dialogs
    assert not errors,errors
    print('PASS: Chromium startup loads shared Firestore sprint over stale personal snapshot and newer simulated local draft; no dialog, no startup autosave')
    b.close()
