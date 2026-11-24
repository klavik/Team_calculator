from playwright.sync_api import sync_playwright
from pathlib import Path
import os
p=Path(__file__).resolve().parent.parent
s=(p/'index.html').read_text().replace('\nboot();\n','\n/* Offline browser test: skip Firebase initialization. */\n')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH') or None,headless=True,args=['--no-sandbox'])
 page=b.new_page(); errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/*',lambda r:r.abort())
 page.set_content(s,wait_until='domcontentloaded')
 page.evaluate('''() => {
   currentSprintId='s1'; sprintLifecycleStatus='active'; sprintStartedAt=new Date().toISOString();
   sprintBaseline={selectedTaskIds:['a'],taskSnapshots:{a:{id:'a',title:'Planned',estimates:{backend:3}}}};
   selectedTaskIds=['a','b','c'];completedTaskIds=[];sprintReturnedTaskIds=['c'];
   taskPool={a:{id:'a',title:'Planned',estimates:{backend:3},externalTaskUrl:'https://example.test/p/-/issues/1',gitlab:{labels:['unexpected']}},b:{id:'b',title:'Late',estimates:{backend:2},externalTaskUrl:'https://example.test/p/-/issues/2'},c:{id:'c',title:'Returned late',estimates:{backend:1}}};
   sprintTaskSnapshots=JSON.parse(JSON.stringify(taskPool));
   renderSprintTasks();
 }''')
 assert page.locator('#sprintTasksBody tr[data-sprint-task-id]').count()==2
 assert page.locator('tr[data-sprint-task-id=b] .sprint-unexpected-pill').count()==1
 assert page.locator('tr[data-sprint-task-id=a] .sprint-unexpected-pill').count()==0
 assert '2' in page.locator('.sprint-summary-pill.unexpected').inner_text()
 assert page.locator('[data-retry-unexpected=b]').count()==1
 page.locator('#sprintTaskScopeFilter').select_option('unexpected',force=True)
 assert page.locator('#sprintTasksBody tr[data-sprint-task-id]').count()==1
 assert page.locator('tr[data-sprint-task-id=b]').count()==1
 page.evaluate('''() => {document.getElementById('resetSprintTaskFilters').click();}''')
 assert page.locator('#sprintTasksBody tr[data-sprint-task-id]').count()==2
 page.evaluate('''() => {taskPool.b.gitlab={labels:['unexpected']};renderSprintTasks();}''')
 assert page.locator('tr[data-sprint-task-id=b] .unexpected-gitlab-note.confirmed').count()==1
 assert page.locator('[data-retry-unexpected=b]').count()==0
 page.evaluate('''() => {sprintLifecycleStatus='completed';renderSprintTasks();}''')
 assert page.locator('#sprintTasksBody tr[data-sprint-task-id]').count()==3
 assert page.locator('tr[data-sprint-task-id=c] .sprint-unexpected-pill').count()==1
 assert not errors,errors
 print('PASS: offline Chromium render, badge, scope filter, reset, confirmed GitLab label, completed sprint history')
 b.close()
