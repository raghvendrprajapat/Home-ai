import {expect,it} from 'vitest';
import {assertScenePixels} from './three-image';
it('REN-006 opaque white/black/colored/transparent clear frames reject before watermark; asymmetric scene pixels and dimensions remain intact',()=>{
 for(const rgb of [[255,255,255,255],[0,0,0,255],[239,242,233,255],[20,50,90,0]]){const rgba=new Uint8ClampedArray(32*32*4);for(let i=0;i<rgba.length;i+=4)rgba.set(rgb,i);expect(()=>assertScenePixels({width:32,height:32,rgba,generation:0})).toThrow('image-blank');}
 const rgba=new Uint8ClampedArray(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++)rgba.set(y<16?[255,0,0,255]:[0,0,255,255],(y*32+x)*4);const original=rgba.slice();assertScenePixels({width:32,height:32,rgba,generation:1});expect(rgba).toEqual(original);expect(()=>assertScenePixels({width:2049,height:32,rgba,generation:1})).toThrow('image-budget');
});
