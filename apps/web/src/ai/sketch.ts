import type {DoorPointSpec,RoomRectSpec,RoomType} from '@gharplan/core-model';

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
export interface SketchResult {readonly rooms:readonly RoomRectSpec[];readonly doors:readonly DoorPointSpec[];readonly dropped:number}
/** A door gap found by a reader: its centre, width and the direction of the wall it is in. */
export interface SketchDoor {readonly x:number;readonly y:number;readonly width:number;readonly wall:'vertical'|'horizontal'}
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
 // Doors: 600-1500 mm, moved onto the nearest final room edge of the same direction (within 300 mm) that holds the
 // whole door; the same door read from both rooms of a shared wall is kept once.
 const rawDoors=raw&&typeof raw==='object'&&!Array.isArray(raw)&&Array.isArray((raw as {doors?:unknown}).doors)?(raw as {doors:unknown[]}).doors:[];
 const boxes=kept.map(k=>k.box),doors:{door:DoorPointSpec;vertical:boolean;line:number;along:number}[]=[];
 dropped+=Math.max(0,rawDoors.length-40);
 for(const entry of rawDoors.slice(0,40)){
  const e=entry&&typeof entry==='object'?entry as Record<string,unknown>:{},{x,y,width,wall}=e;
  if(![x,y,width].every(v=>typeof v==='number'&&Number.isFinite(v))||wall!=='vertical'&&wall!=='horizontal'){dropped++;continue;}
  const vertical=wall==='vertical',w=Math.round((width as number)/SKETCH_GRID_MM)*SKETCH_GRID_MM,across=(vertical?x:y) as number,along=Math.round((vertical?y:x) as number/SKETCH_GRID_MM)*SKETCH_GRID_MM;
  let line:number|undefined,best=SKETCH_MERGE_MM;
  for(const b of boxes){const [lo,hi]=vertical?[b[1],b[3]]:[b[0],b[2]];if(along-w/2<lo||along+w/2>hi)continue;for(const edge of vertical?[b[0],b[2]]:[b[1],b[3]])if(Math.abs(edge-across)<=best){best=Math.abs(edge-across);line=edge;}}
  if(w<600||w>1500||line===undefined){dropped++;continue;}
  if(doors.some(d=>d.vertical===vertical&&d.line===line&&Math.abs(d.along-along)<SKETCH_MERGE_MM))continue;
  doors.push({door:vertical?{x:line,y:along,width:w}:{x:along,y:line,width:w},vertical,line,along});
 }
 return {rooms:kept.map(k=>({x:k.box[0],y:k.box[1],width:k.box[2]-k.box[0],depth:k.box[3]-k.box[1],type:k.type})),doors:doors.map(d=>d.door),dropped};
}

/**
 * The offline stand-in reader for clean drawings: dark lines on light paper. It thickens the lines enough to close
 * door gaps up to about 1 m, finds light areas fully enclosed by lines, and reports each as a room rectangle. It is
 * not a vision model: shaded photos, text and furniture symbols can confuse it. Sizes come from the picture's real
 * width that the person enters. Door gaps of 600-1000 mm in a room's outline are reported as doors.
 */
export function readSketch(image:SketchPixels,realWidthMm:number):{rooms:RoomRectSpec[];doors:SketchDoor[]}{
 const {width:w,height:h,data}=image;
 if(!(w>=16&&h>=16&&w*h<=4_000_000&&data.length===w*h*4)||!(realWidthMm>=2000&&realWidthMm<=60000))return {rooms:[],doors:[]};
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
 // Doors: along each side of a room, a 600-1000 mm stretch with no ink in the 3 pixels just outside it. Wider gaps are
 // not closed by the thickening, so such rooms already read as one.
 const doors:SketchDoor[]=[],ink=(x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h&&dark[y*w+x]===1,band=(test:(k:number)=>boolean)=>test(1)||test(2)||test(3);
 const gaps=(from:number,to:number,blocked:(i:number)=>boolean,make:(centreMm:number,widthMm:number)=>SketchDoor)=>{
  for(let i=from;i<=to;){if(blocked(i)){i++;continue;}let j=i;while(j+1<=to&&!blocked(j+1))j++;const width=(j-i+1)*mm;if(width>=600&&width<=1000)doors.push(make(Math.round((i+j+1)/2*mm),Math.round(width)));i=j+1;}
 };
 for(const g of rooms){
  const [ix0,iy0,ix1,iy1]=[g.box[0]-r,g.box[1]-r,g.box[2]+r,g.box[3]+r];
  gaps(iy0,iy1,i=>band(k=>ink(ix0-k,i)),(c,width)=>({x:Math.round(ix0*mm-100),y:c,width,wall:'vertical'}));
  gaps(iy0,iy1,i=>band(k=>ink(ix1+k,i)),(c,width)=>({x:Math.round((ix1+1)*mm+100),y:c,width,wall:'vertical'}));
  gaps(ix0,ix1,i=>band(k=>ink(i,iy0-k)),(c,width)=>({x:c,y:Math.round(iy0*mm-100),width,wall:'horizontal'}));
  gaps(ix0,ix1,i=>band(k=>ink(i,iy1+k)),(c,width)=>({x:c,y:Math.round((iy1+1)*mm+100),width,wall:'horizontal'}));
 }
 return {rooms:out.map(({area,...rect},i)=>({...rect,type:i===largest?'living':area<4_500_000?'bathroom':'bedroom'})),doors};
}
