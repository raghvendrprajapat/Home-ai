import { expect, it, vi } from 'vitest';
import { DiagnosticController } from './controller';
import { publicDsn } from './config';
const dsn = 'https://0123456789abcdef0123456789abcdef@o123.ingest.us.sentry.io/123';
const reporter = () => ({ report: vi.fn(), close: vi.fn() });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
it('public DSN admits only supported public hosted keys; excludes private keys and untrusted targets', () => {
  expect(publicDsn(dsn)).toBe(dsn);
  for (const value of ['', 'secret', dsn.replace('https:', 'http:'), dsn.replace('@', ':private@'), dsn + '?drawing=private', dsn.replace('o123.ingest.us.sentry.io', 'example.com'), dsn + '#secret', dsn.replace('/123', '/project/file'), null]) expect(publicDsn(value)).toBeNull();
});
it('session consent defaults off and never restores previous opt-in; absent DSN never loads or sends', async () => {
  const load = vi.fn(async () => reporter()); const c = new DiagnosticController(dsn, load);
  c.start(); c.report('render-crash'); expect(load).not.toHaveBeenCalled();
  c.setConsent(true); await tick(); expect(c.getSnapshot().status).toBe('ready');
  const restarted = new DiagnosticController(dsn, load); restarted.start(); expect(restarted.getSnapshot().consent).toBe(false);
  const missing = new DiagnosticController('', load); missing.setConsent(true); expect(missing.getSnapshot().status).toBe('unconfigured'); expect(load).toHaveBeenCalledTimes(1);
});
it('revocation during lazy load closes stale client; a subsequent consent creates a fresh reporter', async () => {
  const old = reporter(), fresh = reporter(); let done!: (value: ReturnType<typeof reporter>)=>void;
  const load = vi.fn().mockImplementationOnce(() => new Promise(resolve => { done = resolve; })).mockResolvedValue(fresh);
  const c = new DiagnosticController(dsn, load); c.setConsent(true); c.setConsent(false); done(old); await tick();
  expect(old.close).toHaveBeenCalledTimes(1); expect(c.getSnapshot().status).toBe('off'); c.report('render-crash'); expect(old.report).not.toHaveBeenCalled();
  c.setConsent(true); await tick(); c.report('render-crash'); expect(fresh.report).toHaveBeenCalledWith('render-crash');
});
it('reports only fixed codes with bounded per-session count; failures cannot break saving; revoked gate stays closed', async () => {
  const r = reporter(); let allowed!: ()=>boolean;
  const c = new DiagnosticController(dsn, async (_,gate) => { allowed = gate; return r; }); c.setConsent(true); await tick();
  for(let i=0;i<10;i++) c.report('render-crash'); expect(r.report).toHaveBeenCalledTimes(3);
  c.report('private drawing' as 'render-crash'); expect(r.report).toHaveBeenCalledTimes(3);
  r.report.mockImplementation(()=>{throw new Error('offline');}); expect(()=>c.report('startup-failed')).not.toThrow();
  c.setConsent(false); expect(allowed()).toBe(false); c.report('startup-failed'); expect(r.close).toHaveBeenCalledOnce();
  const failed = new DiagnosticController(dsn, async()=>{throw new Error('network');});failed.setConsent(true); await tick(); expect(failed.getSnapshot().status).toBe('failed');
});
