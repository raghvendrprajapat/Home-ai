"""Real production IndexedDB/browser faults; not Android kill/device evidence."""
import json
import pathlib
import time
import jsonschema
from playwright.sync_api import sync_playwright, expect

evidence = {'checks': [], 'pageErrors': [], 'saveMilliseconds': [], 'limitations': ['Linux Chromium, not an Android WebView or phone', 'Quota failure is injected into the real transaction API', 'No physical 100-cycle kill or <=2s phone-loss guarantee']}
schema = json.loads(pathlib.Path('docs/examples/project.schema.json').read_text())
validator = jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())
def record(name): evidence['checks'].append(name)
def saved(page): page.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'", timeout=15000)
def restore_if_offered(page):
    if page.get_by_role('heading', name='Restore your drawing', exact=True).count():
        page.get_by_role('button', name='Restore saved changes', exact=True).click()
    expect(page.get_by_test_id('plan-canvas')).to_be_visible(timeout=15000)
def edit(page, x):
    page.get_by_label('Corner X coordinate', exact=True).fill(str(x))
    page.get_by_role('button', name='Apply coordinates', exact=False).click()
def export(page, filename):
    with page.expect_download() as downloaded: page.get_by_role('button', name='Export drawing', exact=True).click()
    downloaded.value.save_as(filename); data = json.loads(pathlib.Path(filename).read_text())
    assert not list(validator.iter_errors(data)); return data
