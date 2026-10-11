import { useEffect, useState, useSyncExternalStore } from 'react';
import { parseProject, ProjectStore } from '@gharplan/core-model';
import { formatArea } from '@gharplan/geometry';
import sample from '../../../docs/examples/sample-project.json';
import { PlanCanvas } from './editor/PlanCanvas';
import { junctionMoves } from './editor/view2d';
import './app.css';

function createDemo(): ProjectStore {
  const parsed = parseProject(JSON.stringify(sample));
  if (!parsed.ok) throw new Error('Bundled sample project failed validation.');
  return new ProjectStore(parsed.document, `editor_${crypto.randomUUID()}`);
}
export function App() {
  const [store] = useState(createDemo), snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [selected, setSelected] = useState('j2'), [message, setMessage] = useState('Choose a corner and make this space your own.');
  const [x, setX] = useState(''), [y, setY] = useState(''), [showGrid, setShowGrid] = useState(true), [fit, setFit] = useState(0);
  const corner = snapshot.document.junctions.find(j => j.id === selected);
  useEffect(() => { setX(String(corner?.x ?? '')); setY(String(corner?.y ?? '')); }, [corner]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) store.redo(); else store.undo(); }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); store.redo(); }
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [store]);
  const totalArea = snapshot.derived.faces.reduce((n, r) => n + r.clearAreaMm2, 0);
  return <main className="workspace">
    <header className="app-header">
      <div className="brand"><span className="brand-mark" aria-hidden="true">⌂</span><h1>GharPlan</h1><span className="brand-tag">MAKE ROOM FOR YOUR IDEAS</span></div>
      <div className="memory-status"><span aria-hidden="true" /> Demo · in memory only</div>
    </header>
    <section className="project-bar" aria-label="Project information">
      <div><span className="eyebrow">YOUR WORKSPACE</span><h2>A place to call home<span className="project-label">Sample 1BHK</span></h2></div>
      <div className="plan-summary"><span>{snapshot.document.rooms.length} rooms</span><strong data-testid="total-area">{formatArea(totalArea)} <small>m² clear area</small></strong></div>
    </section>
    <div className="editor-layout">
      <section className="drawing-panel" aria-label="Floor plan editor">
        <div className="editor-toolbar">
          <div className="view-tabs"><span className="active-tab">▧ &nbsp; 2D plan</span><span className="future-tab">3D · next</span></div>
          <div className="canvas-actions"><button onClick={() => setFit(n => n + 1)} aria-label="Fit floor plan">Fit plan</button><label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid</label></div>
        </div>
        <PlanCanvas store={store} snapshot={snapshot} selected={selected} onSelect={setSelected} onMessage={setMessage} zoomRequest={fit} showGrid={showGrid} />
        <footer className="editor-footer"><span role="status" aria-live="polite">{message}</span><span>Ground floor · mm</span></footer>
      </section>
      <aside className="inspector" aria-label="Plan controls">
        <div className="inspector-title"><span className="eyebrow">PRECISION FIRST</span><h3>Shape your space</h3><p>Move a corner. Connected walls stay aligned, and room areas update together.</p></div>
        <div className="history-buttons"><button disabled={!snapshot.canUndo} onClick={() => { store.undo(); setMessage('Last edit undone.'); }} aria-label="Undo">↶ &nbsp; Undo</button><button disabled={!snapshot.canRedo} onClick={() => { store.redo(); setMessage('Edit restored.'); }} aria-label="Redo">↷ &nbsp; Redo</button></div>
        <form onSubmit={event => {
          event.preventDefault(); const point: [number, number] = [Number(x), Number(y)];
          if (!corner || !x.trim() || !y.trim() || !point.every(Number.isSafeInteger)) { setMessage('Enter both coordinates in whole millimetres.'); return; }
          const result = store.execute({ id: `coordinate_${snapshot.localGeneration}`, baseGeneration: snapshot.localGeneration, type: 'MoveJunctions', moves: junctionMoves(snapshot.document, selected, point) });
          setMessage(result.ok ? result.changed ? 'Corner updated. Undo is available.' : 'The corner is already at these coordinates.' : result.errors[0]?.message ?? 'Edit rejected.');
        }}>
          <label className="field-label" htmlFor="corner">Selected corner</label>
          <select id="corner" value={selected} onChange={event => setSelected(event.target.value)}>{snapshot.document.junctions.map((j, i) => <option key={j.id} value={j.id}>Corner {i + 1} · {j.x}, {j.y} mm</option>)}</select>
          <div className="coordinate-fields"><label>X position <span>mm</span><input aria-label="Corner X coordinate" type="number" step="1" min="-100000" max="100000" value={x} onChange={e => setX(e.target.value)} required /></label><label>Y position <span>mm</span><input aria-label="Corner Y coordinate" type="number" step="1" min="-100000" max="100000" value={y} onChange={e => setY(e.target.value)} required /></label></div>
          <button className="primary-button" type="submit">Apply coordinates <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3M3 3h10v10" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></button>
        </form>
        <section className="room-list" aria-label="Room areas"><div className="section-heading"><h3>Inside your plan</h3><span>{snapshot.document.rooms.length} ROOMS</span></div>
          {snapshot.derived.faces.map((face, i) => <div className="room-row" key={face.roomId}><span className={`room-swatch swatch-${i % 2}`} aria-hidden="true" /><div><strong>{snapshot.document.rooms.find(r => r.id === face.roomId)?.name}</strong><small>{face.smallSpaceWarning ? 'Very small space — shaft/niche?' : 'Clear inside area'}</small></div><span data-testid={`area-${face.roomId}`}>{formatArea(face.clearAreaMm2)} <small>m²</small></span></div>)}
        </section>
        <div className="tip"><span aria-hidden="true">✦</span><p><strong>Measured, not guessed.</strong><br />Areas exclude the actual wall thickness. Undo restores the complete drawing.</p></div>
      </aside>
    </div>
    <div className="workbench-note">This is an editable proof of concept. Download and autosave arrive with the saving task; reloading currently restores the sample.</div>
  </main>;
}
