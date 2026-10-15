import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
export function Dialog({ title, busy, onCancel, children, isolateKeyboard=false, className='' }: { title: string; busy: boolean; onCancel(): void; children: ReactNode; isolateKeyboard?:boolean;className?:string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!, previous = document.activeElement;
    element.showModal();
    element.querySelector<HTMLElement>('input, select, button')?.focus();
    return () => { element.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={dialog} className={`project-dialog ${className}`} aria-label={title} onKeyDown={event=>{if(isolateKeyboard)event.stopPropagation();}} onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <h2>{title}</h2>{children}
  </dialog>;
}
