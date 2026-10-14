export type QualityChoice='auto'|'low'|'mid'|'high';
export type QualityTier=Exclude<QualityChoice,'auto'>;
export interface GpuCapabilities {maxTextureSize:number;maxRenderbufferSize:number;maxSamples:number}
export const profiles={
 low:{dpr:1,antialias:false,shadows:false,shadowSize:0,pointLights:0,framePixels:1_000_000,textureBytes:128*1024*1024,captureBytes:64*1024*1024},
 mid:{dpr:1.5,antialias:true,shadows:true,shadowSize:1024,pointLights:0,framePixels:2_000_000,textureBytes:256*1024*1024,captureBytes:128*1024*1024},
 high:{dpr:2,antialias:true,shadows:true,shadowSize:2048,pointLights:2,framePixels:4_000_000,textureBytes:256*1024*1024,captureBytes:384*1024*1024},
} as const;
/** Conservative default pending device calibration; capability limits are not an FPS classifier. */
export function resolveQuality(choice:QualityChoice,gpu?:GpuCapabilities):{tier:QualityTier;downgraded:boolean}{
 const requested=choice==='auto'?'low':choice,tier=gpu&&(gpu.maxTextureSize<2048||gpu.maxRenderbufferSize<2048)?'low':requested;return {tier,downgraded:tier!==requested};
}
export function pixelRatio(tier:QualityTier,width:number,height:number,deviceRatio:number):number{
 if(![width,height,deviceRatio].every(Number.isFinite)||width<=0||height<=0||deviceRatio<=0)throw new Error('render-size');return Math.min(deviceRatio,profiles[tier].dpr,Math.sqrt(profiles[tier].framePixels/(width*height)));
}
export function captureBudget(width:number,height:number,currentPixels:number,samples:number,tier:QualityTier,gpu:GpuCapabilities):number{
 if(![width,height,currentPixels,samples].every(Number.isSafeInteger)||width<1||height<1||currentPixels<0||samples<0||samples>32||Math.max(width,height)>Math.min(2048,gpu.maxRenderbufferSize)||width*height>4_000_000)throw new Error('capture-budget');
 // Conservative simultaneous old/export MSAA color+depth, raw RGBA, Canvas, decoded bitmap, encoded cap.
 const bytes=(currentPixels+width*height)*8*Math.max(1,samples)+width*height*12+10*1024*1024;if(bytes>profiles[tier].captureBytes)throw new Error('capture-budget');return bytes;
}
