import * as THREE from 'three';
import type {Command,PreviewResult,ProjectStore} from '@gharplan/core-model';
import {beginFurnitureGesture,currentFurnitureGesture,furnitureGestureCommand} from '../editor/furniture-gesture';
import type {FurnitureGestureIntent} from '../editor/furniture-gesture';
import type {Point2} from '../editor/view2d';
import {FurnitureProjection} from './furniture-projection';
export type FurniturePointerMode='orbit'|'move'|'rotate';
interface Controls {enabled:boolean;enableDamping:boolean;autoRotate:boolean;target:THREE.Vector3;update():unknown}
interface PointerInput {id:number;touch:boolean;client:Point2;shift:boolean}
interface Active {input:PointerInput;intent:FurnitureGestureIntent;projection:FurnitureProjection;start:Point2;pending:boolean;position:THREE.Vector3;quaternion:THREE.Quaternion;target:THREE.Vector3;flags:{enabled:boolean;enableDamping:boolean;autoRotate:boolean}}
export interface FurniturePointerHooks {
 eligible():boolean;selected():string|undefined;start():void;
 hit(client:Point2):{id:string;point:readonly[number,number,number]}|null;
 preview(result:Extract<PreviewResult,{ok:true}>|null):void;
 status(phase:'idle'|'pending'|'preview'|'invalid',errors?:Extract<PreviewResult,{ok:false}>['errors']):void;
 committed(result:ReturnType<ProjectStore['execute']>):void;failed():void;
}
/** One document-capture dispatcher consumes transforms before both picking and
 * OrbitControls. Unowned orbit releases still reach their original listeners. */