def current_meta(page):
    return page.evaluate('''async () => {
      const db = await new Promise((resolve,reject) => {const r=indexedDB.open('gharplan',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      return await new Promise((resolve,reject) => { const tx=db.transaction('projects');const r=tx.objectStore('projects').getAll();tx.oncomplete=()=>{db.close();resolve(r.result.filter(p=>p.projectId!=='@active'))};tx.onabort=()=>reject(tx.error)});
    }''')
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    evidence['browser'] = browser.version
    context = browser.new_context(viewport={'width': 1440, 'height': 1100})
    page = context.new_page(); page.on('pageerror', lambda e: evidence['pageErrors'].append(str(e)))
    page.goto('http://127.0.0.1:4173/', wait_until='networkidle'); expect(page.get_by_test_id('plan-canvas')).to_be_visible(); saved(page)
    baseline = current_meta(page)[0]; assert baseline['seq'] == 0
    record('fresh production startup creates a completed initial IndexedDB checkpoint')
    started = time.monotonic(); edit(page, 4600); saved(page); evidence['saveMilliseconds'].append((time.monotonic()-started)*1000)
    data = export(page, '/tmp/gharplan-ph0-t08-export.json'); assert next(j for j in data['junctions'] if j['id']=='j2')['x']==4600
    assert next(j for j in data['junctions'] if j['id']=='j5')['x']==4600 and data['revision']==1
    assert {'21.12 m²', '15.40 m²'} <= {s.strip() for s in page.locator('[data-testid^="area-"]').all_inner_texts()}
    record('accepted wall edit autosaves and exports schema-valid integer geometry; rounded area labels match')
    before = current_meta(page); page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Restore your drawing', exact=True)).to_be_visible(); assert page.get_by_test_id('plan-canvas').count()==0
    page.get_by_role('button', name='Leave saved files untouched', exact=True).click(); assert current_meta(page)==before
    page.get_by_role('button', name='Show recovery choices', exact=True).click(); page.get_by_role('button', name='Restore saved changes', exact=True).click()
    expect(page.get_by_label('Corner X coordinate', exact=True)).to_have_value('4600'); saved(page)
    record('newer journal prompts before editing; cancel preserves bytes/meta; explicit restore returns latest geometry')
    page.get_by_role('button', name='3D view', exact=True).click()
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration==='0'", timeout=30000)
    page.get_by_role('button', name='2D plan', exact=True).click(); expect(page.get_by_test_id('plan-canvas')).to_be_visible()
    record('restored document renders through a fresh worker/session and both views share the same model')
    other = context.new_page(); other.on('pageerror', lambda e: evidence['pageErrors'].append(str(e)))
    other.goto('http://127.0.0.1:4173/', wait_until='networkidle'); restore_if_offered(other); saved(other)
    edit(page, 4700); saved(page); edit(other, 4400)
    other.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='conflict'", timeout=15000)
    expect(other.get_by_label('Corner X coordinate', exact=True)).to_have_value('4400')
    conflicting = export(other, '/tmp/gharplan-ph0-t08-conflicting-memory.json'); assert next(j for j in conflicting['junctions'] if j['id']=='j2')['x']==4400
    head = current_meta(page); assert next(m for m in head if m['projectId']==baseline['projectId'])['seq']==2
    other.get_by_role('button', name='Retry local save', exact=True).click(); other.wait_for_timeout(350)
    assert current_meta(page)==head; other.close(); page.reload(wait_until='networkidle'); restore_if_offered(page)
    expect(page.get_by_label('Corner X coordinate', exact=True)).to_have_value('4700'); saved(page)
    record('real second tab loses CAS, retains exportable memory and cannot overwrite winner on retry or pagehide')
    page.evaluate('''() => { window.gharplanOriginalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(...args) {if(this.name==='journal') throw new DOMException('Injected quota failure','QuotaExceededError');return window.gharplanOriginalPut.apply(this,args)} }''')
    edit(page, 4800); page.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='error'", timeout=15000)
    assert current_meta(page)==head; expect(page.get_by_label('Corner X coordinate', exact=True)).to_have_value('4800')
    in_memory = export(page, '/tmp/gharplan-ph0-t08-quota-memory.json'); assert next(j for j in in_memory['junctions'] if j['id']=='j2')['x']==4800
    page.evaluate('() => { IDBObjectStore.prototype.put = window.gharplanOriginalPut; }'); page.get_by_role('button', name='Retry local save', exact=True).click(); saved(page)
    record('injected quota failure rolls back real transaction, warns, keeps memory/export and retries after fault removal')
    damaged = page.evaluate('''async id => {
      const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('gharplan',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
      return await new Promise((resolve,reject)=>{const tx=db.transaction('checkpoints','readwrite'),s=tx.objectStore('checkpoints'),r=s.get([id,0]);let value;
        r.onsuccess=()=>{value=r.result;value.packed.blob=new Blob(['broken']);s.put(value)};
        tx.oncomplete=()=>{db.close();resolve({id,seq:value.seq,blobBytes:value.packed.blob.size})};tx.onabort=()=>reject(tx.error)});
    }''', baseline['projectId'])
    original_meta = current_meta(page); page.reload(wait_until='networkidle')
    expect(page.get_by_role('heading', name='Restore your drawing', exact=True)).to_be_visible(); assert page.get_by_test_id('plan-canvas').count()==0
    expect(page.get_by_role('alert')).to_contain_text('could not be read')
    page.get_by_role('button', name='Open a separate sample', exact=True).click(); expect(page.get_by_test_id('plan-canvas')).to_be_visible(); saved(page)
    preserved = current_meta(page); assert len(preserved)==2
    assert next(m for m in preserved if m['projectId']==baseline['projectId'])==next(m for m in original_meta if m['projectId']==baseline['projectId'])
    # The original malformed checkpoint remains inspectable after the new copy.
    retained = page.evaluate('''async id => {const db=await new Promise(resolve=>{const r=indexedDB.open('gharplan',1);r.onsuccess=()=>resolve(r.result)});return await new Promise(resolve=>{const tx=db.transaction('checkpoints'),r=tx.objectStore('checkpoints').get([id,0]);tx.oncomplete=()=>{db.close();resolve(r.result.packed.blob.text())}})}''', baseline['projectId'])
    assert retained=='broken' and damaged['blobBytes']==6
    fresh = export(page, '/tmp/gharplan-ph0-t08-recovery-copy.json'); old_ids = {data['id']} | {e['id'] for key in ['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] for e in data[key]}
    new_ids = {fresh['id']} | {e['id'] for key in ['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] for e in fresh[key]}
    assert not old_ids.intersection(new_ids) and fresh['revision']==0
    record('corrupt sole checkpoint prevents replacement; explicit separate sample remaps all IDs and retains original meta/corrupt bytes')
    # Inject only the platform marker after the web workspace has loaded. This
    # tests export UI fallback, not native filesystem/bootstrap execution.
    page.evaluate("window.androidBridge={postMessage:()=>undefined}; Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true})")
    page.get_by_role('button', name='Export drawing', exact=True).click(); page.get_by_role('button', name='Copy complete data', exact=True).click()
    expect(page.get_by_text('Copy is unavailable.', exact=False)).to_be_visible()
    copied = json.loads(page.get_by_label('Complete drawing backup JSON', exact=True).input_value()); assert copied==fresh
    record('injected Android export UI keeps complete JSON and handles a missing clipboard API without a crash')
    context.close(); browser.close()
assert not evidence['pageErrors'], evidence['pageErrors']
pathlib.Path('/tmp/gharplan-ph0-t08-browser-results.json').write_text(json.dumps(evidence, indent=2)+'\n')
print(json.dumps(evidence, indent=2))
