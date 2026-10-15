// @vitest-environment jsdom
import {afterAll,afterEach,beforeAll,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent} from '@testing-library/react';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../docs/examples/sample-project.json';
import {PlanCanvas} from './editor/PlanCanvas';
/** Controlled-parent fault injection: deliberately retain the previous snapshot
 * and selection after a real core deletion. No Konva/GPU rendering is claimed. */
class TestPointer extends MouseEvent {
 readonly pointerId:number;readonly pointerType:string;readonly isPrimary:boolean;
 constructor(type:string,options:PointerEventInit={}){super(type,options);this.pointerId=options.pointerId??1;this.pointerType=options.pointerType??'mouse';this.isPrimary=options.isPrimary??true;}
}
const originals=new Map<string,PropertyDescriptor|undefined>();
beforeAll(()=>{for(const name of ['setPointerCapture','releasePointerCapture','hasPointerCapture']){originals.set(name,Object.getOwnPropertyDescriptor(HTMLElement.prototype,name));Object.defineProperty(HTMLElement.prototype,name,{configurable:true,value:()=>name==='hasPointerCapture'?false:undefined});}vi.stubGlobal('PointerEvent',TestPointer);});
afterEach(cleanup);
afterAll(()=>{for(const [name,descriptor]of originals)if(descriptor)Object.defineProperty(HTMLElement.prototype,name,descriptor);else Reflect.deleteProperty(HTMLElement.prototype,name);vi.unstubAllGlobals();});
function staleSelection(){
 const store=new ProjectStore(structuredClone(sample) as ProjectDoc,'stale_ui'),snapshot=store.getSnapshot(),item=snapshot.document.furniture[0]!,onPick=vi.fn();
 render(<PlanCanvas store={store} snapshot={snapshot} selected="" onSelect={()=>{}} onMessage={()=>{}} zoomRequest={0} showGrid={false} selection={[{kind:'furniture',id:item.id}]} onPick={onPick}/>);
 expect(store.execute({type:'DeleteFurniture',id:'delete_stale_ui',baseGeneration:0,furnitureId:item.id}).ok).toBe(true);
 return {store,item,onPick,deleted:serializeProject(store.getSnapshot().document),host:screen.getByTestId('plan-canvas')};
}
function errorsDuring(action:()=>void):string[]{const errors:string[]=[],listen=(event:ErrorEvent)=>{errors.push(event.error instanceof Error?event.error.message:event.message);event.preventDefault();};window.addEventListener('error',listen);try{action();}finally{window.removeEventListener('error',listen);}return errors;}
it('SYNC-006 stale controlled selection after deletion cannot throw or edit from the focused canvas keyboard',()=>{
 const {store,host,deleted}=staleSelection();host.focus();expect(errorsDuring(()=>fireEvent.keyDown(window,{key:'ArrowRight'}))).toEqual([]);expect(serializeProject(store.getSnapshot().document)).toBe(deleted);expect(store.getSnapshot().localGeneration).toBe(1);
});
it('SYNC-006 stale pointer index after deletion cannot publish selection, begin an edit or throw',()=>{
 const {store,item,host,deleted,onPick}=staleSelection();expect(errorsDuring(()=>fireEvent.pointerDown(host,{pointerId:1,pointerType:'mouse',button:0,clientX:item.position.x*.06,clientY:item.position.y*.06}))).toEqual([]);expect(onPick).not.toHaveBeenCalled();expect(serializeProject(store.getSnapshot().document)).toBe(deleted);expect(store.getSnapshot().localGeneration).toBe(1);
});
it('SYNC-006 stale keyboard handle activation after deletion is contained without another command',()=>{
 const {store,deleted}=staleSelection(),handle=screen.getByTestId('furniture-rotate-handle');expect(errorsDuring(()=>fireEvent.click(handle,{detail:0}))).toEqual([]);expect(serializeProject(store.getSnapshot().document)).toBe(deleted);expect(store.getSnapshot().localGeneration).toBe(1);
});
