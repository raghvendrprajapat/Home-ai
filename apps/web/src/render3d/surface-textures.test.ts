import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import type {MaterialDef} from '@gharplan/core-model';
import {SurfaceTextures,TEXTURE_SETS,textureSetFor} from './surface-textures';

// D76 M1 surface textures. Claude-authored; repeats are hand-derived from uvScaleMm / the set's real width.
const wood:MaterialDef={id:'m_wood_laminate',name:'Wood laminate',baseColor:'#a07850',uvScaleMm:1200,roughness:.6,metalness:0};
const tile:MaterialDef={id:'m_tile_vitrified',name:'Vitrified tile 600x600',baseColor:'#e8e3da',uvScaleMm:600,roughness:.3,metalness:0};
const paint:MaterialDef={id:'m_paint_blue',name:'Paint - sky blue',baseColor:'#bcd7ea',roughness:.8,metalness:0};
const settle=()=>new Promise(resolve=>setTimeout(resolve,0));
function fakeLoader(sizes:Record<string,number>,fail=false){
 const loads:string[]=[];
 return {loads,load:(url:string)=>{loads.push(url);if(fail)return Promise.reject(new Error('offline'));const size=Object.entries(sizes).find(([k])=>url.includes(k))?.[1]??512;const t=new THREE.Texture();t.image={width:size,height:size};return Promise.resolve(t);}};
}

describe('D76 surface textures',()=>{
 it('maps library floors by id and other surfaces by name; everything else is paint over plaster',()=>{
  expect(textureSetFor(wood)).toBe(TEXTURE_SETS.wood_oak);expect(textureSetFor(tile)).toBe(TEXTURE_SETS.tile_vitrified_600);
  expect(textureSetFor({id:'m_x',name:'Marble - white'})).toBe(TEXTURE_SETS.marble_white);expect(textureSetFor({id:'m_custom',name:'Teak wood floor'})).toBe(TEXTURE_SETS.wood_oak);
  expect(textureSetFor(paint)).toBe(TEXTURE_SETS.plaster);expect(textureSetFor({id:'m_ext',name:'Exterior plaster'})).toBe(TEXTURE_SETS.plaster);
 });
 it('gives each material its real-world repeat, keeps paint colour under plaster and white under photo floors',async()=>{
  const {load,loads}=fakeLoader({'color.jpg':1024});let ready=0;
  const textures=new SurfaceTextures(new URL('https://app.example/'),()=>ready++,load);
  const w=new THREE.MeshStandardMaterial(),t=new THREE.MeshStandardMaterial(),p=new THREE.MeshStandardMaterial();
  textures.apply(w,wood);textures.apply(t,tile);textures.apply(p,paint);await settle();await settle();
  // wood: 1200 mm per UV / 1500 mm image = 0.8; tile: 600 / 1200 = 0.5; paint: 1000 (default) / 1200.
  expect(w.map!.repeat.x).toBeCloseTo(.8,12);expect(t.map!.repeat.x).toBeCloseTo(.5,12);expect(p.map!.repeat.x).toBeCloseTo(1000/1200,12);
  expect(w.color.getHexString()).toBe('ffffff');expect(p.color.getHexString()).toBe('bcd7ea');
  expect(w.roughnessMap).not.toBeNull();expect(w.roughness).toBe(1);expect(p.roughnessMap).toBeNull();
  expect(w.map!.colorSpace).toBe(THREE.SRGBColorSpace);expect(w.normalMap!.colorSpace).toBe(THREE.NoColorSpace);
  expect(ready).toBe(3);
  // Each image downloads once: wood 3 + tile 3 + plaster 2 = 8 files.
  expect(new Set(loads).size).toBe(8);expect(loads.every(url=>url.startsWith('https://app.example/textures/'))).toBe(true);
  // 3 colour maps at 1024 px and 5 other maps at 512 px, RGBA with mipmaps (4/3).
  expect(textures.stats).toEqual({texturedMaterials:3,textureBytes:Math.round(1024*1024*4*4/3)*3+Math.round(512*512*4*4/3)*5});
  textures.forget(p);expect(textures.stats.texturedMaterials).toBe(2);
  textures.dispose();expect(textures.stats).toEqual({texturedMaterials:0,textureBytes:0});
 });
 it('a failed download leaves the plain colour and counts nothing',async()=>{
  const {load}=fakeLoader({},true),textures=new SurfaceTextures(new URL('https://app.example/'),()=>{},load),m=new THREE.MeshStandardMaterial();
  textures.apply(m,paint);await settle();await settle();
  expect(m.map).toBeNull();expect(m.color.getHexString()).toBe('bcd7ea');expect(textures.stats).toEqual({texturedMaterials:0,textureBytes:0});
 });
});
