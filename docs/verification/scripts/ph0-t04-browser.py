import json, pathlib
from playwright.sync_api import sync_playwright

evidence = {'scenario': 'PH0-T04 real Chromium interactions', 'checks': [], 'errors': []}
def record(name): evidence['checks'].append(name)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.on('pageerror',lambda e:evidence['errors'].append(str(e)))
    page.on('console',lambda m:evidence['errors'].append(m.text) if m.type=='error' else None)
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle')
    page.locator('.plan-canvas canvas').first.wait_for()
    area=lambda rid:page.get_by_test_id('area-'+rid).inner_text().strip()
    assert area('r_living').startswith('20.64') and area('r_bed').startswith('15.87')
    record('sample clear-area labels 20.64 / 15.87 m2')
    page.get_by_label('Corner X coordinate',exact=True).fill('4600')
    page.get_by_role('button',name='Apply coordinates').click()
    assert area('r_living').startswith('21.12') and area('r_bed').startswith('15.40')
    record('precise partition +100mm updates both room labels')
    page.get_by_role('button',name='Undo',exact=True).click()
    assert area('r_living').startswith('20.64') and page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('one undo restores the full sample and empties history')
    page.get_by_role('button',name='Redo',exact=True).click()
    assert area('r_living').startswith('21.12')
    page.get_by_role('button',name='Undo',exact=True).click()
    record('redo restores edited sample')
    box=page.get_by_test_id('plan-canvas').bounding_box()
    scale=min(1,(box['width']-100)/9200,(box['height']-100)/6200)
    vx=(box['width']-8000*scale)/2;vy=(box['height']-5000*scale)/2
    start=(box['x']+vx+4500*scale,box['y']+vy)
    end=(start[0]+400*scale,start[1])
    page.mouse.move(*start);page.mouse.down();page.mouse.move(*end,steps=8)
    assert area('r_living').startswith('20.64') and page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('drag preview does not commit DOM canonical values/history')
    page.keyboard.press('Escape');page.mouse.up()
    assert area('r_living').startswith('20.64') and page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('Escape discards preview without a commit')
    page.mouse.move(*start);page.mouse.down();page.mouse.move(*end,steps=8);page.mouse.up()
    assert not area('r_living').startswith('20.64') and not page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('actual pointer release commits a valid room resize')
    page.get_by_role('button',name='Undo',exact=True).click()
    assert area('r_living').startswith('20.64') and page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('drag creates exactly one undo entry')
    page.get_by_label('Corner X coordinate',exact=True).fill('0')
    page.get_by_role('button',name='Apply coordinates').click()
    assert area('r_living').startswith('20.64') and page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('invalid collapsed geometry rejected with canonical model/history unchanged')
    page.get_by_role('button',name='Fit floor plan').click()
    page.screenshot(path='/tmp/gharplan-ph0-t04-desktop.png',full_page=True)
    for width in [320,390,768]:
        page.set_viewport_size({'width':width,'height':844});page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert page.get_by_test_id('plan-canvas').bounding_box()['width']>200
        record('responsive '+str(width)+'px: no horizontal overflow; visible canvas')
        page.screenshot(path=f'/tmp/gharplan-ph0-t04-{width}px.png',full_page=True)
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.locator('.plan-canvas canvas').first.wait_for()
    box=page.get_by_test_id('plan-canvas').bounding_box()
    scale=min(1,(box['width']-100)/9200,(box['height']-100)/6200)
    vx=(box['width']-8000*scale)/2;vy=(box['height']-5000*scale)/2
    x0=box['x']+vx+4500*scale;y0=box['y']+vy
    page.mouse.move(x0+10,y0);page.mouse.down();page.mouse.move(x0+12,y0);page.mouse.up()
    expected=round(4500+2/scale)
    assert int(page.get_by_label('Corner X coordinate',exact=True).input_value())==expected
    record('off-centre handle grab preserves original corner + pointer delta')
    page.goto('http://127.0.0.1:5173/',wait_until='networkidle');page.locator('.plan-canvas canvas').first.wait_for()
    page.get_by_label('Corner X coordinate',exact=True).fill('4600');page.get_by_role('button',name='Apply coordinates').click();page.get_by_test_id('plan-canvas').focus()
    page.mouse.move(x0+100*scale,y0);page.mouse.down();page.mouse.move(x0+200*scale,y0,steps=3);page.keyboard.press('Control+z');page.wait_for_timeout(100)
    selected_circle=page.evaluate('''async () => {
      const url=performance.getEntriesByType('resource').find(e=>e.name.includes('/konva.js')).name;
      const {default:K}=await import(url);
      return K.stages.filter(s=>s.content.isConnected).flatMap(s=>s.find('Circle')).find(c=>c.stroke()==='#b6723f').x();
    }''')
    assert page.get_by_label('Corner X coordinate',exact=True).input_value()=='4500'
    assert abs(selected_circle-(vx+4500*scale))<.00001
    page.mouse.up();assert page.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('undo during drag removes stale preview; canvas and canonical corner agree')
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    box=page.get_by_test_id('plan-canvas').bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
    scroll=page.evaluate('scrollY');scale_label=page.locator('.canvas-scale').inner_text();page.mouse.wheel(0,300);page.wait_for_timeout(100)
    assert page.evaluate('scrollY')==scroll and page.locator('.canvas-scale').inner_text()!=scale_label
    record('canvas wheel zoom anchors view and suppresses document scroll')
    touch=browser.new_page(viewport={'width':390,'height':844},has_touch=True,device_scale_factor=1)
    touch.on('pageerror',lambda e:evidence['errors'].append(str(e)))
    touch.goto('http://127.0.0.1:5173/',wait_until='networkidle');touch.locator('.plan-canvas canvas').first.wait_for()
    box=touch.get_by_test_id('plan-canvas').bounding_box();s=min(1,(box['width']-100)/9200,(box['height']-100)/6200)
    x0=box['x']+(box['width']-8000*s)/2+4500*s;y0=box['y']+(box['height']-5000*s)/2
    cdp=touch.context.new_cdp_session(touch);a={'x':x0,'y':y0,'id':111};other={'x':x0+80,'y':y0+100,'id':222}
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[a,other]})
    a={**a,'x':x0+5};cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[a,other]})
    cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[other]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    assert touch.get_by_label('Corner X coordinate',exact=True).input_value()=='4500' and touch.get_by_role('button',name='Undo',exact=True).is_disabled()
    record('trusted two-finger gesture cancels edit and creates no history')
    touch.close()
    assert not evidence['errors'], evidence['errors']
    evidence['browser']=browser.version
    browser.close()
pathlib.Path('/tmp/gharplan-ph0-t04-browser-results.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence,indent=2))
