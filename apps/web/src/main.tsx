import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from './recovery/ErrorBoundary';
import { WorkspaceRoot } from './storage/WorkspaceRoot';
import { inspectWorkspace } from './storage/workspace';
import { sharedToken as readSharedToken } from './cloud/share-link';
const PerfPage = lazy(() => import('./perf/PerfPage'));
const SharedView = lazy(() => import('./cloud/SharedView').then(module => ({ default: module.SharedView })));
// FR-033 (D69): a view-only link opens its own read-only page instead of the editor.
const sharedToken = readSharedToken(window.location.hash);

const container = document.getElementById('root');

if (!container) {
  throw new Error('The application root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    {sharedToken ? <ErrorBoundary session={null}><Suspense fallback={<main>…</main>}><SharedView token={sharedToken} /></Suspense></ErrorBoundary> : window.location.pathname === '/perf' ? <Suspense fallback={<main>Loading performance lab…</main>}><PerfPage /></Suspense> : <ErrorBoundary session={null}><WorkspaceRoot startup={inspectWorkspace()} /></ErrorBoundary>}
  </StrictMode>,
);
