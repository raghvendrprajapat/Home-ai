import * as THREE from 'three';
import type {ProjectStore} from '@gharplan/core-model';
import type {QualityTier} from './quality';
import {profiles} from './quality';
import {pointLightPosition} from './lighting';
import {hungAboveCut} from './cutaway';

type Document=ReturnType<ProjectStore['getSnapshot']>['document'];
export type LightingMode='day'|'warm'|'night';
export interface LightSource {id:string;position:[number,number,number];color:string;intensity:number;distance:number}

/** View-only mood settings. Day/Warm keep the pre-D81 settings exactly, including HDRI fallback. */
export function mood(mode:LightingMode,environmentReady:boolean){
 return mode==='night'
  ? {background:'#101827',sunColor:'#a7bcfa',sun:.16,hemisphere:.32,environment:.06}
  : {background:'#f1f2ee',sunColor:mode==='warm'?'#ffd9ad':'#fff1dc',sun:mode==='warm'?2.2:3.3,hemisphere:environmentReady?.45:2.1,environment:.6};
}

/**
 * A bounded decorative preview, not a lighting solver. Night uses at most two non-shadow lights, active-floor lamps
 * first, then existing point lights. Low always has zero. Known v1 lamp shade centres are 1460/1600 and 360/450 of
 * the actual height, so resizing/elevation/moving the furniture moves the source too. Unrecognised versions do not
 * invent a bulb location. No geometry, catalog data or saved Light entity is changed.
 */
export function lightSources(d:Document,tier:QualityTier,mode:LightingMode,activeFloorId:string,lowWallsMm?:number):LightSource[]{
 const limit=tier==='low'?0:mode==='night'?2:profiles[tier].pointLights;
 if(!limit)return [];
 const floor=d.floors.find(f=>f.id===activeFloorId)??d.floors[0]!;
 const lamps:LightSource[]=mode==='night'?d.furniture.filter(f=>f.floorId===floor.id&&!hungAboveCut(f,lowWallsMm)&&f.assetVersion===1&&(f.assetId==='a_l0_floor_lamp'||f.assetId==='a_l0_table_lamp')).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit).map(f=>({
  id:`furniture:${f.id}`,position:[f.position.x/1000,(floor.elevation+f.elevation+f.size.h*(f.assetId==='a_l0_floor_lamp'?1460/1600:360/450))/1000,f.position.y/1000],
  color:'#ffcf92',intensity:f.assetId==='a_l0_floor_lamp'?35:20,distance:3.5,
 })):[];
 const points=d.lights.filter(l=>l.kind==='point'&&(mode!=='night'||l.floorId===floor.id)).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,limit-lamps.length).map(l=>({
  id:`light:${l.id}`,position:pointLightPosition(d,l),color:l.colorTempK<4000?'#ffd9ad':'#fff5e6',intensity:Math.min(4,l.lumens/1000),distance:12,
 }));
 return [...lamps,...points];
}

/** Reuse the same bounded light objects across edits and mode changes; one scene owns and releases them. */
export class BoundedPointLights {
 #lights:THREE.PointLight[]=[];
 #closed=false;
 constructor(private readonly scene:THREE.Scene){}
 set(sources:readonly LightSource[]):void{
  if(this.#closed)return;
  if(sources.length>2)throw new Error('point-light-budget');
  while(this.#lights.length>sources.length){const light=this.#lights.pop()!;this.scene.remove(light);light.dispose();}
  for(const [i,source] of sources.entries()){
   let light=this.#lights[i];if(!light){light=new THREE.PointLight();light.castShadow=false;this.#lights.push(light);this.scene.add(light);}
   light.name=source.id;light.position.fromArray(source.position);light.color.set(source.color);light.intensity=source.intensity;light.distance=source.distance;light.decay=2;
  }
 }
 get snapshot(){return this.#lights.map(l=>({id:l.name,position:l.position.toArray(),intensity:l.intensity,distance:l.distance,castsShadow:l.castShadow}));}
 close():void{if(this.#closed)return;this.set([]);this.#closed=true;}
}
