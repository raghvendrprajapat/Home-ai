// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {RoomPhotoPanel} from './RoomPhotoPanel';
import {preparePhoto} from './photo-prep';

// D85 Claude-authored UI checks. jsdom has no canvas or modal dialogs: getContext answers null and showModal only
// sets `open` (as in recovery/ErrorBoundary.test.tsx); photo decoding is replaced because jsdom cannot decode images.
vi.mock('./photo-prep',async original=>({...await original<typeof import('./photo-prep')>(),preparePhoto:vi.fn()}));
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 vi.mocked(preparePhoto).mockResolvedValue({width:40,height:30,data:new Uint8ClampedArray(40*30*4).fill(128)});
});
afterEach(cleanup);
const choose=(file:File)=>fireEvent.change(document.querySelector('input.viz-file')!,{target:{files:[file]}});
const photo=()=>new File([new Uint8Array(64)],'room.jpg',{type:'image/jpeg'});

it('explains the tool, shows the preview-only note and refuses non-pictures and big files before opening anything',()=>{
 render(<RoomPhotoPanel locale="en"/>);
 expect(screen.getByText('Preview only — colours and sizes from one photo are approximate. Check a real sample before buying.')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Choose room photo'})).toBeTruthy();
 choose(new File(['hello'],'notes.txt',{type:'text/plain'}));
 expect(screen.getByRole('alert').textContent).toBe('This file is not a picture. Choose a JPG or PNG photo.');
 choose(new File([new Uint8Array(15*1024*1024+1)],'huge.jpg',{type:'image/jpeg'}));
 expect(screen.getByRole('alert').textContent).toBe('This photo is too large. Choose a photo under 15 MB.');
 expect(screen.queryByRole('dialog')).toBeNull();expect(preparePhoto).not.toHaveBeenCalled();
});
it('a chosen photo opens the full-screen view; its keys never reach the editor and Close returns to the panel',async()=>{
 const editorKeys=vi.fn();window.addEventListener('keydown',editorKeys);
 try{
  render(<RoomPhotoPanel locale="en"/>);choose(photo());
  const view=await screen.findByRole('dialog',{name:'Room photo'});
  await screen.findByRole('button',{name:'Show result'});
  expect(view.textContent).toContain('Preview only — colours and sizes from one photo are approximate.');
  // Nothing chosen yet: the result asks for an area instead of changing anything.
  fireEvent.click(screen.getByRole('button',{name:'Show result'}));
  expect(screen.getByRole('alert').textContent).toBe('Choose an area on the photo first.');
  // Ctrl+Z inside the view undoes area steps only; the editor's window shortcut (drawing Undo) never hears it.
  fireEvent.keyDown(screen.getByRole('button',{name:'Show result'}),{key:'z',ctrlKey:true});
  fireEvent.keyDown(view,{key:'Escape'});
  expect(editorKeys).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Undo area change'}).hasAttribute('disabled')).toBe(true);
  // A picture needs the four corners first.
  fireEvent.click(screen.getByRole('button',{name:'Picture'}));
  expect(screen.getByText('A picture needs the 4 corners. Choose "4 corners" in step 1 and tap them first.')).toBeTruthy();
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Close room photo'}));await Promise.resolve();});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('button',{name:'Choose room photo'})).toBeTruthy();
 }finally{window.removeEventListener('keydown',editorKeys);}
});
it('a photo that cannot be decoded closes the view and says why, in Hindi too',async()=>{
 vi.mocked(preparePhoto).mockRejectedValue(new Error('decode'));
 render(<RoomPhotoPanel locale="hi"/>);
 expect(screen.getByRole('button',{name:'कमरे की फ़ोटो चुनें'})).toBeTruthy();
 choose(photo());
 expect((await screen.findByRole('alert')).textContent).toBe('यह फ़ोटो नहीं खुल सकी। दूसरी JPG या PNG आज़माएँ।');
 expect(screen.queryByRole('dialog')).toBeNull();
});
