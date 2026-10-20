/**
 * D78 original top-view furniture symbols for the 2D plan and the plan PNG (display only, never saved).
 * Every symbol is drawn by this file from simple shapes; nothing is copied from another app or icon set.
 *
 * Local frame (millimetres): origin = item centre, +x = the item's right, +y = the item's back (headboard,
 * sofa back, wall side), so the front faces -y. This matches `furnitureFootprint` (right = (c, s),
 * back = (-s, c)) and the 3D model's +z. All points lie inside [-w/2, w/2] x [-d/2, d/2]; strokes are centred
 * on those points, so a drawn line may reach half its pixel width past the footprint edge.
 */
export type SymbolKind='bed'|'bunk'|'sofa'|'sofa_l'|'armchair'|'chair'|'dining_set'|'dining_table'|'table'|'desk'|'round_table'|'stool'|'bench'|'tv'|'wardrobe'|'sliding_wardrobe'|'drawers'|'dressing'|'cabinet'|'shoe'|'bookcase'|'wall_cabinet'|'kitchen'|'island'|'vanity'|'rug'|'plant'|'lamp'|'curtain'|'picture'|'generic';
export interface SymbolPath {
 /** Flat [x0, y0, x1, y1, ...] in local millimetres. */
 readonly points:readonly number[];
 readonly closed:boolean;
 readonly fill?:string;
 readonly stroke?:string;
 /** Stroke width in screen pixels (not scaled with zoom). */
 readonly width?:number;
 readonly dash?:boolean;
 /** Fine detail: skipped when the item is very small on screen. */
 readonly detail?:boolean;
}
export interface FurnitureSymbol {
 readonly kind:SymbolKind;readonly w:number;readonly d:number;readonly main:string;readonly paths:readonly SymbolPath[];
 /** True only for degenerate tiny sizes where minimum part sizes did not fit and points were pulled onto the footprint edge. */
 readonly clipped:boolean;
}
/** The plain furniture colour used before a finish is chosen (unchanged from the earlier rectangles). */
export const DEFAULT_FURNITURE_FILL='#c8af90';

const words=(id:string)=>id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const has=(tokens:readonly string[],...keys:string[])=>tokens.some(t=>keys.some(k=>t===k||k.length>=4&&t.startsWith(k)));
/** Chooses a symbol from the asset id's words, so catalog ids, the older fixture ids and new decor ids all match. */
export function symbolKind(assetId:string):SymbolKind {
 const t=words(assetId);
 if(has(t,'bunk'))return 'bunk';
 if(has(t,'curtain','drape','blind','blinds'))return 'curtain';
 if(has(t,'lamp','light','lantern','chandelier','pendant'))return 'lamp';
 if(has(t,'rug','carpet','mat','dhurrie','durrie'))return 'rug';
 if(has(t,'plant','planter','tree','flower','fern','bonsai','pot'))return 'plant';
 if(has(t,'wardrobe','almirah','closet'))return has(t,'sliding','slider')?'sliding_wardrobe':'wardrobe';
 if(has(t,'dressing'))return 'dressing';
 if(has(t,'picture','painting','poster','art','artwork','photo','canvas','clock','wallart'))return 'picture';
 if(has(t,'island'))return 'island';
 if(has(t,'vanity'))return 'vanity';
 if(has(t,'wall','overhead','upper')&&has(t,'cabinet','unit','cupboard','shelf'))return 'wall_cabinet';
 if(has(t,'kitchen','counter','worktop','pantry'))return 'kitchen';
 if(has(t,'tv','television','entertainment','media'))return 'tv';
 if(has(t,'shoe'))return 'shoe';
 if(has(t,'bookcase','bookshelf','books','shelf','shelves','rack'))return 'bookcase';
 if(has(t,'drawer','chest','dresser','nightstand','bedside'))return 'drawers';
 if(has(t,'sideboard','cabinet','cupboard','buffet','crockery'))return 'cabinet';
 if(has(t,'dining')&&has(t,'set','chairs'))return 'dining_set';
 if(has(t,'armchair','recliner'))return 'armchair';
 if(has(t,'sofa','couch','sectional','loveseat','settee','diwan'))return has(t,'l','sectional','corner','lshape','lshaped')?'sofa_l':'sofa';
 if(has(t,'lounge'))return 'armchair';
 if(has(t,'chair'))return 'chair';
 if(has(t,'bed','cot','crib','mattress'))return 'bed';
 if(has(t,'bench'))return 'bench';
 if(has(t,'stool','pouffe','pouf','ottoman'))return 'stool';
 if(has(t,'desk','study','workstation'))return 'desk';
 if(has(t,'table')&&has(t,'side','end','round'))return 'round_table';
 if(has(t,'dining'))return 'dining_table';
 if(has(t,'table','coffee','console','centre','center'))return 'table';
 if(has(t,'frame','mirror'))return 'picture';
 if(has(t,'storage'))return 'cabinet';
 return 'generic';
}
/** Draw order: rugs lie under everything; wall-hung pieces and curtains draw on top. */
export function symbolLayer(kind:SymbolKind):0|1|2 {return kind==='rug'?0:kind==='wall_cabinet'||kind==='picture'||kind==='curtain'?2:1;}
/** The first number in the id (sofa_3 -> 3, wardrobe_3door -> 3, dining_set_6 -> 6), if any. */
function countIn(assetId:string):number|undefined {for(const t of words(assetId).slice(1)){const m=/^(\d+)(?:[a-z]*)$/.exec(t);if(m&&t!=='l0')return Number(m[1]);}return undefined;}

