import { defineConfig } from '@playwright/test';
import process from 'node:process';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, forbidOnly: !!process.env.CI, retries: 0, workers: 1,
  timeout: 30000, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4185', hasTouch: true, trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.GHARPLAN_CHROMIUM_PATH ? { executablePath: process.env.GHARPLAN_CHROMIUM_PATH } : {}) } },
  webServer: { command: 'pnpm --filter @gharplan/web exec vite build --mode e2e && pnpm --filter @gharplan/web exec vite preview --mode e2e --host 127.0.0.1 --port 4185 --strictPort', url: 'http://127.0.0.1:4185', reuseExistingServer: false, timeout: 60000, env: { VITE_SENTRY_DSN: '' } },
});
