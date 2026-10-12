from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader']);c=b.new_context();a=c.new_page();a.goto('http://127.0.0.1:4173/',wait_until='networkidle');a.get_by_role('button',name='Get started',exact=True).click();a.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'")
 a.get_by_role('button',name='Projects',exact=True).click();a.get_by_role('heading',name='Your drawings',exact=True).wait_for()
 second=c.new_page();second.goto('http://127.0.0.1:4173/',wait_until='networkidle');second.get_by_role('button',name='Projects',exact=True).click()
 a.evaluate('''()=>{const original=crypto.subtle.digest.bind(crypto.subtle);let once=true;crypto.subtle.digest=async(...args)=>{if(once){once=false;window.reviewDigestWaiting=true;await new Promise(r=>window.reviewReleaseDigest=r)}return original(...args)}}''')
 a.locator('.project-card').get_by_role('button',name='Open',exact=False).click();a.wait_for_function('window.reviewDigestWaiting===true')
 second.get_by_role('button',name='Move to trash',exact=True).click();second.get_by_role('dialog').get_by_role('button',name='Move to trash',exact=True).click();expect(second.locator('.project-card')).to_have_count(0)
 a.evaluate('window.reviewReleaseDigest()');expect(a.get_by_role('heading',name='Your drawings',exact=True)).to_be_visible();expect(a.get_by_role('alert')).to_contain_text('This action could not finish.')
 assert a.locator('.project-bar').count()==0
 print('PASS: trash committed while recover SHA-256 was paused; activation CAS rejected stale same-head reuse; current editor session retained behind Projects.')
 b.close()
