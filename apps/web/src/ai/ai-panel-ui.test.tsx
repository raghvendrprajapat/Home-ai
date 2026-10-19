// @vitest-environment jsdom
import {afterEach,expect,it} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import {ProjectStore} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../../docs/examples/sample-project.json';
import type {CatalogAsset} from '../catalog/catalog';
import {AiFurniturePanel} from './AiFurniturePanel';
import type {AiProvider} from './furniture-suggest';

// D73 audit fixes, Claude-authored: answers that arrive after the person moved on are dropped.
afterEach(cleanup);
const asset=(id:string,w:number,d:number):CatalogAsset=>({id,version:1,name_en:id,name_hi:id,category:'test',tags:[],dims:{w,d,h:800},lods:[],thumb:{path:'',sha256:'',bytes:0,width:256,height:256}});
const A=asset('a_big',1800,600),B=asset('a_small',1200,600);
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((s,f)=>{resolve=s;reject=f;});return {promise,resolve,reject};}
function setup(provider:Partial<AiProvider>){
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'ai_panel_ui');
 const full:AiProvider={kind:'stand-in',suggestFurniture:async()=>[{assetId:A.id,options:[A.id,B.id]}],suggestLayout:async()=>({layouts:[]}),planFromImage:async()=>({rooms:[]}),...provider};
 render(<AiFurniturePanel store={store} locale="en" selectedRoomId={undefined} provider={full} catalog={async()=>({assets:[A,B]})} onPlace={()=>{}}/>);
 return store;
}
const ideas=()=>document.querySelectorAll('ul.ai-ideas > li');

it('ideas that arrive after the room was changed are dropped',async()=>{
 const answer=deferred<unknown>();setup({suggestFurniture:()=>answer.promise});
 fireEvent.change(screen.getByLabelText('Room for ideas'),{target:{value:'r_living'}});
 fireEvent.click(screen.getByRole('button',{name:'Suggest furniture for this room'}));
 await screen.findByText('Finding furniture that fits…',{exact:false});
 fireEvent.change(screen.getByLabelText('Room for ideas'),{target:{value:'r_bed'}});
 await act(async()=>{answer.resolve([{assetId:A.id}]);await answer.promise;});
 expect(ideas()).toHaveLength(0);
 expect(screen.queryByRole('status')).toBeNull();
});
it('ideas that arrive after the size was changed are dropped',async()=>{
 const answer=deferred<unknown>();setup({suggestFurniture:()=>answer.promise});
 fireEvent.click(screen.getByRole('button',{name:'Suggest furniture for this room'}));
 fireEvent.change(screen.getByLabelText('Furniture size'),{target:{value:'compact'}});
 await act(async()=>{answer.resolve([{assetId:A.id}]);await answer.promise;});
 expect(ideas()).toHaveLength(0);
});
it('a layout that arrives after an idea was swapped is dropped, and a failed layout says so',async()=>{
 const layout=deferred<unknown>();setup({suggestLayout:()=>layout.promise});
 fireEvent.click(screen.getByRole('button',{name:'Suggest furniture for this room'}));
 await screen.findByRole('button',{name:'Show another option'});
 fireEvent.click(screen.getByRole('button',{name:'Arrange these in the room'}));
 await screen.findByText('Arranging the pieces…');
 fireEvent.click(screen.getByRole('button',{name:'Show another option'}));
 expect(ideas()[0]!.getAttribute('data-asset-id')).toBe(B.id);
 await act(async()=>{layout.resolve({layouts:[]});await layout.promise;});
 expect(screen.queryByTestId('ai-layout')).toBeNull();
 cleanup();
 setup({suggestLayout:()=>Promise.reject(new Error('down'))});
 fireEvent.click(screen.getByRole('button',{name:'Suggest furniture for this room'}));
 fireEvent.click(await screen.findByRole('button',{name:'Arrange these in the room'}));
 expect((await screen.findByRole('alert')).textContent).toBe('A layout could not be made. Nothing was changed; try again.');
});
