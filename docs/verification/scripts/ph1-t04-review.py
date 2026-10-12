import json
from playwright.sync_api import sync_playwright,expect
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
 c=b.new_context(viewport={'width':1440,'height':1100});p=c.new_page();p.goto('http://127.0.0.1:4173/',wait_until='networkidle');p.get_by_role('button',name='Skip welcome',exact=True).click();p.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'")
 data=open('/tmp/gharplan-ph1-t04-current.json','rb').read()
 # Fail later writes only; the original saved record remains readable.
 p.evaluate("()=>{window.origTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...args){const tx=window.origTx.call(this,stores,mode,...args);if(mode==='readwrite')queueMicrotask(()=>tx.abort());return tx}}")
 p.get_by_label('Corner X coordinate',exact=True).fill('4600');p.get_by_role('button',name='Apply coordinates',exact=False).click();p.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='error'")
 p.get_by_role('button',name='Projects',exact=True).click();p.get_by_label('Choose project backup JSON',exact=True).set_input_files({'name':'backup.json','mimeType':'application/json','buffer':data})
 expect(p.get_by_role('dialog',name='Open backup drawing',exact=True)).to_be_visible();p.get_by_role('button',name='Import as a separate copy',exact=True).click();expect(p.get_by_role('dialog')).to_be_visible();expect(p.get_by_role('dialog').get_by_role('alert')).to_contain_text('Saving is not complete')
 p.get_by_role('button',name='Cancel',exact=True).click();p.get_by_role('button',name='Back to drawing',exact=True).click();expect(p.get_by_label('Corner X coordinate',exact=True)).to_have_value('4600');expect(p.get_by_test_id('save-status')).to_have_attribute('data-phase','error')
 print(json.dumps({'unsaved_session_import_guard':'passed: existing 4600mm memory edit/session retained; no replacement after failed flush'}));b.close()
