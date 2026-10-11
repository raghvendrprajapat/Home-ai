import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
const PerfPage = lazy(() => import('./perf/PerfPage'));

const container = document.getElementById('root');

if (!container) {
  throw new Error('The application root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    {window.location.pathname === '/perf' ? <Suspense fallback={<main>Loading performance lab…</main>}><PerfPage /></Suspense> : <App />}
  </StrictMode>,
);
