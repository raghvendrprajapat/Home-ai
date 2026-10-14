import * as THREE from 'three';
import {captureBudget} from './quality';
import type {GpuCapabilities,QualityTier} from './quality';
export interface CapturedPixels {width:number;height:number;rgba:Uint8ClampedArray;generation:number}
/** Default framebuffer gives the live ACES/sRGB path; copy before yielding or restoring the buffer. */
export function captureFrame(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.PerspectiveCamera,width:number,height:number,generation:number,tier:QualityTier,gpu:GpuCapabilities,copy:(canvas:HTMLCanvasElement)=>Uint8ClampedArray):CapturedPixels{
 const gl=renderer.getContext();if(gl.isContextLost())throw new Error('capture-context');
 const originalSize=renderer.getSize(new THREE.Vector2()),ratio=renderer.getPixelRatio(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),target=renderer.getRenderTarget(),cube=renderer.getActiveCubeFace(),mip=renderer.getActiveMipmapLevel();
 captureBudget(width,height,gl.drawingBufferWidth*gl.drawingBufferHeight,Number(gl.getParameter(gl.SAMPLES)),tier,gpu);
 let result:CapturedPixels|undefined,error:unknown;
 try{
  renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.setViewport(0,0,width,height);
  if(gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height||gl.isContextLost())throw new Error('capture-size');
  const capturedCamera=camera.clone();capturedCamera.aspect=width/height;capturedCamera.updateProjectionMatrix();renderer.render(scene,capturedCamera);
  const rgba=copy(renderer.domElement);if(rgba.length!==width*height*4||gl.isContextLost())throw new Error('capture-readback');result={width,height,rgba,generation};
 }catch(e){error=e;}
 try{
  // Keep DPR1 while restoring the logical size: never allocate exportSize*oldDPR first.
  renderer.setSize(originalSize.x,originalSize.y,false);renderer.setPixelRatio(ratio);renderer.setRenderTarget(target,cube,mip);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
  if(gl.isContextLost())throw new Error('capture-context');renderer.render(scene,camera);
 }catch{throw new Error('capture-restore');}
 if(error)throw error;if(!result)throw new Error('capture-readback');return result;
}
