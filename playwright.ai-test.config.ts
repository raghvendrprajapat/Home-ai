import { defineConfig } from '@playwright/test';
import process from 'node:process';
import base from './playwright.config';
// D92: AI test mode needs its own build (public flag VITE_ROOM_AI_TEST_MODE=1), so its browser tests have their own
// config, folder, output directory and port; the default suite (playwright.config.ts) is unchanged and runs with the
// flag off. Every /api/room-ai/* call is answered by page.route in the tests: no OpenAI or fal.ai request is made.
const PORT = 4186;
export default defineConfig({
  ...base, testDir: './tests/e2e-ai-test',
  use: { ...base.use, baseURL: `http://127.0.0.1:${PORT}` },
  reporter: [['list'], ...(process.env.CI ? [['github'] as ['github']] : []), ['html', { open: 'never', outputFolder: 'ai-test-report' }]],
  webServer: { command: `pnpm --filter @gharplan/web exec vite build --mode e2e --outDir dist-e2e-aitest && pnpm --filter @gharplan/web exec vite preview --mode e2e --outDir dist-e2e-aitest --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`, reuseExistingServer: false, timeout: 60000,
    env: { VITE_SENTRY_DSN: '', VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_ROOM_AI_TEST_MODE: '1', VITE_API_BASE_URL: '' } },
});
