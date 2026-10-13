import { useEffect, useSyncExternalStore } from 'react';
import { diagnostics } from './controller';
import { message } from '../i18n/messages';
import { useUi } from '../ui/state';
export function DiagnosticSettings() {
  const { locale } = useUi(), state = useSyncExternalStore(diagnostics.subscribe, diagnostics.getSnapshot);
  useEffect(() => diagnostics.start(), []);
  const status = { off: 'diagnosticsOff', unconfigured: 'diagnosticsUnavailable', loading: 'diagnosticsLoading', ready: 'diagnosticsReady', failed: 'diagnosticsFailed' } as const;
  return <section><h3>{message(locale, 'diagnosticsTitle')}</h3><p>{message(locale, 'diagnosticsPrivacy')}</p>
    <label><input type="checkbox" checked={state.consent} onChange={e => diagnostics.setConsent(e.target.checked)} />{message(locale, 'diagnosticsConsent')}</label>
    <p role="status">{message(locale, status[state.status])}</p>
  </section>;
}
