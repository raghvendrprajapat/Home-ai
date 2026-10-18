import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';
import { boundaryViolation, layers } from './architecture-boundaries.mjs';

const root = path.resolve(import.meta.dirname, '..'), eslint = new ESLint({ cwd: root });
const rule = 'architecture/import-boundaries';
async function messages(file, code) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  assert.ok(result && !result.messages.some(m => m.fatal), 'Rule fixture must parse and not be ignored');
  return result.messages.filter(m => m.ruleId === rule);
}
test('actual ESLint rejects every module syntax and upward/private layer dependency', async () => {
  const bad = [
    ['apps/web/src/catalog/api.ts', "import { readFile } from 'node:fs/promises';"],
    ['apps/web/src/ui/other.test.ts', "import { readFile } from 'node:fs/promises';"],
    ['packages/geometry/src/boundary-probe.ts', "import React from 'react';"],
    ['packages/geometry/src/boundary-probe.ts', "export * from '@gharplan/core-model';"],
    ['packages/geometry/src/boundary-probe.ts', "export { IndexedProjectStorage } from '@gharplan/persistence';"],
    ['packages/core-model/src/boundary-probe.ts', "const load = () => import('@capacitor/filesystem');"],
    ['packages/core-model/src/boundary-probe.ts', "type T = import('three').Scene;"],
    ['packages/core-model/src/boundary-probe.ts', "import M = require('react');"],
    ['packages/geometry/src/boundary-probe.ts', "const x = require('@gharplan/persistence');"],
    ['packages/core-model/src/boundary-probe.ts', "import { x } from '../../geometry/src/primitives';"],
    ['packages/persistence/src/boundary-probe.ts', "import { x } from '@gharplan/core-model/src/store';"],
    ['packages/geometry/src/boundary-probe.test.ts', "import x from '../../../apps/web/src/App';"],
    ['packages/core-model/src/boundary-probe.ts', "const load = (name: string) => import(name);"],
    ['packages/core-model/src/boundary-probe.ts', "const load = () => import(`@gharplan/geometry`);"],
    ['apps/web/src/render3d/boundary-probe.ts', "import { SaveCoordinator } from '@gharplan/persistence';"],
    ['apps/web/src/editor/boundary-probe.ts', "import { openWorkspace } from '../storage/workspace';"],
    ['packages/geometry/src/boundary-probe.ts', "import x from 'node:fs';"],
    ['packages/geometry/src/boundary-probe.ts', "import x from 'https://example.invalid/ui.js';"],
    ['packages/geometry/src/boundary-probe.ts', "import x from '/workspace/Home-ai/apps/web/src/App';"],
    ['apps/web/src/boundary-probe.ts', "import { x } from '@gharplan/core-model/src/store';"],
    ['apps/web/src/boundary-probe.ts', "import { x } from '../../../packages/geometry/src/index';"],
    ['packages/geometry/src/boundary-probe.mts', "import React from 'react';"],
    ['packages/core-model/src/boundary-probe.js', "import x from 'konva';"],
    ['apps/web/src/boundary-probe.ts', "import { x } from '/@fs/workspace/Home-ai/packages/core-model/src/store.ts';"],
    ['apps/web/src/boundary-probe.ts', "import x from 'file:///workspace/Home-ai/packages/geometry/src/index.ts';"],
    ['apps/web/src/render3d/boundary-probe.ts', "new Worker(new URL('../storage/workspace.ts', import.meta.url), { type: 'module' });"],
    ['packages/geometry/src/boundary-probe.ts', "new Worker(new URL('../../core-model/src/store.ts', import.meta.url), { type: 'module' });"],
    ['apps/web/src/editor/boundary-probe.ts', "new globalThis.SharedWorker(new URL('../storage/workspace.ts', import.meta.url));"],
    ['apps/web/src/render3d/boundary-probe.ts', "new Worker('./mesh.worker.ts');"],
    ['apps/web/src/render3d/boundary-probe.ts', "new Worker(new URL('./mesh.worker.ts', location.href));"],
    ['packages/core-model/src/boundary-probe.ts', "import x from 'ajv/../react';"],
    ['apps/web/src/i18n/messages.ts', "import { openWorkspace } from '../storage/workspace';"],
    ['apps/web/src/i18n/messages.ts', "import { uiStore } from '../ui/state';"],
  ];
  for (const [file, code] of bad) assert.equal((await messages(file, code)).length, 1, `${file}: ${code}`);
});
test('actual ESLint admits downward public APIs, local helpers and bounded test fixtures', async () => {
  const good = [
    ['apps/web/src/catalog/api.test.ts', "import { readFile } from 'node:fs/promises';"],
    ['apps/web/src/catalog/catalog.test.ts', "import { readFile } from 'node:fs/promises';"],
    ['apps/web/src/catalog/modern-furniture.test.ts', "import { readFile } from 'node:fs/promises';"],
    ['packages/geometry/src/boundary-probe.ts', "export { rectArea } from './primitives';"],
    ['packages/core-model/src/boundary-probe.ts', "import type { Plan } from '@gharplan/geometry';"],
    ['packages/core-model/src/boundary-probe.ts', "type T = import('@gharplan/geometry').Plan;"],
    ['packages/persistence/src/boundary-probe.ts', "const load = () => import('@capacitor/filesystem');"],
    ['packages/persistence/src/boundary-probe.test.ts', "import 'fake-indexeddb/auto';"],
    ['packages/geometry/src/boundary-probe.test.ts', "import sample from '../../../tests/fixtures/independent/geometry/sample-project.json';"],
    ['packages/core-model/src/boundary-probe.test.ts', "import sample from '../../../docs/examples/sample-project.json';"],
    ['apps/web/src/render3d/boundary-probe.ts', "import { OrbitControls } from 'three/addons/controls/OrbitControls.js';"],
    ['apps/web/src/render3d/boundary-probe.ts', "import type { RenderReading } from '../perf/metrics';"],
    ['apps/web/src/render3d/boundary-probe.test.ts', "import twoSquares from '../../../../tests/fixtures/independent/geometry/two-squares.json';"],
    ['apps/web/src/boundary-probe.ts', "import { SaveCoordinator } from '@gharplan/persistence';"],
    ['apps/web/src/render3d/boundary-probe.ts', "new Worker(new URL('./mesh.worker.ts', import.meta.url), { type: 'module' });"],
    ['apps/web/src/render3d/boundary-probe.ts', "new globalThis.Worker(new URL('./mesh.worker.ts', import.meta.url));"],
    ['apps/web/src/render3d/boundary-probe.ts', "import { message } from '../i18n/messages';"],
  ];
  for (const [file, code] of good) assert.equal((await messages(file, code)).length, 0, `${file}: ${code}`);
});
test('path matching handles separators, traversal and exact directory boundaries', () => {
  const file = `${root}/packages/core-model/src/nested/module.ts`;
  assert.equal(boundaryViolation(file.replaceAll('/', '\\'), '../types'), null);
  assert.ok(boundaryViolation(file, '../../../persistence/src/index'));
  assert.ok(boundaryViolation(file, '../../src-evil/index'));
  assert.ok(boundaryViolation(`${root}/packages/geometry/src/x.test.ts`, '../../../docs/examples/../../../apps/web/src/App.json'));
  assert.ok(boundaryViolation(`${root}/packages/new-layer/src/x.ts`, './types'));
});
test('runtime package dependencies must obey the same reviewed directional policy', async () => {
  for (const [layer, admitted] of Object.entries(layers)) {
    const manifest = JSON.parse(await readFile(path.join(root, 'packages', layer, 'package.json'), 'utf8'));
    for (const name of Object.keys(manifest.dependencies ?? {})) assert.ok(admitted.includes(name), `${layer} cannot declare ${name}`);
    for (const field of ['optionalDependencies', 'peerDependencies'])
      for (const name of Object.keys(manifest[field] ?? {})) assert.ok(admitted.includes(name), `${layer} cannot declare ${field} ${name}`);
    assert.deepEqual(Object.keys(manifest.exports), ['.'], 'Expose only the reviewed public entry point');
    assert.equal(manifest.exports['.'], './src/index.ts', 'The public entry must stay inside the admitted source layer');
  }
});
