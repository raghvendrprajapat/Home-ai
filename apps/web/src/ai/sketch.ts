import type {RoomRectSpec,RoomType} from '@gharplan/core-model';

/**
 * D73 AI-3 photo or sketch to plan. A provider reads a picture into room rectangles (centreline mm, top-left of the
 * picture at 0,0); acceptSketch is the trust boundary that turns any answer into rooms the L0 rules can build:
 * sensible sizes, edges within 300 mm merged onto one 50 mm line, no overlaps, and four-way crossings staggered by
 * 150 mm into two T junctions. The picture itself never leaves the device in test mode.
 */
export const SKETCH_MAX_ROOMS=12;
export const SKETCH_MIN_ROOM_MM=1200;
export const SKETCH_MAX_ROOM_MM=15000;
export const SKETCH_MERGE_MM=300;
export const SKETCH_GRID_MM=50;
export const SKETCH_STAGGER_MM=150;
const TYPES:readonly RoomType[]=['living','bedroom','kitchen','bathroom','dining','pooja','balcony','utility','hall','study','other'];
type Box=[number,number,number,number];
export interface SketchResult {readonly rooms:readonly RoomRectSpec[];readonly dropped:number}
export interface SketchPixels {readonly width:number;readonly height:number;readonly data:Uint8ClampedArray}

const overlap=(a:Box,b:Box)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
/** Groups values that lie within SKETCH_MERGE_MM of their neighbour and moves each group onto its mean, on a 50 mm grid. */
function snapper(values:readonly number[]):(v:number)=>number{
 const sorted=[...new Set(values)].sort((a,b)=>a-b),map=new Map<number,number>();
 for(let i=0;i<sorted.length;){
  let j=i;while(j+1<sorted.length&&sorted[j+1]!-sorted[j]!<=SKETCH_MERGE_MM)j++;
  const group=sorted.slice(i,j+1),mean=group.reduce((s,v)=>s+v,0)/group.length,snapped=Math.round(mean/SKETCH_GRID_MM)*SKETCH_GRID_MM;
  for(const v of group)map.set(v,snapped);i=j+1;
 }
 return v=>map.get(v)!;
}
const size=(b:Box)=>Math.min(b[2]-b[0],b[3]-b[1])>=SKETCH_MIN_ROOM_MM&&Math.max(b[2]-b[0],b[3]-b[1])<=SKETCH_MAX_ROOM_MM;

/** True when walls along the room edges would meet at (x, y) from all four directions. */
function crossing(boxes:readonly Box[],x:number,y:number):boolean{
 const vertical=(at:number)=>boxes.some(b=>(b[0]===x||b[2]===x)&&b[1]<=at&&at<=b[3]),horizontal=(at:number)=>boxes.some(b=>(b[1]===y||b[3]===y)&&b[0]<=at&&at<=b[2]);
 return vertical(y-1)&&vertical(y+1)&&horizontal(x-1)&&horizontal(x+1);
}

export function acceptSketch(raw:unknown):SketchResult{
 const list=Array.isArray(raw)?raw:raw&&typeof raw==='object'&&Array.isArray((raw as {rooms?:unknown}).rooms)?(raw as {rooms:unknown[]}).rooms:[];
 const parsed:{box:Box;type:RoomType}[]=[];let dropped=Math.max(0,list.length-50);
 for(const entry of list.slice(0,50)){
  const e=entry&&typeof entry==='object'?entry as Record<string,unknown>:{},{x,y,width,depth}=e;
  if(![x,y,width,depth].every(v=>typeof v==='number'&&Number.isFinite(v))){dropped++;continue;}
  const box:Box=[Math.round(x as number),Math.round(y as number),Math.round((x as number)+(width as number)),Math.round((y as number)+(depth as number))];
  if(!size(box)||box.some(v=>Math.abs(v)>50000)){dropped++;continue;}
  parsed.push({box,type:TYPES.includes(e.type as RoomType)?e.type as RoomType:'other'});
 }
 // Neighbouring edges onto one line, then drop rooms that became too small or overlap one kept earlier.
 const sx=snapper(parsed.flatMap(p=>[p.box[0],p.box[2]])),sy=snapper(parsed.flatMap(p=>[p.box[1],p.box[3]]));
 const kept:{box:Box;type:RoomType}[]=[];
 for(const p of parsed){
  const box:Box=[sx(p.box[0]),sy(p.box[1]),sx(p.box[2]),sy(p.box[3])];
  if(kept.length>=SKETCH_MAX_ROOMS||!size(box)||kept.some(k=>overlap(k.box,box))){dropped++;continue;}
  kept.push({box,type:p.type});
 }
 // Four-way crossings: move the line east of the crossing 150 mm south for the rooms that touch it there.
 for(let pass=0;pass<SKETCH_MAX_ROOMS*4;pass++){
  const boxes=kept.map(k=>k.box),point=boxes.flatMap(b=>[[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]]] as [number,number][]).find(([x,y])=>crossing(boxes,x,y));
  if(!point)break;
  const [x,y]=point,moved=kept.map(k=>k.box[0]>=x&&(k.box[1]===y||k.box[3]===y)?{...k,box:[k.box[0],k.box[1]===y?y+SKETCH_STAGGER_MM:k.box[1],k.box[2],k.box[3]===y?y+SKETCH_STAGGER_MM:k.box[3]] as Box}:k);
  if(moved.some(k=>!size(k.box))||moved.some((k,i)=>moved.some((o,j)=>i<j&&overlap(k.box,o.box))))break;
  kept.splice(0,kept.length,...moved);
 }
 return {rooms:kept.map(k=>({x:k.box[0],y:k.box[1],width:k.box[2]-k.box[0],depth:k.box[3]-k.box[1],type:k.type})),dropped};
}

