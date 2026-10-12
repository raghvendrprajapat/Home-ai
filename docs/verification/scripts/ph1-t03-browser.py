import json,pathlib
from playwright.sync_api import sync_playwright,expect
checks=[]
def saved(page): page.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'",timeout=15000)
def export(page):
    with page.expect_download() as got: page.get_by_role('button',name='Export drawing',exact=True).click()
    got.value.save_as('/tmp/gharplan-shell-export.json'); return json.loads(pathlib.Path('/tmp/gharplan-shell-export.json').read_text())
def meta(page):
    return page.evaluate('''async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('gharplan');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error)});return await new Promise((r,j)=>{const t=db.transaction('projects'),q=t.objectStore('projects').getAll();t.oncomplete=()=>{db.close();r(q.result)};t.onabort=()=>j(t.error)})}''')
def ids(doc): return {doc['id']}|{e['id'] for k in ['floors','junctions','walls','openings','rooms','furniture','materials','lights','cameras'] for e in doc[k]}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1440,'height':1100},has_touch=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('http://127.0.0.1:4173/',wait_until='networkidle')
    expect(page.get_by_role('heading',name='Make room for your ideas',exact=True)).to_be_visible()
    page.get_by_label('Language',exact=True).select_option('hi');expect(page.get_by_role('heading',name='अपने घर को आकार दें',exact=True)).to_be_visible()
    page.get_by_label('भाषा',exact=True).select_option('en');page.get_by_role('button',name='Get started',exact=True).click();saved(page)
    original=export(page);baseline=meta(page)
    page.get_by_role('button',name='Projects',exact=True).click();page.get_by_role('button',name='New project',exact=True).click()
    expect(page.get_by_label('Project name',exact=True)).to_be_focused();page.get_by_label('Project name',exact=True).fill('Do not save');page.keyboard.press('Escape')
    expect(page.get_by_role('dialog')).to_have_count(0);expect(page.get_by_role('button',name='New project',exact=True)).to_be_focused();assert meta(page)==baseline
    checks.append('welcome bilingual; cancelled create preserves all metadata; dialog Escape restores focus')
    page.get_by_role('button',name='New project',exact=True).click();page.get_by_label('Project name',exact=True).fill('मेरा घर <script>');page.get_by_role('button',name='Create drawing',exact=True).click();saved(page)
    blank=export(page);assert blank['name']=='मेरा घर <script>' and not blank['walls'] and not blank['rooms'];assert not ids(blank)&ids(original)
    page.get_by_role('button',name='Add a starter room',exact=True).click();saved(page)
    expect(page.get_by_test_id('total-area')).to_contain_text('14.44');page.get_by_label('Corner X coordinate',exact=True).fill('4500');page.get_by_role('button',name='Apply coordinates',exact=False).click();saved(page)
    expect(page.get_by_test_id('total-area')).to_contain_text('16.34');page.get_by_role('button',name='Undo',exact=True).click();saved(page);expect(page.get_by_test_id('total-area')).to_contain_text('14.44');page.get_by_role('button',name='Redo',exact=True).click();saved(page)
    changed=export(page);checks.append('blank IDs are independent; starter room 14.44 m2, resized 16.34 m2, exact undo/redo')
    page.get_by_role('button',name='Settings',exact=True).click();page.get_by_label('Language',exact=True).select_option('hi');page.get_by_label('नई ड्रॉइंग की इकाई',exact=True).select_option('imperial');page.get_by_role('button',name='ड्रॉइंग पर वापस',exact=True).click()
    with page.expect_download() as got:page.get_by_role('button',name='ड्रॉइंग एक्सपोर्ट करें',exact=True).click()
    got.value.save_as('/tmp/gharplan-shell-hi.json');assert json.loads(pathlib.Path('/tmp/gharplan-shell-hi.json').read_text())==changed
    page.reload(wait_until='networkidle');expect(page.locator('html')).to_have_attribute('lang','hi');page.get_by_role('button',name='सेव बदलाव वापस लाएँ',exact=True).click();saved(page)
    expect(page.get_by_label('कोने का X निर्देशांक',exact=True)).to_have_value('4500');checks.append('Hindi/default units persist through reload without mutating project geometry or current units')
    page.get_by_role('button',name='सेटिंग्स',exact=True).click();page.get_by_label('भाषा',exact=True).select_option('en');page.get_by_role('button',name='Projects',exact=True).click()
    page.get_by_role('button',name='Settings',exact=True).click();page.get_by_role('button',name='Settings',exact=True).click();page.get_by_role('button',name='Back',exact=True).click();expect(page.get_by_role('heading',name='Your drawings',exact=True)).to_be_visible()
    other=page.context.new_page();other.goto('http://127.0.0.1:4173/',wait_until='networkidle');other.get_by_role('button',name='Restore saved changes',exact=True).click();saved(other)
    other.get_by_role('button',name='Projects',exact=True).click();other.locator('[data-project-id="'+changed['id']+'"]').get_by_role('button',name='Rename',exact=True).click();other.get_by_label('Project name',exact=True).fill('Changed in tab two');other.get_by_role('button',name='Save name',exact=True).click();saved(other)
    page.get_by_role('button',name='Open मेरा घर <script>',exact=True).click();saved(page);expect(page.locator('.project-bar h2')).to_contain_text('Changed in tab two');assert export(page)['name']=='Changed in tab two';other.close()
    page.get_by_role('button',name='Projects',exact=True).click()
    checks.append('stale Open reads current saved head from another tab; repeated Settings preserves Projects return route')
    card=page.locator('[data-project-id="'+changed['id']+'"]');card.get_by_role('button',name='Rename',exact=True).click();page.get_by_label('Project name',exact=True).fill('Renamed home');page.get_by_role('button',name='Save name',exact=True).click();saved(page)
    renamed=export(page);assert renamed['name']=='Renamed home';assert renamed['walls']==changed['walls']
    page.get_by_role('button',name='Projects',exact=True).click();card.get_by_role('button',name='Duplicate',exact=True).click();saved(page);copy=export(page);assert copy['name']=='Copy of Renamed home' and copy['revision']==0;assert not ids(copy)&ids(renamed)
    page.get_by_role('button',name='Projects',exact=True).click();page.get_by_role('button',name='Open Renamed home',exact=True).click();saved(page);assert export(page)==renamed
    checks.append('rename preserves walls; duplicate replaces every ID; opening source preserves exact canonical data')
    page.get_by_role('button',name='Projects',exact=True).click();page.get_by_role('button',name='Open Copy of Renamed home',exact=True).click();saved(page);page.get_by_role('button',name='Projects',exact=True).click()
    cp=page.locator('[data-project-id="'+copy['id']+'"]');before=next(m for m in meta(page) if m.get('projectId')==copy['id']);cp.get_by_role('button',name='Move to trash',exact=True).click();page.get_by_role('dialog').get_by_role('button',name='Move to trash',exact=True).click();expect(cp).to_have_count(0)
    assert page.get_by_role('button',name='Back to drawing',exact=True).count()==0
    trashed=next(m for m in meta(page) if m.get('projectId')==copy['id']);assert trashed['trashedAt'];assert {k:v for k,v in trashed.items() if k!='trashedAt'}==before
    page.reload(wait_until='networkidle');expect(page.get_by_role('heading',name='Your drawings',exact=True)).to_be_visible();page.get_by_role('button',name='Show trash',exact=True).click();cp.get_by_role('button',name='Restore',exact=True).click();expect(cp).to_have_count(0)
    page.get_by_role('button',name='Show drawings',exact=True).click();page.get_by_role('button',name='Open Copy of Renamed home',exact=True).click();saved(page);assert export(page)==copy
    checks.append('active trash removes editable session; reload never recreates sample; restore returns exact canonical copy')
    disk_before=meta(page)
    page.evaluate('''()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='journal')throw new DOMException('Injected quota','QuotaExceededError');return window.originalPut.apply(this,a)}}''')
    page.get_by_label('Corner X coordinate',exact=True).fill('4600');page.get_by_role('button',name='Apply coordinates',exact=False).click();page.wait_for_function("document.querySelector('[data-testid=save-status]').dataset.phase==='error'",timeout=15000)
    page.get_by_role('button',name='Projects',exact=True).click();page.get_by_role('button',name='New project',exact=True).click();page.get_by_label('Project name',exact=True).fill('Must not replace unsaved');page.get_by_role('button',name='Create drawing',exact=True).click()
    expect(page.get_by_role('dialog').get_by_role('alert')).to_contain_text('Saving is not complete');assert meta(page)==disk_before
    page.get_by_role('button',name='Cancel',exact=True).click();page.get_by_role('button',name='Back to drawing',exact=True).click();expect(page.get_by_label('Corner X coordinate',exact=True)).to_have_value('4600')
    kept=export(page);assert kept['id']==copy['id'] and any(j['x']==4600 for j in kept['junctions'])
    page.evaluate('()=>{IDBObjectStore.prototype.put=window.originalPut;}');page.get_by_role('button',name='Retry local save',exact=True).click();saved(page)
    checks.append('real quota failure blocks project replacement, preserves disk and exportable memory, retry succeeds')
    page.get_by_role('button',name='Projects',exact=True).click();page.get_by_role('button',name='New project',exact=True).click();expect(page.get_by_label('Units',exact=True)).to_have_value('imperial');page.get_by_label('Project name',exact=True).fill('Imperial room');page.get_by_role('button',name='Create drawing',exact=True).click();saved(page)
    page.get_by_role('button',name='Add a starter room',exact=True).click();saved(page);imperial=export(page);assert imperial['units']=='imperial';expect(page.get_by_test_id('total-area')).to_contain_text('155.43');expect(page.get_by_test_id('total-area')).to_contain_text('ft²')
    checks.append('new-project preference sets imperial display; canonical coordinates remain integer mm')
    page.set_viewport_size({'width':360,'height':800});page.get_by_role('button',name='Settings',exact=True).click();page.get_by_label('Language',exact=True).select_option('hi');page.screenshot(path='/tmp/gharplan-shell-hi-mobile.png',full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.get_by_role('button',name='प्रोजेक्ट',exact=True).tap();page.screenshot(path='/tmp/gharplan-shell-projects-mobile.png',full_page=True);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    checks.append('Hindi settings and project cards fit 360px viewport without horizontal page overflow')
    page.get_by_role('button',name='ड्रॉइंग पर वापस',exact=True).tap();page.get_by_role('button',name='3D व्यू',exact=True).tap()
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration==='1'",timeout=30000)
    expect(page.get_by_label('इंटरैक्टिव 3D फ्लोर प्लान',exact=True)).to_be_visible()
    checks.append('Hindi touch navigation reaches actual worker-rendered 3D of the same imperial project')
    assert not errors,errors;browser.close()
result={'checks':checks,'pageErrors':errors,'limitations':['Linux Chromium software rendering; not real Android phone/Hindi font/device evidence']}
pathlib.Path('/tmp/gharplan-ph1-t03-browser-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2))
