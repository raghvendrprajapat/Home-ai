// @vitest-environment jsdom
import {afterEach,it,expect} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../docs/examples/sample-project.json';
import {FurnitureControls} from './editor/FurnitureControls';
import {FurnitureAdvisories} from './editor/furniture-advisories';
afterEach(cleanup);
it('optional geometry failure is visible but precise property Apply/Undo remain atomic',()=>{
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'failed_assistance'),before=serializeProject(store.getSnapshot().document),f=store.getSnapshot().document.furniture[0]!,advisories=new FurnitureAdvisories({get:()=>{throw Error('work budget');}});
 render(<FurnitureControls store={store} selected={f.id} onSelect={()=>{}} onMessage={()=>{}} locale="en" advisories={advisories}/>);
 expect(screen.getByTestId('furniture-warning').getAttribute('data-available')).toBe('false');fireEvent.change(screen.getByLabelText('Furniture X position',{exact:true}),{target:{value:`${f.position.x+100} mm`}});fireEvent.click(screen.getByRole('button',{name:'Apply furniture changes'}));expect(store.getSnapshot().document.furniture[0]!.position.x).toBe(f.position.x+100);expect(store.getSnapshot().localGeneration).toBe(1);expect(store.undo()).toBe(true);expect(serializeProject(store.getSnapshot().document)).toBe(before);
});
