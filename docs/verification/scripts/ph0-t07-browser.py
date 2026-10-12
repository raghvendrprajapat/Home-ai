"""Production-browser integration; injected bridge is not an Android device run."""
import json
import pathlib
from playwright.sync_api import sync_playwright, expect

evidence = {'checks': [], 'errors': [], 'limitations': ['Linux Chromium software GPU, not a phone or WebView', 'Android export branch uses an injected bridge; no native plugin execution']}
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--enable-unsafe-swiftshader'])
    evidence['browser'] = browser.version
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    page.on('pageerror', lambda e: evidence['errors'].append(str(e)))
    page.goto('http://127.0.0.1:4173/', wait_until='networkidle')
    expect(page.get_by_test_id('plan-canvas')).to_be_visible()
    evidence['checks'].append('production editor loads bundled 2D assets')
    page.get_by_role('button', name='3D view', exact=True).click()
    page.wait_for_function("document.querySelector('[data-testid=three-view]')?.dataset.renderedGeneration==='0'", timeout=30000)
    evidence['checks'].append('production worker and lazy Three view render initial canonical generation')
    page.goto('http://127.0.0.1:4173/perf', wait_until='networkidle')
    expect(page.get_by_role('heading', name='GharPlan performance lab', exact=True)).to_be_visible()
    page.get_by_label('Run duration', exact=True).select_option('5000')
    page.get_by_label('Warm-up', exact=True).select_option('0')
    page.get_by_role('button', name='Start run', exact=True).click()
    page.wait_for_function("JSON.parse(document.querySelector('[data-testid=perf-json]').textContent).reports.length===1", timeout=15000)
    with page.expect_download() as downloaded:
        page.get_by_role('button', name='Export JSON', exact=True).click()
    destination = '/tmp/gharplan-ph0-t07-browser-export.json'
    downloaded.value.save_as(destination)
    exported = json.loads(pathlib.Path(destination).read_text())
    assert len(exported['reports']) == 1
    assert exported['reports'][0]['measurements']['protocol'] == 'quick-diagnostic'
    evidence['checks'].append('web export downloads parseable recorded report from production assets')
    # getPlatform detects this marker. This exercises the UI guard only.
    page.evaluate('window.androidBridge = {postMessage: () => undefined}')
    downloads = []
    page.on('download', lambda d: downloads.append(d.suggested_filename))
    page.get_by_role('button', name='Export JSON', exact=True).click()
    expect(page.get_by_role('status')).to_contain_text('Android JSON download is not implemented yet')
    page.wait_for_timeout(250)
    assert not downloads
    assert len(json.loads(page.get_by_test_id('perf-json').inner_text())['reports']) == 1
    evidence['checks'].append('injected Android marker explains native download limitation and preserves displayed JSON')
    browser.close()
assert not evidence['errors'], evidence['errors']
pathlib.Path('/tmp/gharplan-ph0-t07-browser-results.json').write_text(json.dumps(evidence, indent=2) + '\n')
print(json.dumps(evidence, indent=2))