// ---------- colours ----------
function rgb(color:string):[number,number,number]|null {
 const s=color.trim();let m=/^#([0-9a-f]{6})$/i.exec(s);if(m){const n=parseInt(m[1]!,16);return [n>>16&255,n>>8&255,n&255];}
 m=/^#([0-9a-f]{3})$/i.exec(s);if(m){const [r,g,b]=[...m[1]!].map(c=>parseInt(c+c,16)) as [number,number,number];return [r,g,b];}
 return null;
}
const hex=(c:readonly number[])=>'#'+c.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
/** t = 0 keeps `a`; t = 1 gives `b`. Unknown colour formats are returned unchanged. */
export function mixColor(a:string,b:string,t:number):string {const x=rgb(a),y=rgb(b);return x&&y?hex(x.map((v,i)=>v+(y[i]!-v)*t)):a;}
const shade=(c:string,t:number)=>mixColor(c,'#000000',t),tint=(c:string,t:number)=>mixColor(c,'#ffffff',t);
const LINEN='#f6f2eb',PILLOW='#fdfbf7',SCREEN='#3a3d40',GLASS='#d3e1e6',WORKTOP='#ebe6dd',LEAF='#8db27b',LEAF_DARK='#6f9b61',LEAF_LINE='#4d7446',POT='#d8cdbf',RUG='#c48a6b',RUG_FIELD='#f2e9d8',SHADE='#f3e8cf',PAPER='#f4f0e8';

// ---------- geometry ----------
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
/** Rounded rectangle as a polygon (corner radius clamped to fit). */
function rr(x0:number,y0:number,x1:number,y1:number,r=0):number[] {
 const a=Math.min(x0,x1),b=Math.min(y0,y1),c=Math.max(x0,x1),e=Math.max(y0,y1),q=clamp(r,0,Math.min(c-a,e-b)/2);
 if(q<=0)return [a,b,c,b,c,e,a,e];
 const out:number[]=[],corner=(cx:number,cy:number,start:number)=>{for(let i=0;i<=4;i++){const t=start+i*Math.PI/8;out.push(cx+q*Math.cos(t),cy+q*Math.sin(t));}};
 corner(c-q,b+q,-Math.PI/2);corner(c-q,e-q,0);corner(a+q,e-q,Math.PI/2);corner(a+q,b+q,Math.PI);return out;
}
function ellipse(cx:number,cy:number,rx:number,ry:number,n=28):number[] {const out:number[]=[];for(let i=0;i<n;i++){const t=i*2*Math.PI/n;out.push(cx+rx*Math.cos(t),cy+ry*Math.sin(t));}return out;}
/** Quarter turns (0..3) about the origin, then translation; screen sense (+x toward +y is a positive turn). */
function place(points:readonly number[],cx:number,cy:number,quarter:number):number[] {
 const k=((quarter%4)+4)%4,out:number[]=[];
 for(let i=0;i<points.length;i+=2){const x=points[i]!,y=points[i+1]!,[u,v]=k===0?[x,y]:k===1?[-y,x]:k===2?[-x,-y]:[y,-x];out.push(cx+u,cy+v);}
 return out;
}

class Builder {
 readonly paths:SymbolPath[]=[];
 constructor(readonly line:string){}
 /** stroke: undefined = the symbol's line colour, null = no outline. */
 shape(points:number[],fill:string|undefined,stroke:string|null|undefined=this.line,width=1,extra:{dash?:boolean;detail?:boolean}={}){this.paths.push({points,closed:true,...(fill?{fill}:{}),...(stroke?{stroke,width}:{}),...extra});}
 stroke(points:number[],stroke=this.line,width=.75,extra:{dash?:boolean;detail?:boolean}={}){this.paths.push({points,closed:false,stroke,width,...extra});}
}

