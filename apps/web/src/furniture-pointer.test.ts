// @vitest-environment jsdom
import {afterEach,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {ProjectStore,serializeProject} from '@gharplan/core-model';
import type {ProjectDoc} from '@gharplan/core-model';
import sample from '../../../docs/examples/sample-project.json';
import {FurniturePointer} from './render3d/furniture-pointer';
import {SceneAdapter} from './render3d/scene';
import {buildScene} from './render3d/mesh';
const disposers:(()=>void)[]=[];
afterEach(()=>{for(const dispose of disposers.splice(0).reverse())dispose();vi.unstubAllGlobals();vi.useRealTimers();});
class Pointer extends MouseEvent {readonly pointerId:number;readonly pointerType:string;readonly isPrimary:boolean;constructor(type:string,options:PointerEventInit){super(type,options);this.pointerId=options.pointerId??1;this.pointerType=options.pointerType??'mouse';this.isPrimary=options.isPrimary??true;}}
function setup(rotation=0){
 const d=structuredClone(sample) as ProjectDoc;d.walls=[];d.junctions=[];d.rooms=[];d.openings=[];d.furniture=[{...d.furniture[0]!,position:{x:0,y:0},size:{w:1000,d:600,h:800},elevation:0,rotationDeg:rotation}];
 const store=new ProjectStore(d,'three_pointer'),base=store.getSnapshot().document,id=base.furniture[0]!.id,adapter=new SceneAdapter();adapter.apply(buildScene(d),base);
 const camera=new THREE.PerspectiveCamera(90,4/3,.01,1000);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 const canvas=document.createElement('canvas');document.body.append(canvas);const rect={left:0,top:0,width:800,height:600,right:800,bottom:600,x:0,y:0,toJSON:()=>({})};canvas.getBoundingClientRect=()=>rect;
 const captures=new Set<number>();canvas.setPointerCapture=id=>{captures.add(id);};canvas.hasPointerCapture=id=>captures.has(id);canvas.releasePointerCapture=id=>{captures.delete(id);};
 let selected:string|undefined=id,eligible=true,preview:ReturnType<ProjectStore['getSnapshot']>['document']|null=null,frameId=0;const frames=new Map<number,FrameRequestCallback>();
 vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{const n=++frameId;frames.set(n,cb);return n;});vi.stubGlobal('cancelAnimationFrame',(n:number)=>frames.delete(n));
 const controls={enabled:true,enableDamping:true,autoRotate:true,target:new THREE.Vector3(),update:vi.fn()},commits:number[]=[],status=vi.fn(),failure=vi.fn();
 const hooks:ConstructorParameters<typeof FurniturePointer>[4]={eligible:()=>eligible,selected:()=>selected,start:()=>{},hit:()=>({id,point:[.2,.8,-.1]}),preview:r=>{preview=r?.document??null;adapter.refreshFurniture(preview??base);},status,failed:failure,committed:()=>{commits.push(adapter.group.children.find(o=>o.userData.entityId===id)!.position.x);}};
 const pointer=new FurniturePointer(store,canvas,camera,controls,hooks);
 for(const [name,kind]of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','cancel']] as const){const cb=(e:Event)=>pointer.dispatch(kind,e as PointerEvent);document.addEventListener(name,cb,true);disposers.push(()=>document.removeEventListener(name,cb,true));}
 disposers.push(()=>{pointer.dispose();adapter.dispose();canvas.remove();});
 const pixels=300/9.2,point=(x:number,z:number)=>({clientX:400+x*pixels,clientY:300+z*pixels}),send=(type:string,x:number,z:number,options:PointerEventInit={},target:EventTarget=canvas)=>{const e=new Pointer(type,{bubbles:true,cancelable:true,button:0,buttons:1,...point(x,z),...options});target.dispatchEvent(e);return e;};
 const flush=()=>{for(const [n,cb]of [...frames]){frames.delete(n);cb(performance.now());}};
 return {store,base,id,pointer,camera,controls,canvas,rect,hooks,send,flush,frames,captures,commits,status,failure,get preview(){return preview;},select:(id:string|undefined)=>{selected=id;},unavailable:()=>{eligible=false;}};
}
it('3D off-centre hit-height movement previews actual scene matrices, freezes camera, restores canonical BEFORE commit and has one exact Undo',()=>{
 const h=setup(),before=serializeProject(h.base),pose=h.camera.position.toArray();h.pointer.setMode('move',false);h.send('pointerdown',.2,-.1);expect(h.pointer.active).toBe(true);expect(h.controls).toMatchObject({enabled:false,enableDamping:false,autoRotate:false});h.send('pointermove',1.2,.4);h.flush();expect(h.preview!.furniture[0]!.position).toEqual({x:1000,y:500});expect(serializeProject(h.store.getSnapshot().document)).toBe(before);expect(h.camera.position.toArray()).toEqual(pose);h.send('pointerup',1.2,.4);expect(h.commits).toEqual([0]);expect(h.store.getSnapshot().document.furniture[0]!.position).toEqual({x:1000,y:500});expect(h.store.getSnapshot().localGeneration).toBe(1);expect(h.controls).toMatchObject({enabled:true,enableDamping:true,autoRotate:true});expect(h.store.undo()).toBe(true);expect(serializeProject(h.store.getSnapshot().document)).toBe(before);expect(h.store.getSnapshot().canUndo).toBe(false);expect(h.captures.size).toBe(0);
});
it('an invalid release never commits the previous valid preview and Escape/selection/camera changes restore canonical data',()=>{
 const h=setup(),before=serializeProject(h.base);h.pointer.setMode('move',true);
 for(const cancel of ['invalid','escape','selection','camera'] as const){h.select(h.id);h.send('pointerdown',.2,-.1);h.send('pointermove',1.2,.4);h.flush();expect(h.preview).not.toBe(null);
  if(cancel==='invalid')h.send('pointerup',1000,1000);else if(cancel==='escape')window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));else if(cancel==='selection')h.select('other');else h.camera.position.x=1;
  h.send('pointerup',1.2,.4);expect(h.pointer.active).toBe(false);expect(h.preview).toBe(null);expect(serializeProject(h.store.getSnapshot().document)).toBe(before);
 }
});
it('touch150ms hold, early move, outside secondary, blur-held/remounted secondary and genuine primary recovery preserve ownership',()=>{
 vi.useFakeTimers();const h=setup(),before=serializeProject(h.base);h.pointer.setMode('move',false);const touch={pointerType:'touch',pointerId:1,isPrimary:true};
 h.send('pointerdown',.2,-.1,touch);h.send('pointermove',1,.4,touch);vi.advanceTimersByTime(200);h.flush();h.send('pointerup',1,.4,touch);expect(serializeProject(h.store.getSnapshot().document)).toBe(before);
 h.send('pointerdown',.2,-.1,touch);vi.advanceTimersByTime(151);h.send('pointermove',1.2,.4,touch);h.flush();expect(h.preview).not.toBe(null);h.send('pointerdown',2,2,{...touch,pointerId:2,isPrimary:false},document.body);h.send('pointerup',1.2,.4,touch);h.send('pointermove',2,2,{...touch,pointerId:2,isPrimary:false});h.send('pointerup',2,2,{...touch,pointerId:2,isPrimary:false});expect(serializeProject(h.store.getSnapshot().document)).toBe(before);
 h.send('pointerdown',.2,-.1,touch);window.dispatchEvent(new Event('blur'));h.send('pointerdown',.2,-.1,{...touch,pointerId:3,isPrimary:false});vi.advanceTimersByTime(200);h.flush();expect(h.pointer.active).toBe(false);h.send('pointerup',.2,-.1,{...touch,pointerId:3,isPrimary:false});h.send('pointerup',.2,-.1,touch);
 h.send('pointerdown',.2,-.1,{...touch,pointerId:4});vi.advanceTimersByTime(151);h.send('pointermove',1.2,.4,{...touch,pointerId:4});h.flush();h.send('pointerup',1.2,.4,{...touch,pointerId:4});expect(h.store.getSnapshot().document.furniture[0]!.position).toEqual({x:1000,y:500});
});
it('near-centre rotation cannot own a gesture; free349to1 and absolute15degree rotation commit once',()=>{
 const h=setup(349);h.pointer.setMode('rotate',true);h.send('pointerdown',0,0);expect(h.pointer.active).toBe(false);h.send('pointerup',0,0);
 const start=[.5,0] as const,angle=12*Math.PI/180;h.send('pointerdown',...start);h.send('pointermove',.5*Math.cos(angle),.5*Math.sin(angle));h.flush();h.send('pointerup',.5*Math.cos(angle),.5*Math.sin(angle));expect(h.store.getSnapshot().document.furniture[0]!.rotationDeg).toBeCloseTo(1,8);expect(h.store.undo()).toBe(true);h.pointer.setMode('rotate',false);const snap=32*Math.PI/180;h.send('pointerdown',...start);h.send('pointerup',.5*Math.cos(snap),.5*Math.sin(snap));expect(h.store.getSnapshot().document.furniture[0]!.rotationDeg).toBe(15);
});
it('unowned Orbit dispatch passes through; consumed transforms suppress the generic pick listener and dispose all scheduled work',()=>{
 const h=setup(),generic=vi.fn();document.addEventListener('pointerup',generic,true);disposers.push(()=>document.removeEventListener('pointerup',generic,true));h.send('pointerdown',.2,-.1);h.send('pointerup',.2,-.1);expect(generic).toHaveBeenCalledTimes(1);h.pointer.setMode('move',true);h.send('pointerdown',.2,-.1);h.send('pointermove',1,.4);h.pointer.dispose();h.flush();expect(h.pointer.active).toBe(false);expect(h.frames.size).toBe(0);expect(h.captures.size).toBe(0);expect(h.failure).not.toHaveBeenCalled();expect(h.store.getSnapshot().localGeneration).toBe(0);
});

