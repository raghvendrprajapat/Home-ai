"""Verify the actual compiled APK/decoded manifest; no device behavior is implied."""
import hashlib
import json
import pathlib
import sys
import xml.etree.ElementTree as ET
import zipfile

apk, manifest = map(pathlib.Path, sys.argv[1:3])
registration_checked = len(sys.argv) > 3
if registration_checked:
    code = pathlib.Path(sys.argv[3]).read_text()
    assert 'Lcom/gharplan/app/ProjectFilesPlugin;' in code and 'registerPlugin(Ljava/lang/Class;)V' in code, 'Compiled app-owned export plugin registration missing'
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
    plugins = json.loads(archive.read('assets/capacitor.plugins.json'))
    assert any(p.get('pkg') == '@capacitor/filesystem' and p.get('classpath') == 'com.capacitorjs.plugins.filesystem.FilesystemPlugin' for p in plugins), 'Filesystem native plugin is not registered'
    assert any(b'com/capacitorjs/plugins/filesystem/FilesystemPlugin' in archive.read(n) for n in archive.namelist() if n.startswith('classes') and n.endswith('.dex')), 'Filesystem class is not packaged'
    dex = [archive.read(n) for n in archive.namelist() if n.startswith('classes') and n.endswith('.dex')]
    for class_name in ['ProjectFilesPlugin', 'ProjectFileStreams', 'ProjectFileSource']:
        assert any(('com/gharplan/app/' + class_name).encode() in data for data in dex), 'App-owned file export class missing: ' + class_name
    assert application.attrib.get(android + 'dataExtractionRules') and application.attrib.get(android + 'fullBackupContent'), 'Explicit private-data backup/transfer policy is missing'
    assert len(archive.read('assets/public/index.html')) > 0
    names = archive.namelist()
    for prefix in ['mesh.worker-', 'import.worker-', 'ThreeView-', 'PerfPage-', 'index-']:
        assert any(n.startswith('assets/public/assets/' + prefix) and n.endswith('.js') and archive.getinfo(n).file_size > 0 for n in names), prefix
result = {'applicationId': root.attrib['package'], 'bytes': apk.stat().st_size,
          'sha256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'permissions': sorted(permissions),
          'verified': ['decoded debug manifest flags and backup policy references', 'private local HTTPS configuration', 'packaged editor/import-worker/3D/performance assets', 'registered and packaged native Filesystem plugin', 'packaged app-owned native file export classes'],
          'limitations': ['Compilation and packaging only; no emulator or phone run', 'Debug APK size is not Play AAB download size']}
if registration_checked: result['verified'].append('compiled MainActivity invokes app-owned ProjectFiles plugin registration')
else: result['limitations'].append('Compiled registration invocation not inspected; supply fresh apkanalyzer class disassembly as third argument')
print(json.dumps(result, indent=2))
