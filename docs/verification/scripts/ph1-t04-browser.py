"""Codex production file-import proof; isolated browser contexts, not phones."""
import json,pathlib
from playwright.sync_api import sync_playwright,expect
checks=[];errors=[]
def saved(p):p.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'",timeout=15000)
def start(c):
 p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto('http://127.0.0.1:4173/',wait_until='networkidle');p.get_by_role('button',name='Skip welcome',exact=True).click();saved(p);return p
def export(p):
 with p.expect_download() as got:p.get_by_role('button',name='Export drawing',exact=True).click()
 got.value.save_as('/tmp/gharplan-ph1-t04-current.json');return json.loads(pathlib.Path('/tmp/gharplan-ph1-t04-current.json').read_text())
def meta(p):return p.evaluate('''async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('gharplan');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return await new Promise((r,j)=>{const t=db.transaction('projects'),q=t.objectStore('projects').getAll();t.oncomplete=()=>{db.close();r(q.result)};t.onabort=()=>j(t.error)})}''')
def pick(p,data):p.get_by_label('Choose project backup JSON',exact=True).set_input_files({'name':'backup.json','mimeType':'application/json','buffer':data})
def ids(d):return {d['id']}|{e['id'] for k in ['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] for e in d[k]}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader']);c=b.new_context(viewport={'width':1440,'height':1100});p=start(c)
 sample=export(p);p.get_by_role('button',name='Projects',exact=True).click();p.locator('[data-project-id="'+sample['id']+'"]').get_by_role('button',name='Duplicate',exact=True).click();saved(p)
 p.get_by_label('Corner X coordinate',exact=True).fill('4600');p.get_by_role('button',name='Apply coordinates',exact=False).click();saved(p);doc=export(p);data=json.dumps(doc,ensure_ascii=False).encode();assert not ids(doc)&ids(sample)
 p.get_by_role('button',name='Projects',exact=True).click();before=meta(p);pick(p,data);expect(p.get_by_role('dialog',name='Open backup drawing',exact=True)).to_be_visible();expect(p.get_by_role('button',name='Open backup with original IDs',exact=True)).to_have_count(0)
 p.get_by_role('button',name='Cancel',exact=True).click();assert meta(p)==before;checks.append('existing-ID preview requires separate copy; cancelling writes nothing')
 badfraction=json.loads(data);badfraction['junctions'][0]['x']=0.4
 badunknown={**doc,'accountToken':'not-a-secret-test-sentinel'}
 cases=[(b'broken JSON','invalid JSON'),(b'\xff','UTF-8'),(b'','nonempty'),(json.dumps({**doc,'schemaVersion':2}).encode(),'Update the app'),(json.dumps(badfraction).encode(),'invalid JSON'),(json.dumps(badunknown).encode(),'invalid JSON'),(b' '* (10*1024*1024+1),'10 MiB')]
 for blob,label in cases:
  pick(p,blob);expect(p.get_by_role('alert')).to_contain_text(label,timeout=15000);assert meta(p)==before;expect(p.get_by_role('dialog')).to_have_count(0)
 checks.append('actual picker rejects malformed/UTF8/empty/newer/fractional/unknown/oversized files atomically')
 p.evaluate("()=>{window.taskOriginalWorker=window.Worker;window.Worker=class{constructor(){throw new DOMException('Injected worker failure','SecurityError')}};}")
 pick(p,data);expect(p.get_by_role('alert')).to_contain_text('could not be read or checked');assert meta(p)==before;p.evaluate('()=>{window.Worker=window.taskOriginalWorker}')
 checks.append('worker startup failure preserves all stored originals and offers retry')
 pick(p,data);p.get_by_role('button',name='Import as a separate copy',exact=True).click();saved(p);copy=export(p);assert not ids(copy)&ids(doc);assert copy['revision']==0
 after=meta(p);assert next(m for m in after if m.get('projectId')==doc['id'])==next(m for m in before if m.get('projectId')==doc['id']);checks.append('explicit import copy remaps every ID without modifying the original saved head')
 target=b.new_context(viewport={'width':1440,'height':1100});q=start(target);q.get_by_role('button',name='Projects',exact=True).click();target_before=meta(q);pick(q,data);expect(q.get_by_role('button',name='Open backup with original IDs',exact=True)).to_be_visible();assert meta(q)==target_before
 q.get_by_role('button',name='Open backup with original IDs',exact=True).click();saved(q);assert export(q)==doc;q.reload(wait_until='networkidle');saved(q);assert export(q)==doc
 checks.append('export to fresh local storage then import/reload preserves exact canonical content and all entity IDs')
 q.get_by_role('button',name='3D view',exact=True).click();q.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration==='0'",timeout=30000);q.get_by_role('button',name='2D plan',exact=True).click()
 assert {'21.12 m²','15.40 m²'} <= {s.strip() for s in q.locator('[data-testid^="area-"]').all_inner_texts()};checks.append('imported multiroom/openings/furniture project renders in synchronized 2D and 3D with expected area labels')
 q.get_by_role('button',name='Projects',exact=True).click();q.locator('[data-project-id="'+doc['id']+'"]').get_by_role('button',name='Move to trash',exact=True).click();q.get_by_role('dialog').get_by_role('button',name='Move to trash',exact=True).click();trash_before=meta(q);pick(q,data);expect(q.get_by_role('button',name='Open backup with original IDs',exact=True)).to_have_count(0);q.get_by_role('button',name='Cancel',exact=True).click();assert meta(q)==trash_before
 checks.append('trashed identities are not silently resurrected or overwritten by a backup')
 q.get_by_role('button',name='Settings',exact=True).click();q.get_by_label('Language',exact=True).select_option('hi');q.get_by_role('button',name='प्रोजेक्ट',exact=True).click();q.get_by_label('प्रोजेक्ट की बैकअप JSON चुनें',exact=True).set_input_files({'name':'future.json','mimeType':'application/json','buffer':json.dumps({**doc,'schemaVersion':2}).encode()});expect(q.get_by_role('alert')).to_contain_text('ऐप अपडेट करें');assert meta(q)==trash_before
 checks.append('Hindi import error tells user to update app for newer schema without data changes')
 assert not errors,errors;b.close()
result={'checks':checks,'pageErrors':errors,'limitations':['Linux Chromium, no Android picker/provider execution','Real Low/Mid external-file export/app-data loss/import gate is pending']};pathlib.Path('/tmp/gharplan-ph1-t04-browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