// ---------- symbols ----------
type Ctx={b:Builder;W:number;D:number;w:number;d:number;main:string;finish:boolean;assetId:string};

function bed(c:Ctx,bunk:boolean){
 const {b,W,D,w,d,main}=c,hb=clamp(d*.045,30,120),s=clamp(w*.03,12,50);
 b.shape(rr(-W,-D,W,D,Math.min(40,w*.04)),main,undefined,1);
 b.shape(rr(-W,D-hb,W,D,hb*.4),shade(main,.12),undefined,.75);
 const top=D-hb,mattress=[-W+s,-D+s,W-s,top] as const;
 b.shape(rr(mattress[0],mattress[1],mattress[2],mattress[3],Math.min(60,w*.05)),LINEN,undefined,.75);
 const count=bunk||w<1200?1:2,gap=s,pd=clamp(d*.17,80,420),py1=top-s,py0=Math.max(py1-pd,mattress[1]+s),span=mattress[2]-mattress[0]-2*gap,pw=(span-(count-1)*gap)/count;
 for(let i=0;i<count;i++){const x0=mattress[0]+gap+i*(pw+gap),p=rr(x0,py0,x0+pw,py1,pd*.3);b.shape(p,PILLOW,undefined,.75);b.stroke([x0+pw*.18,(py0+py1)/2,x0+pw*.82,(py0+py1)/2],tint(c.b.line,.45),.6,{detail:true});}
 const length=py0-mattress[1],blanketTop=mattress[1]+length*(bunk?.72:.68),fold=clamp(length*.09,30,160);
 if(blanketTop-fold>mattress[1]+s){
  b.shape(rr(-W+s*.5,-D+s*.5,W-s*.5,blanketTop,Math.min(50,w*.04)),tint(main,.3),undefined,.75);
  b.shape(rr(-W+s*.5,blanketTop-fold,W-s*.5,blanketTop,Math.min(20,fold*.4)),tint(main,.55),undefined,.75);
  b.stroke([-W+s*1.6,-D+s*.5+length*.18,-W+s*.5+w*.22,-D+s*.5],shade(tint(main,.3),.25),.6,{detail:true});
 }
 if(bunk){
  const rail=clamp(w*.04,20,50),post=clamp(Math.min(w,d)*.08,30,90),dark=shade(main,.45);
  b.shape(rr(-W+s*.3,-D+post,-W+s*.3+rail,top-post*.2,rail/2),shade(main,.1),undefined,.75);
  const lw=clamp(w*.12,50,140),l0=-D+post*1.2,l1=Math.min(l0+clamp(d*.3,200,700),top-pd-s);
  if(l1>l0+60){b.shape(rr(W-lw,l0,W-s*.3,l1),tint(main,.15),undefined,.75);for(let y=l0+90;y<l1-30;y+=180)b.stroke([W-lw,y,W-s*.3,y],undefined,.75,{detail:true});}
  for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]] as const)b.shape(rr(x<0?-W:W-post,y<0?-D:D-post,x<0?-W+post:W,y<0?-D+post:D,post*.15),dark,shade(dark,.3),.75);
 }
}
function sofa(c:Ctx,seats:number,armchair:boolean){
 const {b,W,D,w,d,main}=c,frame=shade(main,.08),a=Math.min(clamp(w*(armchair?.15:.095),60,220),w*.22),bk=clamp(d*.2,60,240),bc=clamp(d*.17,50,200),f=clamp(d*.025,5,40),g=clamp(w*.008,4,14);
 b.shape(rr(-W,-D,W,D,Math.min(60,a*.5)),frame,undefined,1);
 b.shape(rr(-W+a*.6,D-bk,W-a*.6,D,bk*.3),frame,undefined,.75);
 for(const s of [-1,1])b.shape(rr(s<0?-W:W-a,-D,s<0?-W+a:W,D,a*.45),frame,undefined,.75);
 const x0=-W+a,span=w-2*a,each=span/seats;
 for(let i=0;i<seats;i++){const l=x0+i*each,r=l+each;b.shape(rr(l+g/2,D-bk-bc,r-g/2,D-bk+g,bc*.35),tint(main,.04),undefined,.75);b.shape(rr(l+g/2,-D+f,r-g/2,D-bk-bc,Math.min(60,each*.12)),main,undefined,.75);}
}
function sofaL(c:Ctx){
 const {b,W,D,w,d,main}=c,frame=shade(main,.08),md=d*.5375,cw=w*.32,a=clamp(w*.064,50,220),bk=d*.1375,bc=d*.1125,f=clamp(d*.02,5,40),g=clamp(w*.005,4,14),cx=W-cw,front=D-md;
 b.shape([-W,D,W,D,W,-D,cx,-D,cx,front,-W,front],frame,undefined,1);
 b.shape(rr(-W,front,-W+a,D,a*.45),frame,undefined,.75);
 b.shape(rr(W-a,-D,W,D,a*.45),frame,undefined,.75);
 b.shape(rr(-W+a*.6,D-bk,W-a*.6,D,bk*.3),frame,undefined,.75);
 const backs=3,bw=(w-2*a)/backs;for(let i=0;i<backs;i++){const l=-W+a+i*bw;b.shape(rr(l+g/2,D-bk-bc,l+bw-g/2,D-bk+g,bc*.35),tint(main,.04),undefined,.75);}
 const seats=Math.max(1,Math.round((cx-(-W+a))/550)),each=(cx-(-W+a))/seats;
 for(let i=0;i<seats;i++){const l=-W+a+i*each;b.shape(rr(l+g/2,front+f,l+each-g/2,D-bk-bc,Math.min(60,each*.12)),main,undefined,.75);}
 b.shape(rr(cx+g/2,-D+f,W-a-g/2,D-bk-bc,Math.min(60,cw*.1)),main,undefined,.75);
}
/** One chair in its own frame (back toward +y), w x d centred at the origin. */
function chairPoints(w:number,d:number):{seat:number[];back:number[];inner:number[]} {
 const W=w/2,D=d/2,bb=clamp(d*.1,15,80);
 return {seat:rr(-W,-D,W,D-bb*.4,Math.min(w,d)*.14),back:rr(-W*.9,D-bb,W*.9,D,bb*.45),inner:rr(-W*.72,-D*.78,W*.72,D-bb*1.6,Math.min(w,d)*.1)};
}
function chairAt(b:Builder,cx:number,cy:number,w:number,d:number,quarter:number,fill:string){
 const p=chairPoints(w,d);b.shape(place(p.seat,cx,cy,quarter),fill,undefined,.75);b.shape(place(p.inner,cx,cy,quarter),undefined,tint(b.line,.35),.5,{detail:true});b.shape(place(p.back,cx,cy,quarter),shade(fill,.15),undefined,.75);
}
function tableTop(c:Ctx,x0:number,y0:number,x1:number,y1:number,fill=c.main){
 const r=Math.min(40,Math.abs(x1-x0)*.04,Math.abs(y1-y0)*.08),inset=clamp(Math.min(Math.abs(x1-x0),Math.abs(y1-y0))*.06,6,45);
 c.b.shape(rr(x0,y0,x1,y1,r),fill,undefined,1);
 c.b.shape(rr(x0+inset,y0+inset,x1-inset,y1-inset,r*.6),undefined,tint(c.b.line,.3),.6,{detail:true});
}
function diningSet(c:Ctx){
 const {b,W,D,w,d,main}=c,n=clamp(countIn(c.assetId)??(w>=2200?6:4),2,12),ends=n>=6?2:0,perSide=Math.max(1,Math.ceil((n-ends)/2)),band=Math.min(400,d*.24),bandX=ends?Math.min(400,w*.15):0;
 const tx0=-W+bandX,tx1=W-bandX,ty0=-D+band,ty1=D-band,chair=tint(main,.4);
 const cw=Math.min(450,(tx1-tx0)/perSide-40,w*.45),cd=Math.min(band*1.4,d*.34);
 for(let i=0;i<perSide;i++){const x=tx0+(i+.5)*(tx1-tx0)/perSide;chairAt(b,x,D-cd/2,cw,cd,0,chair);chairAt(b,x,-D+cd/2,cw,cd,2,chair);}
 if(ends){const ew=Math.min(450,(ty1-ty0)-40,d*.45),ed=Math.min(bandX*1.4,w*.2);chairAt(b,-W+ed/2,0,ew,ed,1,chair);chairAt(b,W-ed/2,0,ew,ed,3,chair);}
 tableTop(c,tx0,ty0,tx1,ty1);
}
function roundTop(c:Ctx,ring=.8,dot=.1){const {b,W,D,main}=c;b.shape(ellipse(0,0,W,D,32),main,undefined,1);b.shape(ellipse(0,0,W*ring,D*ring,32),undefined,tint(b.line,.3),.6,{detail:true});if(dot)b.shape(ellipse(0,0,W*dot,D*dot,12),shade(main,.25),undefined,.5,{detail:true});}
function frontStrip(c:Ctx,doors:number,depth:number,fill=shade(c.main,.08)){
 const {b,W,D,w}=c;b.shape([-W,-D,W,-D,W,-D+depth,-W,-D+depth],fill,undefined,.75);
 for(let i=1;i<doors;i++){const x=-W+i*w/doors;b.stroke([x,-D,x,-D+depth]);}
}
function body(c:Ctx,fill=c.main,bevel=true){const {b,W,D,w,d}=c,r=Math.min(20,w*.03,d*.06);b.shape(rr(-W,-D,W,D,r),fill,undefined,1);if(bevel){const i=clamp(Math.min(w,d)*.06,5,30);b.shape(rr(-W+i,-D+i,W-i,D-i,r*.5),undefined,tint(b.line,.35),.6,{detail:true});}}
function handles(c:Ctx,cols:number,depth:number){const {b,W,D,w}=c,hw=Math.min(w/cols*.18,80);for(let i=0;i<cols;i++){const x=-W+(i+.5)*w/cols;b.stroke([x-hw,-D+depth/2,x+hw,-D+depth/2],shade(c.main,.45),1.25,{detail:true});}}
function hangers(c:Ctx,y:number){
 const {b,W,D,w,d}=c,inset=clamp(w*.04,10,60),hh=Math.min(clamp(d*.28,30,200),D-Math.abs(y)-clamp(d*.08,5,40));
 b.stroke([-W+inset,y,W-inset,y],undefined,1);
 if(hh<=5)return;const k=Math.max(2,Math.floor((w-2*inset)/200)),step=(w-2*inset)/k;
 for(let i=0;i<k;i++){const x=-W+inset+(i+.5)*step,dx=Math.min(hh*.35,step*.3);b.stroke([x-dx,y-hh,x+dx,y+hh],tint(b.line,.2),.75,{detail:true});}
}
function wardrobe(c:Ctx,sliding:boolean){
 const {b,W,D,w,d,main}=c,fs=clamp(d*.05,8,45);body(c,main,false);
 if(sliding){const t=clamp(d*.035,6,30);b.shape([-W,-D,W*.06,-D,W*.06,-D+t,-W,-D+t],shade(main,.1),undefined,.75);b.shape([-W*.06,-D+t,W,-D+t,W,-D+2*t,-W*.06,-D+2*t],tint(main,.12),undefined,.75);hangers(c,(-D+2*t+D)/2);return;}
 const doors=clamp(countIn(c.assetId)??Math.max(1,Math.round(w/500)),1,8);frontStrip(c,doors,fs);hangers(c,(-D+fs+D)/2);
}
function storage(c:Ctx,kind:'drawers'|'dressing'|'cabinet'|'shoe'){
 const {b,W,D,w,d,main}=c,fs=clamp(d*.06,8,40);body(c,main,true);
 const doors=kind==='drawers'?1:kind==='dressing'?2:clamp(countIn(c.assetId)??Math.max(1,Math.round(w/(kind==='shoe'?400:500))),1,8);
 frontStrip(c,doors,fs);handles(c,doors,fs);
 if(kind==='dressing'){const mw=w*.35,mt=clamp(d*.07,10,40),y1=D-clamp(d*.02,2,10);b.shape(rr(-mw,y1-mt,mw,y1,mt*.3),shade(main,.3),undefined,.75);b.shape(rr(-mw*.88,y1-mt*.75,mw*.88,y1-mt*.3),GLASS,undefined,.5,{detail:true});}
 if(kind==='shoe'){for(const f of [.35,.55,.75]){const y=-D+fs+(d-fs)*f;b.stroke([-W+w*.08,y,W-w*.08,y],tint(b.line,.4),.5,{detail:true});}}
}
function bookcase(c:Ctx){
 const {b,W,D,w,d,main}=c,side=clamp(w*.025,6,30),back=clamp(d*.06,4,25);
 b.shape(rr(-W,-D,W,D,Math.min(10,w*.02)),main,undefined,1);
 b.shape([-W+side,-D+side*.6,W-side,-D+side*.6,W-side,D-back,-W+side,D-back],tint(main,.25),undefined,.6);
 const bays=Math.max(1,Math.round(w/400));for(let i=1;i<bays;i++){const x=-W+i*w/bays;b.shape([x-side/2,-D+side*.6,x+side/2,-D+side*.6,x+side/2,D-back,x-side/2,D-back],main,undefined,.6);}
 const each=(w-2*side)/bays;
 for(let i=0;i<bays;i++){const l=-W+side+i*each+each*.12,r=l+each*.76,y1=D-back,y0=Math.max(-D+side,y1-(d-back-side)*.7),n=Math.max(3,Math.floor((r-l)/45)),bw=(r-l)/n;
  for(let k=0;k<n;k++)if((k*7+i*3)%5!==4)b.shape([l+k*bw,y0+((k*13+i)%3)*(y1-y0)*.08,l+(k+1)*bw*.92,y0+((k*13+i)%3)*(y1-y0)*.08,l+(k+1)*bw*.92,y1,l+k*bw,y1],k%3===0?shade(main,.18):k%3===1?tint(main,.45):mixColor(main,'#8a9a7b',.4),undefined,.4,{detail:true});}
}
function worktopUnit(c:Ctx,kind:'kitchen'|'island'|'vanity'){
 const {b,W,D,w,d,main}=c,fb=clamp(d*.05,8,40),doors=Math.max(1,Math.round(w/300));
 frontStrip(c,doors,fb,main);
 b.shape(rr(-W,-D+fb,W,D,Math.min(12,w*.02)),WORKTOP,undefined,1);
 if(kind!=='island'){const y=D-clamp(d*.05,6,30);b.stroke([-W,y,W,y],tint(b.line,.2),.75);}
 else{const y=D-d*.22;b.stroke([-W+w*.02,y,W-w*.02,y],tint(b.line,.2),.75,{dash:true});}
 const modules=Math.max(1,Math.round(w/600));for(let i=1;i<modules;i++){const x=-W+i*w/modules;b.stroke([x,-D+fb,x,kind==='island'?D-d*.22:D-clamp(d*.05,6,30)],tint(b.line,.35),.6,{dash:true,detail:true});}
}
function wallCabinet(c:Ctx){
 const {b,W,D,w,main}=c;b.shape(rr(-W,-D,W,D),main,undefined,1,{dash:true});
 b.stroke([-W,-D,W,D],tint(b.line,.25),.6,{dash:true,detail:true});b.stroke([-W,D,W,-D],tint(b.line,.25),.6,{dash:true,detail:true});
 const doors=clamp(countIn(c.assetId)??Math.max(1,Math.round(w/400)),1,8);for(let i=1;i<doors;i++){const x=-W+i*w/doors;b.stroke([x,-D,x,D],undefined,.6,{dash:true});}
}
function rug(c:Ctx){
 const {b,W,D,w,d}=c,border=c.finish?c.main:RUG,band=clamp(Math.min(w,d)*.08,10,140);
 b.shape([-W,-D,W,-D,W,D,-W,D],border,shade(border,.2),.75);
 b.shape([-W+band,-D+band,W-band,-D+band,W-band,D-band,-W+band,D-band],RUG_FIELD,null);
 const i=band*1.6;if(W-i>band&&D-i>band)b.shape([-W+i,-D+i,W-i,-D+i,W-i,D-i,-W+i,D-i],undefined,tint(border,.1),.6,{detail:true});
 const dw=Math.max(0,W-band*2.5)*.42,dd=Math.max(0,D-band*2.5)*.42;if(dw>5&&dd>5){b.shape([0,-dd,dw,0,0,dd,-dw,0],tint(border,.2),null);b.shape([0,-dd*.45,dw*.45,0,0,dd*.45,-dw*.45,0],RUG_FIELD,null,1,{detail:true});}
 for(const sx of [-1,1])for(const sy of [-1,1]){const cx=sx*(W-band*2.2),cy=sy*(D-band*2.2),r=band*.45;if(Math.abs(cx)+r<W-band&&Math.abs(cy)+r<D-band)b.shape([cx,cy-r,cx+r,cy,cx,cy+r,cx-r,cy],tint(border,.2),null,1,{detail:true});}
}
function plant(c:Ctx){
 const {b,W,D}=c,pot=c.finish?c.main:POT;
 b.shape(ellipse(0,0,W*.66,D*.66,28),pot,shade(pot,.3),1);
 // Leaves are drawn in a unit circle and stretched to the footprint ellipse, so they always stay inside it.
 const leaf=(angle:number,r0:number,r1:number,half:number,fill:string,rib:boolean)=>{
  const ca=Math.cos(angle),sa=Math.sin(angle),pts:number[]=[],side=(sign:number)=>{for(let i=0;i<=8;i++){const t=sign>0?i/8:1-i/8,along=r0+(r1-r0)*t,off=sign*half*Math.pow(Math.sin(Math.PI*t),.85)*(1-.25*t);pts.push((along*ca-off*sa)*W,(along*sa+off*ca)*D);}};
  side(1);side(-1);b.shape(pts,fill,LEAF_LINE,.6);if(rib)b.stroke([r0*ca*W,r0*sa*D,r1*.9*ca*W,r1*.9*sa*D],LEAF_LINE,.5,{detail:true});
 };
 for(let i=0;i<8;i++)leaf(i*Math.PI/4+.2,.08,.98,.17,LEAF,true);
 for(let i=0;i<6;i++)leaf(i*Math.PI/3+.65,.05,.66,.15,LEAF_DARK,true);
 b.shape(ellipse(0,0,W*.09,D*.09,12),LEAF_DARK,LEAF_LINE,.5,{detail:true});
}
function lamp(c:Ctx){const {b,W,D}=c,fill=c.finish?c.main:SHADE;b.shape(ellipse(0,0,W,D,32),fill,shade(fill,.35),1);b.shape(ellipse(0,0,W*.42,D*.42,24),tint(fill,.6),shade(fill,.3),.6);for(const [x,y] of [[1,0],[0,1]] as const)b.stroke([-x*W*.86,-y*D*.86,x*W*.86,y*D*.86],shade(fill,.3),.5,{detail:true});}
function curtain(c:Ctx){
 const {b,W,D,w,d,main}=c,rod=D-clamp(d*.05,1,10);b.stroke([-W,rod,W,rod],shade(main,.35),1);
 // The fabric is a filled wavy band in the curtain's colour (lowest point -0.75D, highest 0.45D + 0.24D), so a finish shows in the plan.
 const wave=clamp(w/10,60,240),amp=D*.6,mid=-D*.15,thick=Math.min(clamp(d*.12,4,30),D*.24),n=Math.min(200,Math.ceil(w/Math.min(wave/8,w/16))),top:number[]=[],under:number[]=[];
 for(let i=0;i<=n;i++){const x=-W+w*i/n,y=mid+amp*Math.sin(2*Math.PI*(x+W)/wave);top.push(x,y);under.unshift(x,y+thick);}
 b.shape([...top,...under],main,shade(main,.2),1);
}
function picture(c:Ctx){const {b,W,D,w,d,main}=c,t=clamp(Math.min(w,d)*.25,1,25);b.shape([-W,-D,W,-D,W,D,-W,D],main,shade(main,.3),1);if(W-t>0&&D-t>0)b.shape([-W+t,-D+t,W-t,-D+t,W-t,D-t,-W+t,D-t],PAPER,null);}
function desk(c:Ctx){
 const {b,W,D,w,d}=c;tableTop(c,-W,-D,W,D);
 // Drawer pedestal under the top, drawn dashed like other hidden parts.
 const pw=clamp(w*.33,150,450),x1=W-clamp(w*.03,5,40),x0=Math.max(-W,x1-pw),i=clamp(d*.06,5,30);b.shape(rr(x0,-D+i,x1,D-i),undefined,tint(b.line,.2),.6,{dash:true,detail:true});
}
function generic(c:Ctx){const {b,W,D,w,d}=c;body(c);const i=clamp(Math.min(w,d)*.12,5,60);b.stroke([-W+i,-D+i*.6,W-i,-D+i*.6],tint(b.line,.2),.75,{detail:true});}

