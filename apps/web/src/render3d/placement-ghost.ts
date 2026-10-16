import type {FurnitureAdvisory} from '../editor/furniture-advisories';
import * as THREE from 'three';
import type {AsyncTag,FurnitureItem} from '@gharplan/core-model';
import {ResourcePool,releaseOnce} from './resources';
import type {Lease,Disposable} from './resources';
import {unitBoxGeometry} from './scene';
export interface FurnitureGhost {readonly advisory?:FurnitureAdvisory;readonly warning?:boolean;readonly tag:Readonly<AsyncTag>;readonly item:Pick<FurnitureItem,'id'|'position'|'elevation'|'rotationDeg'|'size'>}
/** A transient helper only: never part of the derived structural scene or picking. */
export class PlacementGhost {
 readonly group=new THREE.Group();#pool=new ResourcePool();#mesh:THREE.Mesh|null=null;#leases:Lease<Disposable>[]=[];#closed=false;
 get resourceStats(){return this.#pool.stats;}
 set(preview:FurnitureGhost|undefined,current:AsyncTag,floorElevation:number,eligible:boolean):void{
  if(this.#closed)return;
  const tag=preview?.tag;
  if(!preview||!eligible||!tag||tag.projectId!==current.projectId||tag.sessionId!==current.sessionId||tag.localGeneration!==current.localGeneration||tag.dependencyHash!==current.dependencyHash){this.clear();return;}
  try{
   if(!this.#mesh){const geometry=this.#pool.acquire('ghost-geometry',unitBoxGeometry);this.#leases.push(geometry);const material=this.#pool.acquire('ghost-material',()=>new THREE.MeshBasicMaterial({color:'#c47b42',transparent:true,opacity:.45,depthWrite:false}));this.#leases.push(material);this.#mesh=new THREE.Mesh(geometry.value,material.value);this.#mesh.userData.category='placement-helper';this.group.add(this.#mesh);}
   (this.#mesh.material as THREE.MeshBasicMaterial).color.set(preview.warning?'#a52e31':'#c47b42');
   const item=preview.item;this.#mesh.scale.set(item.size.w/1000,item.size.h/1000,item.size.d/1000);this.#mesh.position.set(item.position.x/1000,(floorElevation+item.elevation+item.size.h/2)/1000,item.position.y/1000);this.#mesh.rotation.y=-item.rotationDeg*Math.PI/180;this.#mesh.updateMatrix();this.group.visible=true;
  }catch(error){this.dispose();throw error;}
 }
 clear():void{this.group.visible=false;const leases=this.#leases;this.#leases=[];this.group.clear();this.#mesh=null;releaseOnce(leases.map(lease=>()=>lease.release()))();}
 dispose():void{if(this.#closed)return;this.#closed=true;try{releaseOnce([()=>this.clear(),()=>this.#pool.close()])();}finally{this.group.clear();}}
}
