/** Test build only; Vite removes this lazy import and its code in production. */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
export default function FaultGate({ children }: { children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const fail = () => setFailed(true); window.addEventListener('gharplan-e2e-render-fault', fail);
    return () => window.removeEventListener('gharplan-e2e-render-fault', fail);
  }, []);
  if (failed) throw new Error('Controlled E2E render fault');
  return children;
}
