"""Standalone real Three/GLTFLoader proof via the repository's Vite dev server.

Start pnpm dev first. Uses a disposable page/profile, not a phone or catalog UI.
Creates/removes only its own temporary HTML; project documents are never opened.
"""
import json
import pathlib
import tempfile
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parents[3]
entry = json.loads((root / 'apps/web/public/catalog/catalog.json').read_text())['assets'][0]
temporary = tempfile.NamedTemporaryFile(prefix='.asset-proof-', suffix='.html', dir=root / 'apps/web', delete=False)
path = pathlib.Path(temporary.name)
script = '''<!doctype html><meta charset="utf-8"><style>body{margin:0}</style><script type="module">
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
try {
 const entry=ENTRY,reply=await fetch('/catalog/'+entry.lods[0].path);if(!reply.ok)throw Error('asset-http');
 const bytes=await reply.arrayBuffer(),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==entry.lods[0].sha256)throw Error('asset-hash');
 const gltf=await new GLTFLoader().parseAsync(bytes,''),scene=new THREE.Scene();scene.background=new THREE.Color('#eef2e9');scene.add(gltf.scene);scene.add(new THREE.HemisphereLight('#ffffff','#87987b',2));const light=new THREE.DirectionalLight('#fff5e6',2.5);light.position.set(2,4,-3);scene.add(light);
 const camera=new THREE.PerspectiveCamera(45,1,.01,100);camera.position.set(2,1.8,-2);camera.lookAt(0,.4,0);
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(256,256);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
 const pixels=new Uint8Array(256*256*4),gl=renderer.getContext();gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let nonBackground=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>12)nonBackground++;
 const bounds=new THREE.Box3().setFromObject(gltf.scene),geometries=new Set(),materials=new Set();gltf.scene.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);}});
 window.assetProof={sha256:digest,bytes:bytes.byteLength,threeRevision:THREE.REVISION,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,nonBackgroundPixels:nonBackground,geometries:geometries.size,materials:materials.size};
 // Preserve the first rendered frame for the screenshot, then dispose explicitly.
 window.disposeAssetProof=()=>{for(const g of geometries)g.dispose();for(const m of materials)m.dispose();renderer.dispose();renderer.forceContextLoss();};
} catch(error) {window.assetProof={error:String(error)};}
</script>'''.replace('ENTRY', json.dumps(entry, ensure_ascii=False))
temporary.write(script.encode())
temporary.close()
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        page = browser.new_page(viewport={'width': 256, 'height': 256})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://127.0.0.1:5173/' + path.name)
        page.wait_for_function('window.assetProof', timeout=30000)
        result = page.evaluate('window.assetProof')
        assert 'error' not in result, result
        assert not errors, errors
        assert result['triangles'] == 72 and result['drawCalls'] == 6, result
        assert result['nonBackgroundPixels'] > 1000, result
        for axis in range(3):
            assert abs(result['bounds']['min'][axis] - [-.6, 0, -.3][axis]) < 1e-8
            assert abs(result['bounds']['max'][axis] - [.6, .75, .3][axis]) < 1e-8
        page.screenshot(path='/tmp/gharplan-ph4-t01-asset.png')
        page.evaluate('window.disposeAssetProof()')
        result.update(browser=browser.version, pageErrors=errors, scope='Linux SwiftShader standalone GLTFLoader; not product catalog/Android/phone')
        browser.close()
    pathlib.Path('/tmp/gharplan-ph4-t01-render.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
finally:
    path.unlink(missing_ok=True)
