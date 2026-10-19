import { defineConfig } from '@playwright/test';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import base from './playwright.config';
// D76: independent acceptance tests (tests/acceptance, guarded by MANIFEST.sha256). Only the specs listed in
// tests/acceptance-enabled.txt run in CI; a milestone enables its specs once they pass unchanged. Run one spec
// locally with `pnpm acceptance tests/acceptance/<file>`.
const enabled = readFileSync(new URL('./tests/acceptance-enabled.txt', import.meta.url), 'utf8').split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
export default defineConfig({
  ...base, testDir: './tests/acceptance', timeout: 60000,
  testMatch: process.env.ACCEPTANCE_ALL ? '**/*.spec.ts' : enabled.length ? enabled : ['__none__'],
  reporter: [['list'], ...(process.env.CI ? [['github'] as ['github']] : []), ['html', { open: 'never', outputFolder: 'acceptance-report' }]],
});
