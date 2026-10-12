import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkspaceRoot } from './storage/WorkspaceRoot';
import { inspectWorkspace } from './storage/workspace';
const PerfPage = lazy(() => import('./perf/PerfPage'));

const container = document.getElementById('root');

if (!container) {
  throw new Error('The application root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    {window.location.pathname === '/perf' ? <Suspense fallback={<main>Loading performance lab…</main>}><PerfPage /></Suspense> : <WorkspaceRoot startup={inspectWorkspace()} />}
  </StrictMode>,
);
