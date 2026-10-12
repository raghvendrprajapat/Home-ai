import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('SDK discovery works without sdkmanager on PATH and refuses ambiguous or missing tools', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'gharplan-sdk-path-'));
  const run = () => spawnSync(process.execPath, ['scripts/android-sdk-bin.mjs', root], { encoding: 'utf8', env: { ...process.env, PATH: '' } });
  const install = name => {
    const bin = resolve(root, 'cmdline-tools', name, 'bin'); mkdirSync(bin, { recursive: true });
    for (const tool of ['sdkmanager', 'apkanalyzer']) writeFileSync(resolve(bin, tool), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    return bin;
  };
  try {
    mkdirSync(resolve(root, 'cmdline-tools'));
    assert.notEqual(run().status, 0);
    const versioned = install('12.0'); let result = run();
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), versioned);
    install('23.0'); assert.notEqual(run().status, 0);
    const latest = install('latest'); result = run();
    assert.equal(result.status, 0); assert.equal(result.stdout.trim(), latest);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
