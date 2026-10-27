// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {RoomPhotoPanel} from './RoomPhotoPanel';
import {preparePhoto} from './photo-prep';
import {encodeMask} from './mask';
import {MemorySessionPort,RoomSessions} from './room-sessions';
import type {RoomSession} from './room-sessions';

// D87 Claude-authored UI checks for "Recent room photos". jsdom has no canvas, IndexedDB or image decoding: the store
// is the in-memory port, and photo decoding is replaced (as in room-photo-ui.test.tsx).
vi.mock('./photo-prep',async original=>({...await original<typeof import('./photo-prep')>(),preparePhoto:vi.fn()}));
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 vi.mocked(preparePhoto).mockResolvedValue({width:40,height:30,data:new Uint8ClampedArray(40*30*4).fill(128)});
 let n=0;const Base=URL;vi.stubGlobal('URL',class extends Base {static createObjectURL=vi.fn(()=>`blob:recent-${++n}`);static revokeObjectURL=vi.fn();});
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const bytes=(n:number,v:number)=>new Uint8Array(n).fill(v);
// 10:30 IST on 20 and 25 October 2026 (05:00 UTC); en-IN shows "20 Oct 2026, …".
const DAY20=Date.UTC(2026,9,20,5,0),DAY25=Date.UTC(2026,9,25,5,0),DAY26=Date.UTC(2026,9,26,5,0);
function session(id:string,savedAt:number,labels:string[]):RoomSession{
 const mask=new Uint8Array(40*30);mask.fill(255,0,200);
 return {id,savedAt,width:40,height:30,photo:bytes(64,1),mask:encodeMask(mask),plane:null,options:labels.map((label,i)=>({id:`${id}-${i}`,label,jpeg:bytes(32,i+1)}))};
}
async function filled(){
 const store=new RoomSessions(new MemorySessionPort());
 await store.save(session('old',DAY20,['Option A']),bytes(8,9));
 await store.save(session('mid',DAY25,['Blue wall','Option B']),bytes(8,9));
 await store.save(session('new',DAY26,['Tiles','Laminate','Option C']),bytes(8,9));
 return store;
}

it('lists saved room photos newest first with date and number of options; deletes one, then all after a confirm',async()=>{
 const store=await filled();
 render(<RoomPhotoPanel locale="en" cloud={null} openSessions={async()=>store}/>);
 const recent=await screen.findByRole('region',{name:'Recent room photos'});
 expect(recent.textContent).toContain('Kept options are saved only on this device (the last 10 photos) until you delete them.');
 const opens=within(recent).getAllByRole('button').filter(b=>b.classList.contains('room-recent-open'));
 expect(opens.map(b=>b.textContent)).toEqual([`${new Date(DAY26).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}3 options`,
  `${new Date(DAY25).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}2 options`,`${new Date(DAY20).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}1 option`]);
 expect(opens[2]!.textContent).toContain('20 Oct 2026');
 await act(async()=>{fireEvent.click(within(recent).getByRole('button',{name:`Delete room photo from ${new Date(DAY25).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}`}));});
 expect((await store.list()).map(s=>s.id)).toEqual(['new','old']);
 expect(within(recent).getAllByRole('button').filter(b=>b.classList.contains('room-recent-open'))).toHaveLength(2);
 // "Delete all" asks first; Cancel keeps everything.
 fireEvent.click(within(recent).getByRole('button',{name:'Delete all'}));
 expect(within(recent).getByRole('alertdialog').textContent).toContain('Delete all 2 room photos saved on this device? This cannot be undone.');
 fireEvent.click(within(recent).getByRole('button',{name:'Cancel'}));expect((await store.list())).toHaveLength(2);
 fireEvent.click(within(recent).getByRole('button',{name:'Delete all'}));
 await act(async()=>{fireEvent.click(within(recent).getByRole('button',{name:'Yes, delete all'}));});
 expect(await store.list()).toEqual([]);
 expect(screen.queryByRole('region',{name:'Recent room photos'})).toBeNull();
});
it('reopening a saved room photo restores its kept options and area in the visualizer',async()=>{
 const store=await filled();
 render(<RoomPhotoPanel locale="en" cloud={null} openSessions={async()=>store}/>);
 const recent=await screen.findByRole('region',{name:'Recent room photos'});
 await act(async()=>{fireEvent.click(within(recent).getAllByRole('button').find(b=>b.classList.contains('room-recent-open'))!);});
 const view=await screen.findByRole('dialog',{name:'Room photo'});
 expect(await within(view).findByText('Kept options (3 of 4)')).toBeTruthy();
 expect(within(view).getAllByRole('listitem').map(li=>li.textContent)).toEqual(['Tiles','Laminate','Option C']);
 // The photo, then the newest option (shown as the result) were decoded from the stored JPEG bytes.
 const decoded=vi.mocked(preparePhoto).mock.calls.map(([f])=>f);expect(decoded).toHaveLength(2);
 expect(new Uint8Array(await decoded[0]!.arrayBuffer())).toEqual(bytes(64,1));expect(new Uint8Array(await decoded[1]!.arrayBuffer())).toEqual(bytes(32,3));
 // The area came back (Clear is possible) but there is no undo step before it.
 expect(within(view).getByRole('button',{name:'Clear area'}).hasAttribute('disabled')).toBe(false);
 expect(within(view).getByRole('button',{name:'Undo area change'}).hasAttribute('disabled')).toBe(true);
 expect(within(view).getByRole('button',{name:'Before / after'}).getAttribute('aria-pressed')).toBe('true');
 // Zoom controls: at fit, zoom out and Fit are off; zoom in is on.
 expect(within(view).getByRole('button',{name:'Zoom out'}).hasAttribute('disabled')).toBe(true);
 expect(within(view).getByRole('button',{name:'Zoom in'}).hasAttribute('disabled')).toBe(false);
 await act(async()=>{fireEvent.click(within(view).getByRole('button',{name:'Close room photo'}));});
 expect(screen.queryByRole('dialog')).toBeNull();
});
it('a missing or damaged saved photo says so; no device storage hides the list (Hindi too)',async()=>{
 const port=new MemorySessionPort(),store=new RoomSessions(port);await store.save(session('x',DAY20,['A']),bytes(4,1));
 port.sessions.delete('x');
 render(<RoomPhotoPanel locale="hi" cloud={null} openSessions={async()=>store}/>);
 const recent=await screen.findByRole('region',{name:'हाल की कमरे की फ़ोटो'});
 expect(recent.textContent).toContain('1 विकल्प');
 await act(async()=>{fireEvent.click(within(recent).getAllByRole('button').find(b=>b.classList.contains('room-recent-open'))!);});
 expect(screen.getByRole('alert').textContent).toBe('यह कमरे की फ़ोटो नहीं खुल सकी। आप इसे हटा सकते हैं।');
 expect(screen.queryByRole('dialog')).toBeNull();
 cleanup();
 render(<RoomPhotoPanel locale="en" cloud={null} openSessions={async()=>null}/>);
 await act(async()=>{await Promise.resolve();});
 expect(screen.getByRole('button',{name:'Choose room photo'})).toBeTruthy();
 expect(screen.queryByRole('region',{name:'Recent room photos'})).toBeNull();
});
