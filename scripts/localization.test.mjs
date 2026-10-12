import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';
const eslint = new ESLint({ cwd: path.resolve(import.meta.dirname, '..') });
test('actual localization lint rejects hardcoded JSX prose/accessibility and admits messages, data and branding', async () => {
  const probes = [
    ['<p>Create room</p>', 1], ['<p>{"Create room"}</p>', 1], ['<input aria-label="Name" placeholder="Enter name" />', 2],
    ['<p>{message(locale, "welcome")}</p>', 0], ['<p>{project.name}</p>', 0], ['<h1>GharPlan</h1>', 0], ['<button>↶ &nbsp;</button>', 0],
  ];
  for (const [code, count] of probes) {
    const [result] = await eslint.lintText(`const element = ${code};`, { filePath: path.resolve('apps/web/src/ui/localization-probe.tsx') });
    assert.ok(!result.messages.some(m => m.fatal));
    assert.equal(result.messages.filter(m => m.ruleId === 'localization/bilingual-ui').length, count, code);
  }
});