it('acquired capture and controls are retired when status throws; failed canonical restoration prevents any command',()=>{
 const h=setup();h.pointer.setMode('move',true);const original=h.hooks.status;h.hooks.status=phase=>{if(phase==='preview')throw Error('status fault');original(phase);};h.send('pointerdown',.2,-.1);expect(h.pointer.active).toBe(false);expect(h.captures.size).toBe(0);expect(h.controls.enabled).toBe(true);h.send('pointerup',.2,-.1);h.hooks.status=original;
 h.send('pointerdown',.2,-.1);h.send('pointermove',1.2,.4);h.flush();expect(h.preview).not.toBe(null);const preview=h.hooks.preview;h.hooks.preview=result=>{preview(result);if(!result)throw Error('canonical restore fault');};h.send('pointerup',1.2,.4);expect(h.pointer.active).toBe(false);expect(h.captures.size).toBe(0);expect(h.controls.enabled).toBe(true);expect(h.store.getSnapshot().localGeneration).toBe(0);expect(h.failure).toHaveBeenCalledTimes(1);
});
it('reporting and capture-release faults cannot skip independent cleanup or leak scheduled ownership',()=>{
 const h=setup();h.pointer.setMode('move',false);h.send('pointerdown',.2,-.1);h.send('pointermove',1.2,.4);h.canvas.releasePointerCapture=id=>{h.captures.delete(id);throw Error('capture release fault');};h.hooks.failed=()=>{throw Error('reporting fault');};expect(()=>h.pointer.dispose()).not.toThrow();h.flush();expect(h.pointer.active).toBe(false);expect(h.frames.size).toBe(0);expect(h.captures.size).toBe(0);expect(h.controls).toMatchObject({enabled:true,enableDamping:true,autoRotate:true});expect(h.store.getSnapshot().localGeneration).toBe(0);
});
it('reentrant start disposal, selection/tag changes and pending-status disposal cannot resurrect ownership',()=>{
 vi.useFakeTimers();for(const change of ['dispose','selection','tag','status'] as const){const h=setup();h.pointer.setMode('move',true);h.hooks.start=()=>{if(change==='dispose')h.pointer.dispose();else if(change==='selection')h.select('other');else if(change==='tag')h.store.execute({id:'switch_units',baseGeneration:0,type:'SetUnits',units:'imperial'});};if(change==='status')h.hooks.status=()=>h.pointer.dispose();h.send('pointerdown',.2,-.1,{pointerType:'touch'});expect(vi.getTimerCount()).toBe(0);vi.advanceTimersByTime(200);h.flush();expect(h.pointer.active).toBe(false);expect(h.captures.size).toBe(0);expect(h.frames.size).toBe(0);expect(h.controls).toMatchObject({enabled:true,enableDamping:true,autoRotate:true});h.send('pointerup',1.2,.4,{pointerType:'touch'});expect(h.store.getSnapshot().document.furniture).toEqual(h.base.furniture);}
});
it('fresh mouse down recovers a missed release after lost capture without bypassing held touch ownership',()=>{
 const h=setup();h.pointer.setMode('move',true);h.send('pointerdown',.2,-.1);h.captures.clear();h.canvas.dispatchEvent(new Event('lostpointercapture'));expect(h.pointer.active).toBe(false);h.send('pointerdown',.2,-.1);expect(h.pointer.active).toBe(true);h.send('pointerup',1.2,.4);expect(h.store.getSnapshot().document.furniture[0]!.position).toEqual({x:1000,y:500});
 h.send('pointerdown',1.2,.4,{pointerType:'touch',pointerId:3});window.dispatchEvent(new Event('blur'));h.send('pointerdown',1.2,.4,{pointerId:1});expect(h.pointer.active).toBe(false);h.send('pointerup',1.2,.4,{pointerId:1});h.send('pointerup',1.2,.4,{pointerType:'touch',pointerId:3});
});
it('actual OrbitControls drains real residual damping/autoOrbit and leaves the captured camera mapping owned',async()=>{
 const {OrbitControls}=await import('three/addons/controls/OrbitControls.js');const h=setup();Object.defineProperties(h.canvas,{clientWidth:{value:800},clientHeight:{value:600}});h.camera.position.set(0,10,10);h.camera.lookAt(0,0,0);const orbit=new OrbitControls(h.camera,h.canvas);disposers.push(()=>orbit.dispose());orbit.enableDamping=true;orbit.dampingFactor=.09;h.controls.target=orbit.target;h.controls.update.mockImplementation(()=>{orbit.enabled=h.controls.enabled;orbit.autoRotate=h.controls.autoRotate;orbit.enableDamping=h.controls.enableDamping;return orbit.update();});
 h.send('pointerdown',.2,-.1);h.send('pointermove',1.2,.4);h.send('pointerup',1.2,.4);const position=h.camera.position.toArray(),quaternion=h.camera.quaternion.toArray();h.pointer.setMode('move',true);h.send('pointerdown',.2,-.1);expect(h.pointer.active).toBe(true);for(let i=0;i<100;i++){h.pointer.tick();expect(h.pointer.active).toBe(true);expect(h.camera.position.toArray()).toEqual(position);expect(h.camera.quaternion.toArray()).toEqual(quaternion);}h.pointer.cancel();expect(h.camera.position.toArray()).toEqual(position);expect(h.controls.autoRotate).toBe(true);
});
it('viewport metrics changing before the queued resize event cannot commit a held preview when canvas bounds are unchanged',()=>{
 const h=setup(),before=serializeProject(h.base),width=window.innerWidth;h.pointer.setMode('move',true);h.send('pointerdown',.2,-.1);h.send('pointermove',1.2,.4);h.flush();expect(h.preview).not.toBe(null);Object.defineProperty(window,'innerWidth',{configurable:true,value:width+10});try{h.send('pointerup',1.2,.4);expect(serializeProject(h.store.getSnapshot().document)).toBe(before);expect(h.pointer.active).toBe(false);expect(h.captures.size).toBe(0);}finally{Object.defineProperty(window,'innerWidth',{configurable:true,value:width});}
});
