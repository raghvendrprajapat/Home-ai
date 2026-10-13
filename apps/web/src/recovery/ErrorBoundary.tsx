import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { WorkspaceSession } from '../storage/workspace';
import { SaveControls } from '../storage/SaveControls';
import { useUi } from '../ui/state';
import { message } from '../i18n/messages';
import { Dialog } from '../ui/Dialog';
import { diagnostics } from '../diagnostics/controller';
function Recovery({ session }: { session: WorkspaceSession | null }) {
  const { locale } = useUi(), [confirm, setConfirm] = useState(false), title = useRef<HTMLHeadingElement>(null);
  useEffect(() => title.current?.focus(), []);
  return <main className="workspace"><h1>GharPlan</h1><h2 tabIndex={-1} ref={title}>{message(locale, 'crashTitle')}</h2>
    <p role="alert">{message(locale, 'crashHelp')}</p>
    {session && <SaveControls store={session.store} session={session} />}
    <p>{message(locale, session ? 'crashBackupFirst' : 'crashNoSession')}</p>
    <button onClick={() => setConfirm(true)}>{message(locale, 'crashReload')}</button>{confirm && <Dialog title={message(locale, 'crashConfirm')} busy={false} onCancel={() => setConfirm(false)}><p>{message(locale, 'crashLoss')}</p>
      <button onClick={() => location.reload()}>{message(locale, 'crashReloadNow')}</button><button onClick={() => setConfirm(false)}>{message(locale, 'cancel')}</button></Dialog>}
  </main>;
}
export class ErrorBoundary extends Component<{ children: ReactNode; session: WorkspaceSession | null }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { diagnostics.report('render-crash'); }
  render() { return this.state.failed ? <Recovery session={this.props.session} /> : this.props.children; }
}