function build(assetId:string,w:number,d:number,finish:string|null|undefined):FurnitureSymbol {
 const kind=symbolKind(assetId),main=finish??DEFAULT_FURNITURE_FILL,b=new Builder(shade(main,.38)),c:Ctx={b,W:w/2,D:d/2,w,d,main,finish:!!finish,assetId};
 switch(kind){
  case 'bed':bed(c,false);break;case 'bunk':bed(c,true);break;
  case 'sofa':sofa(c,clamp(countIn(assetId)??Math.round((w-2*clamp(w*.095,60,220))/600),1,6),false);break;
  case 'armchair':sofa(c,1,true);break;case 'sofa_l':sofaL(c);break;
  case 'chair':{const p=chairPoints(w,d);b.shape(p.seat,main,undefined,1);b.shape(p.inner,undefined,tint(b.line,.35),.5,{detail:true});b.shape(p.back,shade(main,.15),undefined,.75);break;}
  case 'dining_set':diningSet(c);break;
  case 'dining_table':case 'table':tableTop(c,-c.W,-c.D,c.W,c.D);break;
  case 'desk':desk(c);break;
  case 'round_table':roundTop(c,.8,.1);break;
  case 'stool':roundTop(c,.68,.08);break;
  case 'bench':{body(c,main,true);const n=Math.max(1,Math.round(w/600));for(let i=1;i<n;i++){const x=-c.W+i*w/n;b.stroke([x,-c.D,x,c.D]);}break;}
  case 'tv':{body(c,main,false);frontStrip(c,3,clamp(d*.1,8,60));const st=clamp(d*.06,8,45),y=c.D*.55;b.shape(rr(-w*.07,y-st-d*.18,w*.07,y-st,d*.04),shade(main,.2),undefined,.75);b.shape(rr(-w*.31,y-st,w*.31,y,st*.3),SCREEN,shade(SCREEN,.3),.75);break;}
  case 'wardrobe':wardrobe(c,false);break;case 'sliding_wardrobe':wardrobe(c,true);break;
  case 'drawers':case 'dressing':case 'cabinet':case 'shoe':storage(c,kind);break;
  case 'bookcase':bookcase(c);break;
  case 'wall_cabinet':wallCabinet(c);break;
  case 'kitchen':case 'island':case 'vanity':worktopUnit(c,kind);break;
  case 'rug':rug(c);break;case 'plant':plant(c);break;case 'lamp':lamp(c);break;case 'curtain':curtain(c);break;case 'picture':picture(c);break;
  default:generic(c);
 }
 // Guard for degenerate tiny items: minimum part sizes can exceed the footprint, so pull such points onto its edge.
 const W=w/2,D=d/2;let clipped=false;
 const paths=b.paths.map(path=>{if(path.points.every((v,i)=>Math.abs(v)<=(i%2?D:W)))return path;clipped=true;return {...path,points:path.points.map((v,i)=>clamp(v,-(i%2?D:W),i%2?D:W))};});
 return Object.freeze({kind,w,d,main,paths:Object.freeze(paths),clipped});
}

