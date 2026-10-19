import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { guardAcceptance } from './acceptance-guard.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
function folder(files, manifest) {
  const root = mkdtempSync(join(tmpdir(), 'acceptance-')); mkdirSync(join(root, 'm1'));
  for (const [path, text] of Object.entries(files)) writeFileSync(join(root, path), text);
  if (manifest !== undefined) writeFileSync(join(root, 'MANIFEST.sha256'), manifest);
  return root;
}

test('an empty or missing acceptance folder passes', () => {
  assert.deepEqual(guardAcceptance(join(tmpdir(), 'no-such-acceptance-folder')), []);
  assert.deepEqual(guardAcceptance(folder({})), []);
});
test('files matching the manifest pass', () => {
  const files = { 'a.spec.ts': 'one', 'm1/b.spec.ts': 'two' };
  assert.deepEqual(guardAcceptance(folder(files, `${sha('one')}  a.spec.ts\n${sha('two')}  m1/b.spec.ts\n`)), []);
});
test('an edited, added or removed file fails, and so does a missing manifest', () => {
  assert.deepEqual(guardAcceptance(folder({ 'a.spec.ts': 'one!' }, `${sha('one')}  a.spec.ts\n`)), ['a.spec.ts was changed after the independent author committed it']);
  assert.deepEqual(guardAcceptance(folder({ 'a.spec.ts': 'one', 'x.ts': 'new' }, `${sha('one')}  a.spec.ts\n`)), ['x.ts is not in MANIFEST.sha256']);
  assert.deepEqual(guardAcceptance(folder({}, `${sha('one')}  a.spec.ts\n`)), ['a.spec.ts is listed but missing']);
  assert.deepEqual(guardAcceptance(folder({ 'a.spec.ts': 'one' })), ['tests/acceptance has 1 file(s) but no MANIFEST.sha256']);
  assert.deepEqual(guardAcceptance(folder({ 'a.spec.ts': 'one' }, `bad line\n${sha('one')}  a.spec.ts\n`)), ['MANIFEST.sha256 line 1 is not "<sha256>  <path>"']);
});