export class FurniturePointer {
 #active:Active|null=null;#held=new Map<number,boolean>();#consumed=new Set<number>();#closed=false;#mode:FurniturePointerMode='orbit';#free=false;#frame:number|null=null;#hold:ReturnType<typeof setTimeout>|null=null;#removers:(()=>void)[]=[];
 constructor(private store:ProjectStore,private element:HTMLCanvasElement,private camera:THREE.PerspectiveCamera,private controls:Controls,private hooks:FurniturePointerHooks){
  const doc=element.ownerDocument,win=doc.defaultView!;
  const listen=(target:EventTarget,name:string,listener:EventListener,capture=false)=>{target.addEventListener(name,listener,capture);this.#removers.push(()=>target.removeEventListener(name,listener,capture));};
  try{
   listen(element,'lostpointercapture',()=>this.cancel());listen(win,'blur',()=>this.#interrupt());listen(doc,'visibilitychange',()=>{if(doc.hidden)this.#interrupt();});
   listen(win,'resize',()=>this.cancel());listen(win,'scroll',()=>this.cancel(),true);
   listen(win,'keydown',e=>{const key=e as KeyboardEvent;if(key.key==='Shift')this.#shift(key.shiftKey);else if(this.active)this.cancel();},true);listen(win,'keyup',e=>{if((e as KeyboardEvent).key==='Shift')this.#shift(false);},true);
   this.#removers.push(store.subscribe(()=>this.cancel()));
  }catch(error){this.dispose();throw error;}
 }
 get active():boolean{return !!this.#active;}
 /** Called first by the view's existing document-capture dispatcher. */
 dispatch(kind:'down'|'move'|'up'|'cancel',event:PointerEvent):boolean{
  if(this.#closed)return false;
  try{if(kind==='down')this.#down(event);else if(kind==='move')this.#move(event);else this.#end(event,kind==='cancel');return event.cancelBubble;}
  catch{this.#consume(event);this.cancel();this.#fail();return true;}
 }
 setMode(mode:FurniturePointerMode,free:boolean):void{if(mode!==this.#mode||free!==this.#free)this.cancel();this.#mode=mode;this.#free=free;}
 tick():void {const a=this.#active;if(a&&(!this.#owned(a)||!a.projection.matches(this.camera,this.element.getBoundingClientRect())))this.cancel();}
 #owned(a:Active):boolean{return !this.#closed&&currentFurnitureGesture(this.store,a.intent)&&this.hooks.selected()===a.intent.id&&this.hooks.eligible();}
 #consume(e:PointerEvent):void{e.preventDefault();e.stopImmediatePropagation();}
 #down(e:PointerEvent):void{
  if(this.#closed)return;
  const onCanvas=e.target===this.element,touch=e.pointerType==='touch';
  // A genuinely fresh primary touch means old IDs no longer exist in the UA.
  if(touch&&e.isPrimary&&!this.#active){this.#held.clear();this.#consumed.clear();}
  // A new primary mouse pointerdown starts a new button stream. Retire a missed
  // mouse release after lost capture, while preserving still-held touch IDs.
  if(!touch&&e.button===0&&!this.#active)for(const [id,heldTouch]of this.#held)if(!heldTouch){this.#held.delete(id);this.#consumed.delete(id);}
  if(this.#active){this.cancel();if(touch){this.#held.set(e.pointerId,true);if(onCanvas)this.#consumed.add(e.pointerId);}if(onCanvas)this.#consume(e);return;}
  if(!onCanvas)return;
  if(!touch&&!e.buttons)return;
  const blocked=this.#held.size>0||touch&&!e.isPrimary;
  this.#held.set(e.pointerId,touch);
  if(this.#mode==='orbit')return;
  if(blocked){this.#consumed.add(e.pointerId);this.#consume(e);return;}
  if(e.button!==0||!this.hooks.eligible())return;
  const selected=this.hooks.selected(),hit=this.hooks.hit([e.clientX,e.clientY]);if(!selected||hit?.id!==selected)return;
  this.#consumed.add(e.pointerId);this.#consume(e);
  const position=this.camera.position.clone(),quaternion=this.camera.quaternion.clone(),target=this.controls.target.clone(),flags={enabled:this.controls.enabled,enableDamping:this.controls.enableDamping,autoRotate:this.controls.autoRotate};
  try{
   const projection=new FurnitureProjection(this.camera,this.element.getBoundingClientRect(),hit.point[1]),point=projection.point([e.clientX,e.clientY]);if(!point)throw Error('furniture-projection');
   const mode=this.#mode,intent=beginFurnitureGesture(this.store,selected,mode,point),owned=()=>!this.#closed&&this.#mode===mode&&currentFurnitureGesture(this.store,intent)&&this.hooks.selected()===selected&&this.hooks.eligible();
   this.hooks.start();if(!owned())return;
   this.controls.enabled=false;this.controls.autoRotate=false;this.controls.enableDamping=false;
   // Public update drains residual orbit deltas. Restore the exact captured pose
   // before freezing projection; disabled alone would still allow damping drift.
   this.controls.update();this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.controls.target.copy(target);this.controls.update();
   this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.controls.target.copy(target);
   const item=this.store.getSnapshot().document.furniture.find(f=>f.id===selected)!,centre=projection.screen([item.position.x,item.position.y]);
   if(this.#mode==='rotate'&&(!centre||Math.hypot(e.clientX-centre[0],e.clientY-centre[1])<12))throw Error('furniture-rotation-radius');
   if(!owned())throw Error('furniture-ownership');
   const input:PointerInput={id:e.pointerId,touch,client:[e.clientX,e.clientY],shift:e.shiftKey};
   this.#active={input,intent,projection,start:input.client,pending:touch,position,quaternion,target,flags};this.element.setPointerCapture(e.pointerId);this.hooks.status(touch?'pending':'preview');
   if(touch&&this.#active)this.#hold=setTimeout(()=>{this.#hold=null;const a=this.#active;if(a){a.pending=false;this.#schedule();}},150);
  }catch{
   if(this.#active)this.cancel();
   else{this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.controls.target.copy(target);Object.assign(this.controls,flags);}
   try{this.hooks.status('invalid');}catch{this.#fail();}
  }
 }
 #move(e:PointerEvent):void{
  if(this.#closed)return;const a=this.#active;
  if(a?.input.id===e.pointerId){this.#consume(e);a.input={...a.input,client:[e.clientX,e.clientY],shift:e.shiftKey};
   if(a.pending){if(Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1])>6)this.cancel();return;}this.#schedule();
  }else if(this.#consumed.has(e.pointerId))this.#consume(e);
 }
 #shift(shift:boolean):void{const a=this.#active;if(a){a.input={...a.input,shift};if(!a.pending)this.#schedule();}}
 #schedule():void{if(this.#frame!==null)return;this.#frame=requestAnimationFrame(()=>{this.#frame=null;const a=this.#active;if(!a||a.pending)return;try{const prepared=this.#prepare(a);this.hooks.preview(prepared?.result.ok?prepared.result:null);this.hooks.status(prepared?.result.ok?'preview':'invalid',prepared&&!prepared.result.ok?prepared.result.errors:undefined);}catch{this.cancel();this.#fail();}});}
 #prepare(a:Active):{command:Command;result:PreviewResult}|null{
  if(!this.#owned(a)||!a.projection.matches(this.camera,this.element.getBoundingClientRect())){this.cancel();return null;}
  const r=a.projection.rect,[x,y]=a.input.client;if(x<r.left||x>r.left+r.width||y<r.top||y>r.top+r.height)return null;
  const point=a.projection.point(a.input.client);if(!point)return null;
  try{const command=furnitureGestureCommand(a.intent,point,this.#free||a.input.shift,50);return {command,result:this.store.preview(command)};}catch{return null;}
 }
 #end(e:PointerEvent,cancelled:boolean):void{
  if(this.#closed)return;
  const consumed=this.#consumed.has(e.pointerId),a=this.#active;
  if(consumed)this.#consume(e);
  this.#held.delete(e.pointerId);this.#consumed.delete(e.pointerId);
  if(a?.input.id!==e.pointerId)return;
  a.input={...a.input,client:[e.clientX,e.clientY],shift:e.shiftKey};
  const moved=Math.hypot(e.clientX-a.start[0],e.clientY-a.start[1]);
  const prepared=!cancelled&&!a.pending&&moved>3?this.#prepare(a):null;
  const command=prepared?.result.ok?prepared.command:null;
  // Retire/restore the LAST CANONICAL presentation BEFORE any store write, so
  // worker failure can retain a coherent previous-generation scene.
  if(!this.cancel())return;
  if(command&&!this.#closed&&currentFurnitureGesture(this.store,a.intent)&&this.hooks.selected()===a.intent.id){try{this.hooks.committed(this.store.execute(command));}catch{this.#fail();}}
 }
 #interrupt():void{this.cancel();for(const [id,touch]of this.#held)if(!touch){this.#held.delete(id);this.#consumed.delete(id);}}
 #fail():void{try{this.hooks.failed();}catch{/* Cleanup cannot depend on a reporting callback. */}}
 cancel():boolean{
  const a=this.#active;this.#active=null;
  if(this.#frame!==null)cancelAnimationFrame(this.#frame);this.#frame=null;if(this.#hold!==null)clearTimeout(this.#hold);this.#hold=null;
  if(!a)return true;
  let failed=false;
  for(const release of [()=>this.hooks.preview(null),()=>{this.camera.position.copy(a.position);this.camera.quaternion.copy(a.quaternion);this.controls.target.copy(a.target);Object.assign(this.controls,a.flags);},()=>{if(this.element.hasPointerCapture(a.input.id))this.element.releasePointerCapture(a.input.id);},()=>this.hooks.status('idle')])try{release();}catch{failed=true;}
  if(failed)this.#fail();return !failed;
 }
 dispose():void{if(this.#closed)return;this.#closed=true;this.cancel();for(const remove of this.#removers.splice(0).reverse())try{remove();}catch{this.#fail();}this.#held.clear();this.#consumed.clear();}
}
