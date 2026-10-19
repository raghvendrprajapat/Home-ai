// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ProjectStore } from '@gharplan/core-model';
import type { Command, ProjectDoc } from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import { SharedView } from './SharedView';
import type { CloudSession } from './session';
import { renderPlanImage } from '../editor/plan-image';
// Audit 2026-10-19 (FR-033 + FR-034). Claude-authored tests, not independent fixtures.
vi.mock('../editor/plan-image', () => ({ renderPlanImage: vi.fn(async () => ({ blob: new Blob(['png']), layout: {} })) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.mocked(renderPlanImage).mockClear(); });
const signedOut = { status: 'signed-out', user: null };
const cloudWith = (document: ProjectDoc) => ({ subscribe: () => () => undefined, getSnapshot: () => signedOut, ensure: async () => ({ getShared: async () => ({ ok: true, serverRevision: 1, name: document.name, document }) }) }) as unknown as CloudSession;
const urls = () => { let n = 0; const Base = URL; vi.stubGlobal('URL', class extends Base { static createObjectURL = vi.fn(() => `blob:plan-${++n}`); static revokeObjectURL = vi.fn(); }); };
const rooms = (list: HTMLElement) => within(list).getAllByRole('listitem').map(li => li.textContent);

it('audit: a one-floor shared drawing keeps one plan image and one room list, with no floor headings', async () => {
  urls(); const { container } = render(<SharedView token={'a'.repeat(64)} cloud={cloudWith(structuredClone(sample) as ProjectDoc)} />);
  await screen.findByRole('img', { name: `Floor plan of ${sample.name}` });
  expect(vi.mocked(renderPlanImage)).toHaveBeenCalledTimes(1); expect(vi.mocked(renderPlanImage).mock.calls[0]![0].document.walls).toHaveLength(7);
  expect(container.querySelectorAll('.shared-floor, h3')).toHaveLength(0); expect(container.querySelectorAll('.shared-rooms')).toHaveLength(1);
  expect(rooms(container.querySelector('.shared-rooms')!)).toEqual(['Living: 20.64 m²', 'Bedroom: 15.87 m²']);
});

it('audit: a two-floor shared drawing shows each floor separately, lowest first, with its own plan and rooms', async () => {
  const store = new ProjectStore(structuredClone(sample) as ProjectDoc, 'shared_test');
  expect(store.execute({ id: 'add_floor', baseGeneration: 0, type: 'AddFloor', name: 'Upar', copyOutlineFrom: 'f0' } as Command).ok).toBe(true);
  const document = structuredClone(store.getSnapshot().document) as ProjectDoc, upperRoom = document.rooms.find(r => r.floorId !== 'f0')!;
  document.floors.reverse(); // order in the file must not matter: floors are shown by level
  urls(); const { container } = render(<SharedView token={'b'.repeat(64)} cloud={cloudWith(document)} />);
  await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
  const sections = [...container.querySelectorAll<HTMLElement>('.shared-floor')];
  expect(sections.map(s => within(s).getByRole('heading', { level: 3 }).textContent)).toEqual(['Ground floor', 'Upar']);
  expect(within(sections[0]!).getByRole('img').getAttribute('alt')).toBe(`Floor plan of ${sample.name}, Ground floor`);
  expect(within(sections[1]!).getByRole('img').getAttribute('alt')).toBe(`Floor plan of ${sample.name}, Upar`);
  // Ground: the two H.6 rooms. Upper (outer walls only): (8000-230) x (5000-230) mm = 37,062,900 mm² = 37.06 m².
  expect(rooms(within(sections[0]!).getByRole('list'))).toEqual(['Living: 20.64 m²', 'Bedroom: 15.87 m²']);
  expect(rooms(within(sections[1]!).getByRole('list'))).toEqual([`${upperRoom.name}: 37.06 m²`]);
  // Each plan image is drawn from that floor only: 7 ground walls, 6 copied outer walls upstairs.
  const drawn = vi.mocked(renderPlanImage).mock.calls.map(c => c[0].document);
  expect(drawn.map(d => d.walls.length)).toEqual([7, 6]); expect(drawn[0]!.walls.every(w => w.floorId === 'f0')).toBe(true); expect(drawn[1]!.walls.every(w => w.floorId !== 'f0')).toBe(true);
});