/**
 * The offline stand-in reader for clean drawings: dark lines on light paper. It thickens the lines enough to close
 * door gaps up to about 1 m, finds light areas fully enclosed by lines, and reports each as a room rectangle. It is
 * not a vision model: shaded photos, text and furniture symbols can confuse it. Sizes come from the picture's real
 * width that the person enters.
 */
export function readSketch(image:SketchPixels,realWidthMm:number):RoomRectSpec[]{
 const {width:w,height:h,data}=image;
 if(!(w>=16&&h>=16&&w*h<=4_000_000&&data.length===w*h*4)||!(realWidthMm>=2000&&realWidthMm<=60000))return [];
 const mm=realWidthMm/w,gray=new Uint8Array(w*h),histogram=new Array<number>(256).fill(0);
 for(let i=0;i<w*h;i++){const a=data[i*4+3]!/255,v=Math.round((0.299*data[i*4]!+0.587*data[i*4+1]!+0.114*data[i*4+2]!)*a+255*(1-a));gray[i]=v;histogram[v]!++;}
 // Otsu's threshold between ink and paper, kept in a sane range.
 let best=128,top=-1,sum=0,sumB=0,wB=0;for(let v=0;v<256;v++)sum+=v*histogram[v]!;
 for(let v=0;v<256;v++){wB+=histogram[v]!;const wF=w*h-wB;if(!wB||!wF)continue;sumB+=v*histogram[v]!;const between=wB*wF*(sumB/wB-(sum-sumB)/wF)**2;if(between>top){top=between;best=v;}}
 const threshold=Math.min(200,Math.max(60,best));
 const r=Math.max(1,Math.ceil(500/mm)),dark=new Uint8Array(w*h),grown=new Uint8Array(w*h);
 for(let i=0;i<w*h;i++)dark[i]=gray[i]!<=threshold?1:0;
 // Square dilation by r pixels, done as a horizontal then a vertical running count.
 const row=new Uint8Array(w*h);
 for(let y=0;y<h;y++){let count=0;for(let x=-r;x<w;x++){if(x+r<w)count+=dark[y*w+x+r]!;if(x-r-1>=0)count-=dark[y*w+x-r-1]!;if(x>=0)row[y*w+x]=count>0?1:0;}}
 for(let x=0;x<w;x++){let count=0;for(let y=-r;y<h;y++){if(y+r<h)count+=row[(y+r)*w+x]!;if(y-r-1>=0)count-=row[(y-r-1)*w+x]!;if(y>=0)grown[y*w+x]=count>0?1:0;}}
 // Label light areas; any that touch the picture edge are outside.
 const label=new Int32Array(w*h).fill(-1),queue=new Int32Array(w*h),regions:{box:[number,number,number,number];count:number;outside:boolean}[]=[];
 for(let start=0;start<w*h;start++){
  if(grown[start]||label[start]!==-1)continue;
  const id=regions.length,region={box:[w,h,-1,-1] as [number,number,number,number],count:0,outside:false};regions.push(region);
  let head=0,tail=0;queue[tail++]=start;label[start]=id;
  while(head<tail){
   const p=queue[head++]!,x=p%w,y=(p-x)/w;region.count++;
   if(x<region.box[0])region.box[0]=x;if(y<region.box[1])region.box[1]=y;if(x>region.box[2])region.box[2]=x;if(y>region.box[3])region.box[3]=y;
   if(x===0||y===0||x===w-1||y===h-1)region.outside=true;
   for(const q of [x>0?p-1:-1,x<w-1?p+1:-1,y>0?p-w:-1,y<h-1?p+w:-1])if(q>=0&&!grown[q]&&label[q]===-1){label[q]=id;queue[tail++]=q;}
  }
 }
 const minArea=(SKETCH_MIN_ROOM_MM/mm-2*r)**2/2,rooms=regions.filter(g=>!g.outside&&g.count>=Math.max(4,minArea)&&g.count>=0.6*(g.box[2]-g.box[0]+1)*(g.box[3]-g.box[1]+1));
 // Undo the thickening, then go from the inside face to the middle of a 200 mm wall.
 const out=rooms.map(g=>{const [x0,y0,x1,y1]=[(g.box[0]-r)*mm-100,(g.box[1]-r)*mm-100,(g.box[2]+1+r)*mm+100,(g.box[3]+1+r)*mm+100];return {x:Math.round(x0),y:Math.round(y0),width:Math.round(x1-x0),depth:Math.round(y1-y0),area:(x1-x0)*(y1-y0)};});
 // A first guess at room types: the largest is the living room, small ones are bathrooms, the rest bedrooms.
 const largest=out.findIndex(o=>o.area===Math.max(...out.map(p=>p.area)));
 return out.map(({area,...rect},i)=>({...rect,type:i===largest?'living':area<4_500_000?'bathroom':'bedroom'}));
}
