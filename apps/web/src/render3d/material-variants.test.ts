import {expect,it,vi} from 'vitest';
import * as THREE from 'three';
import type {MaterialDef} from '@gharplan/core-model';
import {SurfaceTextures,TEXTURE_SETS,textureSetFor} from './surface-textures';

// Codex-authored. Four new colour maps reuse the original recorded CC0 normals/roughness, not four more copies.
const material=(id:string,baseColor='#765039'):MaterialDef=>({id,name:id,baseColor,uvScaleMm:1200,roughness:.85,metalness:0});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
it('D82 new IDs select distinct exact sets before the older name fallbacks, with unchanged real-world scale',()=>{
 const pairs=[['m_wood_walnut','wood_walnut',1500],['m_tile_terracotta','tile_terracotta_600',1200],['m_marble_charcoal','marble_charcoal',1500],['m_wallpaper_linen','wallpaper_linen',1200]] as const;
 for(const [id,key,world] of pairs){const set=textureSetFor(material(id));expect(set).toBe(TEXTURE_SETS[key]);expect(set.worldMm).toBe(world);expect(set.files.color).toBe(`textures/${key}/color.jpg`);}
 expect(TEXTURE_SETS.wood_walnut.files.normal).toBe('textures/wood_oak/normal.jpg');expect(TEXTURE_SETS.tile_terracotta_600.files.normal).toBe('textures/tile_vitrified_600/normal.jpg');
 expect(TEXTURE_SETS.marble_charcoal.files.roughness).toBe('textures/marble_white/roughness.jpg');expect(TEXTURE_SETS.wallpaper_linen.files.normal).toBe('textures/plaster/normal.jpg');
});
it('D82 a missing photo finish keeps its actual base colour, never a white fallback',async()=>{
 const def=material('m_wood_walnut'),m=new THREE.MeshStandardMaterial(),textures=new SurfaceTextures(new URL('https://app.example/'),()=>{},()=>Promise.reject(new Error('offline')));
 textures.apply(m,def);expect(m.color.getHexString()).toBe('765039');await tick();expect(m.map).toBeNull();expect(m.color.getHexString()).toBe('765039');expect(textures.stats).toEqual({texturedMaterials:0,textureBytes:0});textures.dispose();m.dispose();
});
it('D82 a changed/pending finish clears the previous maps; late old downloads cannot replace the newer material',async()=>{
 const waiting=new Map<string,(t:THREE.Texture)=>void>(),load=(url:string)=>new Promise<THREE.Texture>(resolve=>waiting.set(url,resolve)),textures=new SurfaceTextures(new URL('https://app.example/'),()=>{},load),m=new THREE.MeshStandardMaterial();
 textures.apply(m,material('m_wood_walnut'));textures.apply(m,material('m_wallpaper_linen','#e4dbc5'));
 for(const [url,resolve] of waiting){const t=new THREE.Texture();t.name=url;t.image={width:512,height:512};resolve(t);}await tick();await tick();
 expect(m.map!.name).toContain('wallpaper_linen');expect(m.color.getHexString()).toBe('ffffff');expect(m.roughnessMap).toBeNull();expect(m.roughness).toBe(.85);
 const old=m.map!,dispose=vi.spyOn(old,'dispose');textures.apply(m,material('m_marble_charcoal','#35393b'));
 expect(m.map).toBeNull();expect(m.color.getHexString()).toBe('35393b');expect(dispose).toHaveBeenCalledTimes(1);expect(textures.stats.texturedMaterials).toBe(0);
 textures.dispose();for(const [url,resolve] of waiting){if(url.includes('marble')){const t=new THREE.Texture();resolve(t);}}await tick();expect(textures.stats).toEqual({texturedMaterials:0,textureBytes:0});m.dispose();
});
it('D82 all eight sets share 15 actual images; estimated RGBA mipmaps stay below 53MiB before HDRI',async()=>{
 const loaded:THREE.Texture[]=[],urls:string[]=[],textures=new SurfaceTextures(new URL('https://app.example/'),()=>{},url=>{urls.push(url);const t=new THREE.Texture();t.image={width:url.endsWith('/color.jpg')?1024:512,height:url.endsWith('/color.jpg')?1024:512};loaded.push(t);return Promise.resolve(t);});
 const defs=['m_wood_laminate','m_tile_vitrified','m_marble_white','m_paint_white','m_wood_walnut','m_tile_terracotta','m_marble_charcoal','m_wallpaper_linen'],materials=defs.map(id=>{const m=new THREE.MeshStandardMaterial();textures.apply(m,material(id));return m;});await tick();await tick();
 expect(urls).toHaveLength(15);expect(new Set(urls).size).toBe(15);expect(textures.stats.texturedMaterials).toBe(8);expect(textures.stats.textureBytes).toBe(8*Math.round(1024**2*4*4/3)+7*Math.round(512**2*4*4/3));expect(textures.stats.textureBytes).toBeLessThan(53*1024**2);
 const disposals=loaded.map(t=>vi.spyOn(t,'dispose'));textures.dispose();textures.dispose();for(const spy of disposals)expect(spy).toHaveBeenCalledTimes(1);for(const m of materials)m.dispose();
});
