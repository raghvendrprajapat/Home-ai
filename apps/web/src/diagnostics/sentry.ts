import { BrowserClient, makeFetchTransport, Scope } from '@sentry/browser';
import type { Event, ErrorEvent } from '@sentry/browser';
import type { DiagnosticCode, Reporter } from './controller';
/** Reconstruct instead of redacting: everything except these constants is dropped. */
export function safeEvent(event: Event, allowed: boolean): ErrorEvent | null {
  if (!allowed || event.type || !['render-crash', 'startup-failed'].includes(event.message ?? '')) return null;
  return { type: undefined, message: event.message!, level: 'error', platform: 'javascript', sdk: { name: 'sentry.javascript.browser', version: '11.6.0', settings: { infer_ip: 'never' } },
    ...(event.event_id && /^[a-f0-9]{32}$/.test(event.event_id) ? { event_id: event.event_id } : {}),
    ...(Number.isFinite(event.timestamp) ? { timestamp: event.timestamp! } : {}),
  };
}
export function createReporter(dsn: string, allowed: () => boolean, fetcher: typeof fetch = globalThis.fetch.bind(globalThis)): Reporter {
  // Isolated client: no global init, automatic errors, breadcrumbs, sessions, tracing or replay.
  const client = new BrowserClient({ dsn, integrations: [], transport: options => {
    const transport = makeFetchTransport({ ...options, fetchOptions: { credentials: 'omit', referrerPolicy: 'no-referrer' } }, (url, init) => allowed() ? fetcher(url, init) : Promise.resolve(new Response(null, { status: 204 })));
    return { send: envelope => {
      if (!allowed()) return Promise.resolve({});
      // Drop attachments, tracing/SDK/global-scope metadata and every non-event item at the final transport boundary.
      const candidate = envelope[1].find(item => item[0].type === 'event');
      const event = candidate && typeof candidate[1] === 'object' ? safeEvent(candidate[1] as Event, allowed()) : null;
      if (!event || !event.event_id) return Promise.resolve({});
      return transport.send([{ event_id: event.event_id, sent_at: new Date().toISOString() }, [[{ type: 'event' }, event]]]);
    }, flush: timeout => transport.flush(timeout) };
  }, stackParser: () => [], dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, graphQL: { document: false, variables: false }, genAI: { inputs: false, outputs: false }, databaseQueryData: false, queues: false, stackFrameVariables: false, frameContextLines: 0 }, sendClientReports: false,
  beforeSend: event => safeEvent(event, allowed()) });
  const scope = new Scope(); scope.setClient(client);
  return { report: (code: DiagnosticCode) => { if (allowed()) scope.captureEvent({ message: code, level: 'error' }); },
    close: () => { void Promise.resolve(client.close(0)).catch(() => undefined); } };
}
