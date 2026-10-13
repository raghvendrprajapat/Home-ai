import { publicDsn } from './config';
export type DiagnosticCode = 'render-crash' | 'startup-failed';
export interface Reporter { report(code: DiagnosticCode): void; close(): void }
export interface DiagnosticState { consent: boolean; status: 'off' | 'unconfigured' | 'loading' | 'ready' | 'failed' }
export class DiagnosticController {
  private state: DiagnosticState;
  private listeners = new Set<() => void>();
  private reporter: Reporter | null = null;
  private epoch = 0;
  private counts = new Map<DiagnosticCode, number>();
  readonly dsn: string | null;
  constructor(dsn: unknown, private load: (dsn: string, allowed: () => boolean) => Promise<Reporter>) {
    this.dsn = publicDsn(dsn); this.state = { consent: false, status: 'off' };
  }
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private update(state: DiagnosticState) { this.state = state; this.listeners.forEach(fn => fn()); }
  start() { if (this.state.consent && this.dsn && !this.reporter && this.state.status !== 'loading') void this.enable(); }
  setConsent(consent: boolean) {
    ++this.epoch; this.reporter?.close(); this.reporter = null; this.counts.clear();
    this.update({ consent, status: consent && !this.dsn ? 'unconfigured' : 'off' });
    this.start();
  }
  private async enable() {
    const epoch = this.epoch, dsn = this.dsn!;
    this.update({ consent: true, status: 'loading' });
    const allowed = () => this.state.consent && this.epoch === epoch;
    try { const reporter = await this.load(dsn, allowed); if (!allowed()) { reporter.close(); return; } this.reporter = reporter; this.update({ consent: true, status: 'ready' }); }
    catch { if (allowed()) this.update({ consent: true, status: 'failed' }); }
  }
  report(code: DiagnosticCode) {
    if (!['render-crash', 'startup-failed'].includes(code) || !this.state.consent || this.state.status !== 'ready') return;
    const count = this.counts.get(code) ?? 0; if (count >= 3) return;
    this.counts.set(code, count + 1);
    try { this.reporter?.report(code); } catch { /* Diagnostics never blocks drawing or backup. */ }
  }
}
export const diagnostics = new DiagnosticController(import.meta.env.VITE_SENTRY_DSN, async (dsn, allowed) => {
  const sdk = await import('./sentry'); return sdk.createReporter(dsn, allowed);
});
