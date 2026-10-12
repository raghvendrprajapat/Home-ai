import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
export function Dialog({ title, busy, onCancel, children }: { title: string; busy: boolean; onCancel(): void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal();
    element.querySelector<HTMLElement>('input, select, button')?.focus();
    return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className="project-dialog" aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}
