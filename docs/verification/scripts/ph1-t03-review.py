from playwright.sync_api import sync_playwright,expect
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--enable-unsafe-swiftshader'])
 c=b.new_context(); a=c.new_page();a.goto('http://127.0.0.1:4173/',wait_until='networkidle');a.get_by_role('button',name='Get started',exact=True).click();a.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'")
 old=a.locator('.project-bar h2').inner_text();a.get_by_role('button',name='Projects',exact=True).click();a.get_by_role('heading',name='Your drawings',exact=True).wait_for()
 second=c.new_page();second.goto('http://127.0.0.1:4173/',wait_until='networkidle');second.get_by_role('button',name='Projects',exact=True).click();second.get_by_role('button',name='Rename',exact=True).click();second.get_by_label('Project name',exact=True).fill('Changed in tab two');second.get_by_role('button',name='Save name',exact=True).click();second.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'")
 # Keep tab one unfocused and stale, matching an already-open project list.
 a.locator('.project-card').get_by_role('button',name='Open',exact=False).click();a.wait_for_function("document.querySelector('[data-testid=save-status]')?.dataset.phase==='saved'")
 print({'before':old,'tab_two':second.locator('.project-bar h2').inner_text(),'tab_one_after_open':a.locator('.project-bar h2').inner_text(),'tab_one_status':a.get_by_test_id('save-status').inner_text()})
 a.get_by_role('button',name='Projects',exact=True).click();a.get_by_role('button',name='Settings',exact=True).click();a.get_by_role('button',name='Settings',exact=True).click();a.get_by_role('button',name='Back',exact=True).click();print({'settings_back_goes_editor':a.locator('.project-bar h2').count()==1})
 b.close()
