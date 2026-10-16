import * as THREE from 'three';
import type {ProjectStore} from '@gharplan/core-model';
import type {Pick} from '../editor/hit-test';
import {ResourcePool} from './resources';
import {openingBounds} from './camera';
import type {SceneAdapter} from './scene';
/** Eight unit-box corners and twelve edges; selection bounds are transient. */
export function outlineGeometry():THREE.BufferGeometry{
 const geometry=new THREE.BufferGeometry();try{
  const corners=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],pairs=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(pairs.flatMap(pair=>pair.flatMap(i=>corners[i]!)),3));geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
 }catch(error){geometry.dispose();throw error;}
}
export class SelectionOutline {
 group=new THREE.Group();#pool=new ResourcePool();#line:THREE.LineSegments|null=null;#closed=false;
 get resourceStats(){return this.#pool.stats;}
 set(pick:Pick|undefined,adapter:SceneAdapter,document:ReturnType<ProjectStore['getSnapshot']>['document'],warning=false):void{
  if(this.#closed)return;this.group.visible=false;if(!pick)return;
  let matrix:THREE.Matrix4|undefined;
  if(pick.kind==='furniture'){
   adapter.group.updateWorldMatrix(true,true);const object=adapter.group.children.find(o=>o instanceof THREE.Mesh&&o.userData.entityId===pick.id&&o.userData.category==='furniture-placeholder');if(object)matrix=object.matrixWorld.clone();
  }else{
   const bounds=new THREE.Box3(),opening=pick.kind==='opening'?openingBounds(document,pick.id):null;
   if(opening)bounds.set(new THREE.Vector3(opening[0],opening[1],opening[2]),new THREE.Vector3(opening[3],opening[4],opening[5]));
   else{const mesh=adapter.mesh(`${pick.kind==='room'?'floor':'wall'}:${pick.id}`);if(mesh)bounds.setFromObject(mesh);}
   if(!bounds.isEmpty())matrix=new THREE.Matrix4().compose(bounds.getCenter(new THREE.Vector3()),new THREE.Quaternion(),bounds.getSize(new THREE.Vector3()));
  }
  if(!matrix)return;
  if(!this.#line){try{const geometry=this.#pool.acquire('outline',outlineGeometry).value,material=this.#pool.acquire('line-material',()=>new THREE.LineBasicMaterial({color:'#c47b42',depthTest:false,toneMapped:false})).value;this.#line=new THREE.LineSegments(geometry,material);this.#line.matrixAutoUpdate=false;this.#line.renderOrder=1000;this.#line.userData.category='selection-helper';this.group.add(this.#line);}catch(error){this.dispose();throw error;}}
  (this.#line.material as THREE.LineBasicMaterial).color.set(warning?'#a52e31':'#c47b42');
  this.#line.matrix.copy(matrix);this.#line.matrixWorldNeedsUpdate=true;this.group.visible=true;
 }
 dispose():void{if(this.#closed)return;this.#closed=true;this.group.visible=false;try{this.#pool.close();}finally{this.group.clear();this.#line=null;}}
}
