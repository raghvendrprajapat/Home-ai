"""SIGKILL only task-owned Chromium groups/profiles; not Android REL-002."""
import json
import os
import pathlib
import signal
import subprocess
import tempfile
import time
from playwright.sync_api import sync_playwright, expect

profile = pathlib.Path(tempfile.mkdtemp(prefix='gharplan-owned-crash-profile-'))
evidence = {'browserCycles': [], 'profile': str(profile), 'limitations': ['Linux Chromium process-death evidence, not Android/WebView', 'Three diagnostic cycles, not the required physical 100-cycle gate', 'During-write window uses a test-only binding and 300ms handler stall; old or new atomic state is accepted']}
process = None
def launch(p):
    global process
    active = profile/'DevToolsActivePort'
    if active.exists(): active.unlink()
    process = subprocess.Popen(['/usr/bin/chromium', '--headless', '--no-sandbox', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', '--user-data-dir='+str(profile), 'about:blank'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    until = time.monotonic()+15
    while not active.exists():
        if process.poll() is not None: raise RuntimeError('Task-owned Chromium failed to start')
        if time.monotonic()>until: raise RuntimeError('Task-owned debugging port did not become ready')
        time.sleep(.05)
    port = int(active.read_text().splitlines()[0])
    browser = p.chromium.connect_over_cdp('http://127.0.0.1:'+str(port))
    page = browser.contexts[0].pages[0]
    page.goto('http://127.0.0.1:4173/', wait_until='networkidle')
    if page.get_by_role('heading', name='Restore your drawing', exact=True).count(): page.get_by_role('button', name='Restore saved changes', exact=True).click()
    if page.get_by_role('button', name='Skip welcome', exact=True).count(): page.get_by_role('button', name='Skip welcome', exact=True).click()
    expect(page.get_by_test_id('plan-canvas')).to_be_visible(timeout=15000)
    page.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'",timeout=15000)
    return browser, page
def kill_owned():
    if process is not None and process.poll() is None:
        os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=10)
def edit(page,x):
    page.get_by_label('Corner X coordinate',exact=True).fill(str(x)); page.get_by_role('button',name='Apply coordinates',exact=False).click()
def snapshot(page):
    return page.evaluate('''async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('gharplan');r.onsuccess=()=>resolve(r.result)});return await new Promise(resolve=>{const tx=db.transaction(['projects','journal']),m=tx.objectStore('projects').getAll(),j=tx.objectStore('journal').getAll();tx.oncomplete=()=>{db.close();const active=m.result.find(x=>x.projectId==='@active').target;resolve({meta:m.result.find(x=>x.projectId===active),journal:j.result.filter(x=>x.projectId===active).map(x=>({seq:x.seq,hash:x.hash}))})}})}''')
with sync_playwright() as p:
    try:
        browser,page=launch(p); evidence['browser']=browser.version
        edit(page,4600); page.wait_for_function("document.querySelector('[data-testid=save-status]').dataset.phase==='saved'",timeout=15000)
        committed=snapshot(page); kill_owned()
        browser,page=launch(p); expect(page.get_by_label('Corner X coordinate',exact=True)).to_have_value('4600'); assert snapshot(page)==committed
        evidence['browserCycles'].append({'point':'after saved/transaction complete','restoredX':4600,'seq':committed['meta']['seq'],'result':'exact committed metadata/journal survived SIGKILL'})
        began=time.monotonic();edit(page,4700);kill_owned();elapsed=(time.monotonic()-began)*1000
        browser,page=launch(p); recovered=int(page.get_by_label('Corner X coordinate',exact=True).input_value()); assert recovered in (4600,4700)
        evidence['browserCycles'].append({'point':'immediate post-edit before scheduled save attempt','editToKillMs':elapsed,'restoredX':recovered,'seq':snapshot(page)['meta']['seq'],'result':'valid old/new state; recent unsaved edit may be absent'})
        prior=snapshot(page); prior_x=recovered; triggered=[]
        def at_write(source):
            triggered.append(time.monotonic());kill_owned()
        page.expose_binding('gharplanCrashAtWrite',at_write)
        page.evaluate('''()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const request=put.apply(this,args);if(this.name==='journal'){window.gharplanCrashAtWrite();const until=performance.now()+300;while(performance.now()<until){/* test-only active handler stall */}}return request}}''')
        edit(page,4800)
        try: page.wait_for_timeout(2000)
        except Exception:
            if not triggered: raise
        assert triggered,'No observed real journal-put boundary'
        browser,page=launch(p); final_x=int(page.get_by_label('Corner X coordinate',exact=True).input_value()); final=snapshot(page)
        assert final_x in (prior_x,4800)
        assert all(j['seq']<=final['meta']['seq'] for j in final['journal'])
        assert final['meta']['seq'] in (prior['meta']['seq'],prior['meta']['seq']+1)
        evidence['browserCycles'].append({'point':'real journal put / active transaction handler','restoredX':final_x,'seq':final['meta']['seq'],'result':'no dangling journal rows or invalid canonical state after SIGKILL'})
        browser.close()
    finally: kill_owned()
pathlib.Path('/tmp/gharplan-ph0-t08-crash-results.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence,indent=2))
