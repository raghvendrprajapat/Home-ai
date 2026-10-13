import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { publicDsn } from './src/diagnostics/config.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import process from 'node:process';

function localBaseSha(): string {
  // A build must also work from a source archive or a sandbox without subprocesses.
  try {
    const git = fileURLToPath(new URL('../../.git/', import.meta.url)), head = readFileSync(resolve(git, 'HEAD'), 'utf8').trim();
    if (/^[a-f0-9]{40,64}$/.test(head)) return head;
    const ref = head.startsWith('ref: ') ? head.slice(5) : '';
    if (!/^refs\/(heads|remotes|tags)\/[A-Za-z0-9_./-]+$/.test(ref) || ref.includes('..')) return 'unknown';
    const sha = readFileSync(resolve(git, ref), 'utf8').trim(); return /^[a-f0-9]{40,64}$/.test(sha) ? sha : 'unknown';
  } catch { return 'unknown'; }
}
const buildId = process.env.GITHUB_SHA ?? `${localBaseSha()}-working-tree-unverified`;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  if (env.VITE_SENTRY_DSN && !publicDsn(env.VITE_SENTRY_DSN)) throw new Error('Use a supported hosted public Sentry DSN; private or invalid values are rejected.');
  return {
  plugins: [react()],
  build: { outDir: mode === 'e2e' ? 'dist-e2e' : 'dist' },
  define: { 'import.meta.env.VITE_BUILD_SHA': JSON.stringify(buildId) },
};
});
