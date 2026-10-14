import type {ProjectStore} from '@gharplan/core-model';
import {areaDisplay,message} from '../i18n/messages';
import type {Locale} from '../i18n/messages';
import {formatLength} from './measurements';
import {openingSymbol} from './opening-symbol';
import {inspectPng,MAX_PNG_BYTES} from './png';
import type {Point2,Viewport} from './view2d';
import {worldToScreen} from './view2d';
type Snapshot=ReturnType<ProjectStore['getSnapshot']>;
export interface PlanImageLayout {edge:1000|2000;view:Viewport;labels:{id:string;text:string;point:Point2}[];title:string;watermark:string}
export function planImageLayout(snapshot:Snapshot,locale:Locale,edge:1000|2000):PlanImageLayout {
 const doc=snapshot.document;
 if(![1000,2000].includes(edge)||!doc.walls.length||doc.walls.length>200||doc.openings.length>500||doc.furniture.length>500)throw new Error('image-budget');
 const points:Point2[]=snapshot.derived.footprints.flatMap(f=>[[f.rect[0],f.rect[1]],[f.rect[2],f.rect[3]]] as Point2[]);
 for(const f of doc.furniture){const r=f.rotationDeg*Math.PI/180,hx=(Math.abs(Math.cos(r))*f.size.w+Math.abs(Math.sin(r))*f.size.d)/2,hy=(Math.abs(Math.sin(r))*f.size.w+Math.abs(Math.cos(r))*f.size.d)/2;points.push([f.position.x-hx,f.position.y-hy],[f.position.x+hx,f.position.y+hy]);}
 for(const o of doc.openings)if(o.kind==='door'){const symbol=openingSymbol(doc,o);points.push(...symbol.arc,symbol.leaf);}
 const left=Math.min(...points.map(p=>p[0])),top=Math.min(...points.map(p=>p[1])),right=Math.max(...points.map(p=>p[0])),bottom=Math.max(...points.map(p=>p[1])),margin=edge*.07,header=edge*.10,footer=edge*.07;
 const scale=Math.min((edge-2*margin)/Math.max(1,right-left),(edge-header-footer-2*margin)/Math.max(1,bottom-top)),view={scale,x:(edge-(left+right)*scale)/2,y:header+(edge-header-footer-(top+bottom)*scale)/2};
 const labels=doc.walls.map(w=>{const a=doc.junctions.find(j=>j.id===w.a)!,b=doc.junctions.find(j=>j.id===w.b)!;return {id:w.id,text:formatLength(Math.abs(b.x-a.x)+Math.abs(b.y-a.y),doc.units),point:[(a.x+b.x)/2,(a.y+b.y)/2] as Point2};});
 return {edge,view,labels,title:doc.name,watermark:`GharPlan · ${message(locale,'planImageWatermark')}`};
}
export function paintPlanImage(ctx:CanvasRenderingContext2D,snapshot:Snapshot,layout:PlanImageLayout,locale:Locale):void {
 const doc=snapshot.document,{edge,view}=layout,to=(p:Point2)=>worldToScreen(p,view);
 ctx.fillStyle='#ffffff';ctx.fillRect(0,0,edge,edge);ctx.font=`600 ${edge*.027}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#243b2d';ctx.fillText(layout.title,edge/2,edge*.055,edge*.86);
 const line=(points:readonly Point2[],stroke:string,width:number,closed=false,fill?:string)=>{ctx.beginPath();points.forEach((p,i)=>{const s=to(p);if(i)ctx.lineTo(s[0],s[1]);else ctx.moveTo(s[0],s[1]);});if(closed)ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();};
 for(const face of snapshot.derived.faces)for(const polygon of face.clearPolygons)line(polygon,'#c9dacf',1,true,'#e5efe9');
 for(const f of snapshot.derived.footprints){const p=to([f.rect[0],f.rect[1]]);ctx.fillStyle='#42534b';ctx.fillRect(p[0],p[1],(f.rect[2]-f.rect[0])*view.scale,(f.rect[3]-f.rect[1])*view.scale);}
 for(const f of doc.furniture){const p=to([f.position.x,f.position.y]);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(f.rotationDeg*Math.PI/180);ctx.fillStyle='#c8af90';ctx.strokeStyle='#a38a6d';ctx.lineWidth=1;ctx.fillRect(-f.size.w*view.scale/2,-f.size.d*view.scale/2,f.size.w*view.scale,f.size.d*view.scale);ctx.strokeRect(-f.size.w*view.scale/2,-f.size.d*view.scale/2,f.size.w*view.scale,f.size.d*view.scale);ctx.restore();}
 for(const o of doc.openings){const wall=doc.walls.find(w=>w.id===o.wallId)!,a=doc.junctions.find(j=>j.id===wall.a)!,b=doc.junctions.find(j=>j.id===wall.b)!,length=Math.abs(b.x-a.x)+Math.abs(b.y-a.y),p=to([a.x+(b.x-a.x)*o.offset/length,a.y+(b.y-a.y)*o.offset/length]);ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));ctx.fillStyle=o.kind==='window'?'#c5dfe6':'#ffffff';ctx.strokeStyle='#668370';ctx.lineWidth=1;ctx.fillRect(-o.width*view.scale/2,-wall.thickness*view.scale/2,o.width*view.scale,wall.thickness*view.scale);ctx.strokeRect(-o.width*view.scale/2,-wall.thickness*view.scale/2,o.width*view.scale,wall.thickness*view.scale);ctx.restore();if(o.kind==='door'){const symbol=openingSymbol(doc,o);line(symbol.arc,'#668370',1);line([symbol.hinge,symbol.leaf],'#668370',2);}}
 ctx.font=`${edge*.011}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#243b2d';
 for(const label of layout.labels){const p=to(label.point);ctx.fillText(label.text,p[0],p[1]-edge*.012,edge*.16);}
 for(const face of snapshot.derived.faces){const room=doc.rooms.find(r=>r.id===face.roomId)!,r=[...face.clearRects].sort((a,b)=>(b[2]-b[0])*(b[3]-b[1])-(a[2]-a[0])*(a[3]-a[1]))[0]!,p=to([(r[0]+r[2])/2,(r[1]+r[3])/2]),area=areaDisplay(face.clearAreaMm2,doc.units);ctx.fillText(room.name,p[0],p[1],edge*.22);ctx.fillText(`${area.value} ${area.unit}`,p[0],p[1]+edge*.018,edge*.22);}
 ctx.font=`${edge*.013}px system-ui`;ctx.fillStyle='#416052';ctx.fillText(layout.watermark,edge/2,edge*.975,edge*.9);ctx.font=`${edge*.010}px system-ui`;ctx.fillText(message(locale,'planImageCentreline'),edge/2,edge*.945,edge*.9);
}
export async function renderPlanImage(snapshot:Snapshot,locale:Locale,edge:1000|2000):Promise<{blob:Blob;layout:PlanImageLayout}> {
 const layout=planImageLayout(snapshot,locale,edge),canvas=document.createElement('canvas');canvas.width=edge;canvas.height=edge;
 let bitmap:ImageBitmap|null=null;
 try {
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('image-context');paintPlanImage(ctx,snapshot,layout,locale);
  const blob=await new Promise<Blob>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('image-timeout')),8000);try{canvas.toBlob(b=>{clearTimeout(timer);if(b&&b.size>0&&b.size<=MAX_PNG_BYTES)resolve(b);else reject(new Error('image-encode'));},'image/png');}catch(e){clearTimeout(timer);reject(e);}});
  const info=inspectPng(new Uint8Array(await blob.arrayBuffer()));if(info.width!==edge||info.height!==edge)throw new Error('image-size');
  bitmap=await new Promise<ImageBitmap>((resolve,reject)=>{let expired=false;const timer=setTimeout(()=>{expired=true;reject(new Error('image-timeout'));},8000);try{void createImageBitmap(blob).then(b=>{clearTimeout(timer);if(expired)b.close();else resolve(b);},e=>{clearTimeout(timer);reject(e);});}catch(e){clearTimeout(timer);reject(e);}});if(bitmap.width!==edge||bitmap.height!==edge)throw new Error('image-size');
  const probe=document.createElement('canvas');probe.width=probe.height=32;const pc=probe.getContext('2d');if(!pc)throw new Error('image-context');pc.drawImage(bitmap,0,0,32,32);const pixels=pc.getImageData(0,0,32,32).data;let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]!>0&&(pixels[i]!<245||pixels[i+1]!<245||pixels[i+2]!<245))colored++;probe.width=probe.height=0;if(colored<2)throw new Error('image-blank');
  return {blob,layout};
 }finally{bitmap?.close();canvas.width=canvas.height=0;}
}
