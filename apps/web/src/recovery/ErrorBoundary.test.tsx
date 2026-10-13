// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectStore, parseProject, serializeProject } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { ErrorBoundary } from './ErrorBoundary';
import { diagnostics } from '../diagnostics/controller';
import { uiStore } from '../ui/state';
function Crash(): never { throw new Error('Private drawing name must never be sent'); }
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers();uiStore.getState().setLocale('en');});
it('React render failure retains store ownership and exposes exact JSON; reload stays explicit and cancellable',()=>{
  const parsed=parseProject(JSON.stringify(sample));if(!parsed.ok)throw new Error('Invalid fixture');const store=new ProjectStore(parsed.document,'recovery-test');const original=serializeProject(store.getSnapshot().document);
  HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
  const report=vi.spyOn(diagnostics,'report');vi.spyOn(console,'error').mockImplementation(()=>undefined);
  vi.useFakeTimers();const blob=vi.fn(()=> 'blob:test'), BaseUrl=URL;vi.stubGlobal('URL',class extends BaseUrl { static createObjectURL=blob;static revokeObjectURL=vi.fn(); });vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>undefined);
  render(<ErrorBoundary session={{store,saving:null,warning:null}}><Crash /></ErrorBoundary>);
  expect(screen.getByRole('heading',{name:'The screen stopped working'})).toBeTruthy();expect(report).toHaveBeenCalledWith('render-crash');expect(store.getSnapshot().localGeneration).toBe(0);
  fireEvent.click(screen.getByRole('button',{name:'Export drawing'}));expect(blob).toHaveBeenCalledOnce();expect(serializeProject(store.getSnapshot().document)).toBe(original);
  fireEvent.click(screen.getByRole('button',{name:'Reload after saving a copy'}));expect(screen.getByRole('dialog')).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(screen.queryByRole('dialog')).toBeNull();vi.runAllTimers();
});
it('Hindi crash before a session offers recovery without inventing a drawing or a saved status',()=>{
  uiStore.getState().setLocale('hi');vi.spyOn(console,'error').mockImplementation(()=>undefined);render(<ErrorBoundary session={null}><Crash /></ErrorBoundary>);
  expect(screen.getByRole('heading',{name:'स्क्रीन ने काम करना बंद कर दिया'})).toBeTruthy();expect(screen.queryByTestId('save-status')).toBeNull();expect(screen.queryByRole('button',{name:'ड्रॉइंग एक्सपोर्ट करें'})).toBeNull();
});
