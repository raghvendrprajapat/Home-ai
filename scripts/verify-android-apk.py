"""Verify the actual compiled APK/decoded manifest; no device behavior is implied."""
import hashlib
import json
import pathlib
import sys
import xml.etree.ElementTree as ET
import zipfile

apk, manifest = map(pathlib.Path, sys.argv[1:3])
android = '{http://schemas.android.com/apk/res/android}'
root = ET.parse(manifest).getroot()
assert root.attrib['package'] == 'com.gharplan.app.debug', 'Wrong debug application ID'
sdk = root.find('uses-sdk')
assert sdk is not None and sdk.attrib.get(android + 'minSdkVersion') == '24' and sdk.attrib.get(android + 'targetSdkVersion') == '36', 'Unexpected SDK range'
application = root.find('application')
assert application is not None
for flag, value in [('debuggable', 'true'), ('allowBackup', 'false'), ('usesCleartextTraffic', 'false')]:
    assert application.attrib.get(android + flag) == value, f'Unexpected {flag}'
permissions = {p.attrib[android + 'name'] for p in root.findall('uses-permission')}
internal = root.attrib['package'] + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
declared = [p for p in root.findall('permission') if p.attrib.get(android + 'name') == internal]
assert len(declared) == 1, 'Missing or duplicate internal receiver permission'
protection = declared[0].attrib.get(android + 'protectionLevel', '')
assert protection == 'signature' or protection.startswith('0x') and int(protection, 16) == 2, 'Internal permission must be signature-only'
assert permissions <= {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE', internal}, permissions
assert 'android.permission.INTERNET' in permissions
with zipfile.ZipFile(apk) as archive:
    config = json.loads(archive.read('assets/capacitor.config.json'))
    server = config['server']
    assert server == {'hostname': 'localhost', 'androidScheme': 'https', 'cleartext': False}, server
    assert config['android'].get('allowMixedContent') is False
    assert 'webContentsDebuggingEnabled' not in config['android'], 'Debugging must use native build flag'
    assert config['appId'] == 'com.gharplan.app' and config['webDir'] == 'dist'
    assert len(archive.read('assets/public/index.html')) > 0
    names = archive.namelist()
    for prefix in ['mesh.worker-', 'ThreeView-', 'PerfPage-', 'index-']:
        assert any(n.startswith('assets/public/assets/' + prefix) and n.endswith('.js') and archive.getinfo(n).file_size > 0 for n in names), prefix
result = {'applicationId': root.attrib['package'], 'bytes': apk.stat().st_size,
          'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'permissions': sorted(permissions),
          'verified': ['decoded debug manifest flags', 'private local HTTPS configuration', 'packaged editor/worker/3D/performance assets'],
          'limitations': ['Compilation and packaging only; no emulator or phone run', 'Debug APK size is not Play AAB download size']}
print(json.dumps(result, indent=2))
