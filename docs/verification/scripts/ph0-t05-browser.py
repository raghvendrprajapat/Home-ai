"""Real local Chromium interactions; software WebGL is not an Android benchmark."""
import json, pathlib
from playwright.sync_api import sync_playwright

evidence = {'scenario': 'PH0-T05 Chromium WebGL2 and recovery', 'checks': [], 'errors': []}
def record(name): evidence['checks'].append(name)
def wait_generation(page, generation):
    page.wait_for_function("g => document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration===String(g)", arg=generation, timeout=20000)
def area(page): return page.get_by_test_id('area-r_living').inner_text().strip()
def edit(page, x):
    page.get_by_label('Corner X coordinate', exact=True).fill(str(x))
    page.get_by_role('button', name='Apply coordinates').click()
def watch(page):
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.on('console', lambda m: evidence['errors'].append(m.text) if m.type == 'error' else None)
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1440, 'height':1000}, device_scale_factor=1); watch(page)
    page.goto('http://127.0.0.1:5173/', wait_until='networkidle')
    page.get_by_role('button', name='3D view', exact=True).click(); wait_generation(page, 0)
    evidence['browser'] = browser.version
    evidence['graphics'] = page.locator('.three-mount canvas').evaluate("e => { const gl=e.getContext('webgl2'), ext=gl.getExtension('WEBGL_debug_renderer_info'); return {version:gl.getParameter(gl.VERSION),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'}; }")
    initial = page.get_by_test_id('three-view').evaluate('e => ({...e.dataset})')
    evidence['initial_scene'] = initial
    assert int(initial['drawCalls']) > 0 and int(initial['vertexCount']) > 0
    record('actual WebGL2 draw with nonempty geometry at generation 0')
    page.screenshot(path='/tmp/gharplan-ph0-t05-desktop.png', full_page=True)
    edit(page, 4600); wait_generation(page, 1); assert area(page).startswith('21.12')
    changes = json.loads(page.get_by_test_id('three-view').get_attribute('data-mesh-changes'))
    assert 'wall:w7' in changes['replaced'] and 'wall:w6' in changes['kept']
    record('exact partition edit updates 3D generation 1; unchanged wall w6 retained')
    page.get_by_role('button', name='Undo', exact=True).click(); wait_generation(page, 2); assert area(page).startswith('20.64')
    page.get_by_role('button', name='Redo', exact=True).click(); wait_generation(page, 3); assert area(page).startswith('21.12')
    record('undo/redo render generations 2/3 and correct canonical areas')
    page.get_by_role('button', name='2D plan', exact=True).click(); page.get_by_test_id('plan-canvas').locator('canvas').first.wait_for()
    assert area(page).startswith('21.12')
    page.get_by_role('button', name='3D view', exact=True).click(); wait_generation(page, 3)
    record('view switching destroys/recreates adapters and retains edited model')
    canvas = page.locator('.three-mount canvas'); canvas.focus(); before = canvas.screenshot()
    page.keyboard.press('ArrowRight'); page.wait_for_timeout(250); assert canvas.screenshot() != before
    record('keyboard orbit changes actual rendered pixels')
    for width in [320, 390, 768]:
        page.set_viewport_size({'width':width,'height':844}); page.wait_for_timeout(150)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert canvas.bounding_box()['width'] > 200
        page.screenshot(path=f'/tmp/gharplan-ph0-t05-{width}px.png', full_page=True)
        record(f'{width}px layout has visible 3D canvas without horizontal overflow')
    page.set_viewport_size({'width':1440,'height':1000})
    canvas.evaluate("e => { window.__testContext = e.getContext('webgl2').getExtension('WEBGL_lose_context'); if(!window.__testContext) throw Error('Missing context-loss test extension'); window.__testContext.loseContext(); }")
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.contextState==='lost'")
    edit(page, 4700)
    page.wait_for_timeout(150)
    page.evaluate('window.__testContext.restoreContext()')
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.contextState==='restored'")
    wait_generation(page, 4); assert area(page).startswith('21.60')
    record('real WebGL context loss/restoration renders the latest edit, generation 4')
    for _ in range(5):
        page.get_by_role('button', name='2D plan', exact=True).click()
        page.get_by_role('button', name='3D view', exact=True).click(); wait_generation(page, 4)
    record('five view teardown/recreation cycles retain generation 4 without page errors')
    page.close()
    # Explicit startup failure: the editor and its unsaved model must remain accessible.
    failure = browser.new_page(); watch(failure)
    failure.add_init_script("window.Worker=class { constructor(){ throw new DOMException('blocked by test','SecurityError'); } }")
    failure.goto('http://127.0.0.1:5173/', wait_until='networkidle'); edit(failure, 4600)
    failure.get_by_role('button', name='3D view', exact=True).click()
    failure.get_by_text('The 3D worker could not start.', exact=False).wait_for()
    failure.get_by_role('button', name='2D plan', exact=True).click(); assert area(failure).startswith('21.12')
    record('injected Worker construction failure preserves editor/model and returns to 2D')
    failure.close()
    chunk = browser.new_page()
    # Request abort is intentional; report page errors but not its expected net::ERR_FAILED.
    chunk.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    chunk.route('**/src/render3d/ThreeView.tsx*', lambda route: route.abort())
    chunk.goto('http://127.0.0.1:5173/', wait_until='networkidle'); edit(chunk, 4600)
    chunk.get_by_role('button', name='3D view', exact=True).click()
    chunk.get_by_text('The 3D engine could not load.', exact=False).wait_for()
    chunk.get_by_role('button', name='2D plan', exact=True).click(); assert area(chunk).startswith('21.12')
    record('injected 3D chunk-load failure preserves editor/model and returns to 2D')
    chunk.close(); browser.close()
assert not evidence['errors'], evidence['errors']
pathlib.Path('/tmp/gharplan-ph0-t05-browser-results.json').write_text(json.dumps(evidence, indent=2)+'\n')
print(json.dumps(evidence, indent=2))
