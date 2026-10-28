import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: [
      'apps/web/src/**/*.test.{ts,tsx}',
      'packages/*/src/**/*.test.{ts,tsx}',
      'server/supabase/functions/**/*.test.ts',
      'server/vercel/**/*.test.ts',
    ],
    restoreMocks: true,
    passWithNoTests: false,
  },
});
