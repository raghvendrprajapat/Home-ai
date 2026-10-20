import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRights } from './rights.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const record = (path, text, extra = {}) => ({ path, source: 'https://ambientcg.com/view?id=X', license: 'CC0-1.0', author: 'A', checkedOn: '2026-10-19', sha256: sha(text), ...extra });
function repo(files, records) {
  const root = mkdtempSync(join(tmpdir(), 'rights-'));
  for (const [path, text] of Object.entries(files)) { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); }
  mkdirSync(join(root, 'docs/assets'), { recursive: true });
  if (records) writeFileSync(join(root, 'docs/assets/texture-rights.json'), JSON.stringify({ files: records }));
  return root;
}
const tex = 'apps/web/public/textures/wood_oak/color.jpg', env = 'apps/web/public/env/studio_small_09_1k.hdr';

test('D76 R5: every shipped texture and HDRI with a matching CC0 record passes', () => {
  assert.deepEqual(checkRights(repo({ [tex]: 'a', [env]: 'b' }, [record(tex, 'a'), record(env, 'b')])), []);
});
test('D76 R5: a missing, stale, incomplete or extra record fails', () => {
  assert.deepEqual(checkRights(repo({ [tex]: 'a' }, [])), [`${tex} has no rights record`]);
  assert.deepEqual(checkRights(repo({ [tex]: 'changed' }, [record(tex, 'a')])), [`${tex} does not match its recorded SHA-256`]);
  assert.deepEqual(checkRights(repo({ [tex]: 'a' }, [record(tex, 'a', { license: 'CC-BY-NC' })])), [`${tex} record is incomplete`]);
  assert.deepEqual(checkRights(repo({}, [record(tex, 'a')])), [`${tex} is recorded but not shipped`]);
  assert.deepEqual(checkRights(repo({ [tex]: 'a' })), ['docs/assets/texture-rights.json is missing or has no "files" list']);
});
