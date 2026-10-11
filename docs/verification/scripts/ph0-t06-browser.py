"""Instrumentation diagnostics, not three five-minute physical-phone release runs."""
import json, pathlib, platform, os
from playwright.sync_api import sync_playwright, expect

evidence = {'scenario':'PH0-T06 local instrumentation diagnostics','checks':[],'errors':[], 'host':{'platform':platform.platform(),'logicalCpus':os.cpu_count(),'memoryLimitBytes':int(pathlib.Path('/sys/fs/cgroup/memory.max').read_text())},'reports':[]}
def record(name): evidence['checks'].append(name)
def get_report(page, count):
    page.wait_for_function("n => JSON.parse(document.querySelector('[data-testid=perf-json]').textContent).reports.length===n",arg=count,timeout=45000)
    return json.loads(page.get_by_test_id('perf-json').inner_text())['reports'][-1]
def controls(page, duration='30000'):
    page.get_by_label('Run duration',exact=True).select_option(duration)
    page.get_by_label('Warm-up',exact=True).select_option('0')
def ready(page):
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration!==undefined && document.querySelector('[data-testid=three-view]').dataset.renderedGeneration!==''",timeout=30000)
    expect(page.get_by_role('button',name='Start run',exact=True)).to_be_enabled()
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader'])
    evidence['browser']=browser.version
    page=browser.new_page(viewport={'width':1440,'height':1100}); page.on('pageerror',lambda e:evidence['errors'].append(str(e)))
    page.on('console',lambda m:evidence['errors'].append(m.text) if m.type=='error' else None)
    page.goto('http://127.0.0.1:5173/perf',wait_until='networkidle')
    assert page.get_by_role('heading',level=1).inner_text()=='GharPlan performance lab'
    record('dedicated /perf route loads disposable projects')
    # Starting from a prior edit must export the actual input, not the template hash.
    page.get_by_role('button',name='Move wall ±100 mm',exact=True).click()
    page.get_by_label('Benchmark view',exact=True).select_option('3d'); ready(page); controls(page)
    page.get_by_role('button',name='Start run',exact=True).click(); r=get_report(page,1); evidence['reports'].append(r)
    assert r['initialDocument']['junctions'][1]['x']==4600 and r['fixture']['inputHash']!=r['fixture']['templateHash']
    assert r['workload']['scriptedEdits'] and r['workload']['autoOrbit']
    assert r['measurements']['protocol']=='quick-diagnostic' and r['measurements']['frameMs']['count']>100
    assert r['measurements']['commitToSubmitted3dMs']['count']>=20 and r['measurements']['uninterrupted']
    record('sample 30-second orbit/edits logs real timings and exact edited input/settings')
    print('sample diagnostic recorded',flush=True)
    page.get_by_label('Benchmark project',exact=True).select_option('large'); ready(page)
    assert page.get_by_test_id('perf-counts').inner_text()=='200 walls · 100 objects'
    page.get_by_role('button',name='Start run',exact=True).click(); r=get_report(page,2); evidence['reports'].append(r)
    assert len(r['initialDocument']['walls'])==200 and len(r['initialDocument']['furniture'])==100
    assert r['measurements']['rendererResources']['gpuMemoryBytes'] is None
    assert r['measurements']['drawCalls']['count']>100 and r['measurements']['commitToSubmitted3dMs']['count']>=20
    assert r['measurements']['uninterrupted'] and r['measurements']['fps']>0
    record('large 30-second orbit/edits records draw calls, whole-window FPS, latency and main-frame heap')
    print('large diagnostic recorded',flush=True)
    page.get_by_role('button',name='Reset test project',exact=True).click()
    page.get_by_label('Benchmark view',exact=True).select_option('2d')
    page.get_by_test_id('plan-canvas').locator('canvas').first.wait_for()
    page.get_by_role('button',name='Start run',exact=True).click()
    page.get_by_test_id('plan-canvas').scroll_into_view_if_needed()
    box=page.get_by_test_id('plan-canvas').bounding_box()
    scale=min(1,(box['width']-100)/50200,(box['height']-100)/20200)
    vx=(box['width']-49000*scale)/2;vy=(box['height']-19000*scale)/2
    start=(box['x']+vx+4000*scale,box['y']+vy)
    page.mouse.move(*start);page.mouse.down()
    for i in range(80):
        page.mouse.move(start[0]+(400+(i%2)*200)*scale,start[1]);page.wait_for_timeout(15)
    page.mouse.up(); r=get_report(page,3); evidence['reports'].append(r)
    assert r['measurements']['previewMs']['count']>=30 and r['measurements']['commandMs']['count']>=1
    assert r['finalTag']['localGeneration']==r['initialTag']['localGeneration']+1
    assert r['measurements']['committedChanges']==1 and r['measurements']['sufficientInteraction']
    assert r['measurements']['cadenceType']=='raf-cadence' and r['measurements']['editingFrameMs']['count']>0
    record('large actual pointer drag records previews, commit and editing frame intervals')
    print('2D diagnostic recorded',flush=True)
    controls(page,'5000');page.get_by_role('button',name='Start run',exact=True).click()
    page.set_viewport_size({'width':1000,'height':900}); r=get_report(page,4)
    assert not r['measurements']['uninterrupted'] and r['viewportChanges']
    record('viewport rotation/resize is explicitly interrupted and logged')
    with page.expect_download() as download:
        page.get_by_role('button',name='Export JSON',exact=True).click()
    destination='/tmp/gharplan-ph0-t06-export.json';download.value.save_as(destination)
    assert len(json.loads(pathlib.Path(destination).read_text())['reports'])==4
    record('actual JSON download contains all recorded runs')
    page.close()
    blocked=browser.new_page();blocked.on('pageerror',lambda e:evidence['errors'].append(str(e)))
    blocked.add_init_script("window.Worker=class {constructor(){throw new DOMException('blocked by test','SecurityError')}}")
    blocked.goto('http://127.0.0.1:5173/perf',wait_until='networkidle');blocked.get_by_label('Benchmark view',exact=True).select_option('3d')
    blocked.get_by_text('The 3D worker could not start.',exact=False).wait_for()
    expect(blocked.get_by_role('button',name='Start run',exact=True)).to_be_disabled()
    record('pre-start worker failure prevents a misleading benchmark run');blocked.close()
    chunk=browser.new_page();chunk.on('pageerror',lambda e:evidence['errors'].append(str(e)))
    chunk.route('**/src/render3d/ThreeView.tsx*',lambda route:route.abort())
    chunk.goto('http://127.0.0.1:5173/perf',wait_until='networkidle');chunk.get_by_label('Benchmark view',exact=True).select_option('3d')
    chunk.get_by_text('3D engine could not load.',exact=False).first.wait_for()
    expect(chunk.get_by_role('button',name='Start run',exact=True)).to_be_disabled()
    record('pre-start engine download failure prevents a misleading benchmark run');chunk.close();browser.close()
assert not evidence['errors'],evidence['errors']
pathlib.Path('/tmp/gharplan-ph0-t06-browser-results.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps({'checks':evidence['checks'],'errors':evidence['errors'],'summaries':[{'fixture':r['fixture'],'measurements':r['measurements']} for r in evidence['reports']]},indent=2))
