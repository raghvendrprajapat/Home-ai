import * as THREE from 'three';
import type {Point2} from '../editor/view2d';
export interface PointerRect {left:number;top:number;width:number;height:number}
/** Owned matrices in metres; pointer results are raw derived plan millimetres.
 * The horizontal plane passes through the actual visible grab, not object bottom. */
export class FurnitureProjection {
 readonly rect:Readonly<PointerRect>;readonly height:number;
 #inverse:THREE.Matrix4;#forward:THREE.Matrix4;#world:THREE.Matrix4;#origin:THREE.Vector3;
 constructor(camera:THREE.PerspectiveCamera,rect:PointerRect,height:number){
  camera.updateWorldMatrix(true,false);
  if(![rect.left,rect.top,rect.width,rect.height,height,camera.near,camera.far,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].every(Number.isFinite)||rect.width<=0||rect.height<=0||camera.near<=0||camera.far<=camera.near||Math.abs(camera.projectionMatrix.determinant())<1e-12)throw Error('furniture-projection');
  this.rect=Object.freeze({left:rect.left,top:rect.top,width:rect.width,height:rect.height});this.height=height;this.#world=camera.matrixWorld.clone();
  this.#inverse=new THREE.Matrix4().multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
  this.#forward=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  this.#origin=new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
 }
 point(client:Point2):Point2|null {
  if(!client.every(Number.isFinite))return null;
  const {left,top,width,height}=this.rect,ndc=new THREE.Vector3((client[0]-left)/width*2-1,1-(client[1]-top)/height*2,.5).applyMatrix4(this.#inverse);
  const direction=ndc.sub(this.#origin).normalize();if(Math.abs(direction.y)<1e-6)return null;
  const distance=(this.height-this.#origin.y)/direction.y;
  if(!Number.isFinite(distance)||distance<=0)return null;
  const p=this.#origin.clone().addScaledVector(direction,distance),clip=p.clone().applyMatrix4(this.#forward);
  // Camera clipping planes bound view depth, not radial ray distance.
  if(!Number.isFinite(clip.z)||clip.z< -1||clip.z>1)return null;
  const result:Point2=[p.x*1000,p.z*1000];return result.every(Number.isFinite)?result:null;
 }
 screen(point:Point2):Point2|null {
  const p=new THREE.Vector3(point[0]/1000,this.height,point[1]/1000).applyMatrix4(this.#forward);
  if(![p.x,p.y,p.z].every(Number.isFinite)||p.z< -1||p.z>1)return null;
  return [this.rect.left+(p.x+1)*this.rect.width/2,this.rect.top+(1-p.y)*this.rect.height/2];
 }
 matches(camera:THREE.PerspectiveCamera,rect:PointerRect):boolean {
  camera.updateWorldMatrix(true,false);
  return (['left','top','width','height'] as const).every(k=>rect[k]===this.rect[k])&&camera.matrixWorld.elements.every((v,i)=>v===this.#world.elements[i])&&new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).equals(this.#forward);
 }
}