const cache=new Map<string,FurnitureSymbol>();
/** Symbol geometry for one item size and finish. Pure and deterministic; results are cached (bounded). */
export function furnitureSymbol(assetId:string,size:{readonly w:number;readonly d:number},finish:string|null|undefined):FurnitureSymbol {
 const key=`${assetId}|${size.w}|${size.d}|${finish??''}`,hit=cache.get(key);if(hit)return hit;
 if(!(size.w>0&&size.d>0&&Number.isFinite(size.w)&&Number.isFinite(size.d)))return Object.freeze({kind:'generic',w:size.w,d:size.d,main:finish??DEFAULT_FURNITURE_FILL,paths:Object.freeze([]),clipped:false});
 const symbol=build(assetId,size.w,size.d,finish);if(cache.size>=512)cache.clear();cache.set(key,symbol);return symbol;
}
export function clearFurnitureSymbolCache():void {cache.clear();}

/** The canvas calls a symbol needs: satisfied by CanvasRenderingContext2D and Konva's scene context. */
export interface SymbolCanvas {
 beginPath():void;moveTo(x:number,y:number):void;lineTo(x:number,y:number):void;closePath():void;fill():void;stroke():void;
 fillStyle:unknown;strokeStyle:unknown;lineWidth:number;lineJoin?:unknown;setLineDash?(segments:number[]):void;
}
/** Below this many screen pixels (short side) fine details are skipped; below MIN only the base shape is drawn. */
export const SYMBOL_DETAIL_PX=16,SYMBOL_MIN_PX=5;
/**
 * Paints a symbol centred on the canvas origin in the item's own frame (the caller translates and rotates),
 * scaling millimetres by `scale` px/mm while keeping line widths in pixels. `outline` strokes the footprint
 * rectangle on top (selection / warning state).
 */
