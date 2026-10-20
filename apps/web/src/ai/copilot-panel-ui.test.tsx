// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import {CopilotPanel} from './CopilotPanel';
import {standInCopilot} from './copilot';
import type {CopilotProvider} from './copilot';
import {standInAi} from './stand-in';

// D76 M3 Claude-authored UI checks for the Copilot chat on the fixture (7 walls = 14 wall sides, 2 rooms).
afterEach(cleanup);
function setup(provider:CopilotProvider=standInCopilot,onOpenDocument?:(document:ProjectDoc)=>void){
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'copilot_ui');
 render(<CopilotPanel store={store} locale="en" selectedRoomId={undefined} provider={provider} ai={standInAi} catalog={async()=>({assets:[]})} onOpenDocument={onOpenDocument}/>);
 return store;
}
const send=(text:string)=>{fireEvent.change(screen.getByRole('textbox',{name:'Ask Copilot'}),{target:{value:text}});fireEvent.click(screen.getByRole('button',{name:'Send'}));};
const lines=()=>[...document.querySelectorAll('.copilot-line p')].map(p=>p.textContent);

it('a request it cannot do gets the help reply and leaves the drawing byte-identical',async()=>{
 const store=setup(),before=serializeProject(store.getSnapshot().document);
 send('book a cab');
 await screen.findByText(/I can: make a 1BHK or 2BHK plan/);
 expect(lines()).toEqual(['book a cab',expect.stringContaining('Nothing was changed.')]);
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
 expect(store.getSnapshot().canUndo).toBe(false);
});
it('"deewar beige karo" paints all 14 wall sides as one Undo step; the newest message is last',async()=>{
 const store=setup(),before=serializeProject(store.getSnapshot().document);
 send('deewar beige karo');
 await screen.findByText('Painted 14 wall sides beige (inside and outside faces). Undo puts the old colours back.');
 expect(lines().at(-1)).toBe('Painted 14 wall sides beige (inside and outside faces). Undo puts the old colours back.');
 expect(store.getSnapshot().document.walls.every(w=>w.leftMaterial==='m_paint_beige'&&w.rightMaterial==='m_paint_beige')).toBe(true);
 store.undo();
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('a starter chip only fills the ask box; nothing is sent or changed until Send',()=>{
 const opened:ProjectDoc[]=[],store=setup(standInCopilot,doc=>opened.push(doc)),before=serializeProject(store.getSnapshot().document);
 fireEvent.click(screen.getByRole('button',{name:'Make a 2BHK'}));
 expect(screen.getByRole<HTMLInputElement>('textbox',{name:'Ask Copilot'}).value).toBe('Make a 2BHK');
 expect(lines()).toEqual([]);expect(opened).toEqual([]);
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('"Make a 2BHK" opens a new six-room project and leaves the open drawing untouched',async()=>{
 const opened:ProjectDoc[]=[],store=setup(standInCopilot,doc=>opened.push(doc)),before=serializeProject(store.getSnapshot().document);
 send('2BHK banao');
 await screen.findByText(/Opened a new 2BHK plan with 6 rooms/);
 expect(opened).toHaveLength(1);
 expect(opened[0]!.rooms.map(r=>r.type).sort()).toEqual(['bathroom','bedroom','bedroom','dining','kitchen','living']);
 expect(opened[0]!.id).not.toBe(store.getSnapshot().document.id);
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('a model answer that is not a known intent is treated as help, so a bad answer cannot edit the drawing',async()=>{
 const store=setup({kind:'server',read:async()=>({kind:'paintWalls',colour:'#000000',room:null})}),before=serializeProject(store.getSnapshot().document);
 send('paint walls black');
 await screen.findByText(/I can: make a 1BHK or 2BHK plan/);
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
it('a request for a room the floor does not have says so and changes nothing',async()=>{
 const store=setup(),before=serializeProject(store.getSnapshot().document);
 send('kitchen me tiles lagao');
 await screen.findByText('There is no Kitchen on this floor. Rooms here: Living, Bedroom.');
 expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