export function paintFurnitureSymbol(ctx:SymbolCanvas,symbol:FurnitureSymbol,scale:number,outline?:{color:string;width:number}|null):void {
 const short=Math.min(symbol.w,symbol.d)*scale,dash=typeof ctx.setLineDash==='function';
 ctx.lineJoin='round';
 const paths=short<SYMBOL_MIN_PX?symbol.paths.slice(0,1):symbol.paths;
 for(const path of paths){
  if(path.detail&&short<SYMBOL_DETAIL_PX)continue;
  const p=path.points;if(p.length<4)continue;
  ctx.beginPath();ctx.moveTo(p[0]!*scale,p[1]!*scale);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i]!*scale,p[i+1]!*scale);if(path.closed)ctx.closePath();
  if(path.fill){ctx.fillStyle=path.fill;ctx.fill();}
  if(path.stroke){ctx.strokeStyle=path.stroke;ctx.lineWidth=path.width??1;if(dash&&path.dash)ctx.setLineDash!([4,3]);ctx.stroke();if(dash&&path.dash)ctx.setLineDash!([]);}
 }
 if(outline){const W=symbol.w*scale/2,D=symbol.d*scale/2;ctx.beginPath();ctx.moveTo(-W,-D);ctx.lineTo(W,-D);ctx.lineTo(W,D);ctx.lineTo(-W,D);ctx.closePath();ctx.strokeStyle=outline.color;ctx.lineWidth=outline.width;ctx.stroke();}
}
/** Items in drawing order (rugs first, wall-hung last); stable within a layer, so the document order is kept. */
export function orderedFurniture<T extends {readonly assetId:string}>(items:readonly T[]):T[] {
 return items.map((item,index)=>({item,index,layer:symbolLayer(symbolKind(item.assetId))})).sort((a,b)=>a.layer-b.layer||a.index-b.index).map(e=>e.item);
}
