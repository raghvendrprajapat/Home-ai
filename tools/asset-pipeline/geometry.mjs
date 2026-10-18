import {Buffer} from 'node:buffer';
/** Original closed cube: 24 face vertices, unit outward normals, 12 CCW triangles. */
export function boxData() {
  const faces = [
    [[1,0,0], [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]]],
    [[-1,0,0], [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]]],
    [[0,1,0], [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]]],
    [[0,-1,0], [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]]],
    [[0,0,1], [[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]]],
    [[0,0,-1], [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]],
  ];
  return {
    positions: new Float32Array(faces.flatMap(([,points]) => points.flat())),
    normals: new Float32Array(faces.flatMap(([normal]) => Array.from({length:4}, () => normal).flat())),
    indices: new Uint16Array(faces.flatMap((_,i) => [0,1,2,0,2,3].map(n => n + i*4))),
  };
}

/**
 * D72 original rounded box in mm, centred at 0: the box shrunk by `radius` and pushed back out by `radius` along
 * the direction to its nearest point, so faces stay flat and edges/corners become quarter circles of `segments`
 * steps. The outer extent stays exactly `size`. Smooth normals; seams between faces carry equal normals.
 */
export function roundedBoxData(size,radius,segments) {
  const half=size.map(n=>n/2),r=Math.min(radius,...half),core=half.map(h=>h-r);
  const samples=core.map(c=>{const side=Array.from({length:segments+1},(_,i)=>c+r*Math.cos(Math.PI/2*i/segments));
    return [...side.map(n=>-n),...side.reverse()].filter((n,i,all)=>i===0||Math.abs(n-all[i-1])>1e-9);});
  const positions=[],normals=[],indices=[];
  for(const [k,u,v]of [[0,1,2],[1,2,0],[2,0,1]])for(const sign of [1,-1]){
    const su=samples[u],sv=samples[v],base=positions.length/3;
    for(const a of su)for(const b of sv){
      const p=[0,0,0];p[k]=sign*half[k];p[u]=a;p[v]=b;
      const inner=p.map((n,i)=>Math.max(-core[i],Math.min(core[i],n))),d=p.map((n,i)=>n-inner[i]),l=Math.hypot(...d);
      positions.push(...inner.map((n,i)=>n+r*d[i]/l));normals.push(...d.map(n=>n/l));
    }
    for(let i=0;i+1<su.length;i++)for(let j=0;j+1<sv.length;j++){
      const a=base+i*sv.length+j,b=a+sv.length,quad=[a,b,b+1,a,b+1,a+1];
      indices.push(...(sign>0?quad:[quad[0],quad[2],quad[1],quad[3],quad[5],quad[4]]));
    }
  }
  return {positions,normals,indices};
}

/** D72 original closed elliptic cylinder in mm along `axis` ('x'|'y'|'z'), fitting `size`; segments is a multiple of 4. */
export function cylinderData(size,axis,segments) {
  const k='xyz'.indexOf(axis),[u,v]=[[1,2],[2,0],[0,1]][k],ru=size[u]/2,rv=size[v]/2,h=size[k]/2,positions=[],normals=[],indices=[];
  const point=(t,end)=>{const p=[0,0,0];p[k]=end*h;p[u]=ru*Math.cos(t);p[v]=rv*Math.sin(t);return p;};
  const angles=Array.from({length:segments},(_,i)=>2*Math.PI*i/segments);
  for(const t of angles)for(const end of [-1,1]){const n=[0,0,0];n[u]=Math.cos(t)/ru;n[v]=Math.sin(t)/rv;const l=Math.hypot(...n);positions.push(...point(t,end));normals.push(...n.map(x=>x/l));}
  for(let i=0;i<segments;i++){const a=i*2,b=((i+1)%segments)*2;indices.push(a,b,a+1,a+1,b,b+1);}
  for(const end of [-1,1]){
    const base=positions.length/3,n=[0,0,0];n[k]=end;positions.push(...point(0,end).map((x,i)=>i===k?x:0));normals.push(...n);
    for(const t of angles){positions.push(...point(t,end));normals.push(...n);}
    for(let i=0;i<segments;i++){const a=base+1+i,b=base+1+(i+1)%segments;indices.push(...(end>0?[base,a,b]:[base,b,a]));}
  }
  return {positions,normals,indices};
}

/**
 * D72 preview of baked meshes in the `thumbnail` view (front-right, above; the model front is −Z). Every part is
 * convex, so its own front faces never overlap: parts are painted far to near, and each part's faces are merged into
 * one path per (quantized) shade. Faces turned away and sub-pixel slivers are dropped.
 */
export function meshThumbnail(meshes) {
  const view=[1,1,-1],light=[.4,.8,-.45].map(n=>n/Math.hypot(.4,.8,.45)),project=([x,y,z])=>[x+z,(x-z)*.5-y],parts=[];
  const channel=(hex,i,shade)=>Math.min(255,Math.round(parseInt(hex.slice(1+2*i,3+2*i),16)*shade)).toString(16).padStart(2,'0');
  for(const mesh of meshes){
    const faces=[];let depth=0;
    for(let i=0;i<mesh.indices.length;i+=3){
      const p=[0,1,2].map(n=>[0,1,2].map(axis=>mesh.positions[mesh.indices[i+n]*3+axis]));
      const e=p[1].map((x,a)=>x-p[0][a]),f=p[2].map((x,a)=>x-p[0][a]),n=[e[1]*f[2]-e[2]*f[1],e[2]*f[0]-e[0]*f[2],e[0]*f[1]-e[1]*f[0]],l=Math.hypot(...n);
      if(!(l>0)||n.reduce((s,x,a)=>s+x*view[a],0)<=0)continue;
      const shade=Math.round((.6+.4*Math.max(0,n.reduce((s,x,a)=>s+x*light[a],0)/l))*20)/20;
      faces.push({points:p.map(project),color:`#${[0,1,2].map(c=>channel(mesh.color,c,shade)).join('')}`});
    }
    for(let i=0;i<mesh.positions.length;i+=3)depth+=mesh.positions[i]+mesh.positions[i+1]-mesh.positions[i+2];
    parts.push({faces,depth:depth/(mesh.positions.length/3)});
  }
  const points=parts.flatMap(p=>p.faces.flatMap(f=>f.points)),min=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  const scale=224/Math.max(max[0]-min[0],max[1]-min[1]),pixel=([x,y])=>[Math.round((128+(x-(min[0]+max[0])/2)*scale)*10)/10,Math.round((128+(y-(min[1]+max[1])/2)*scale)*10)/10];
  let body='';
  for(const part of parts.sort((a,b)=>a.depth-b.depth)){
    const paths=new Map();
    for(const face of part.faces){
      const [a,b,c]=face.points.map(pixel);
      if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<.02)continue;
      paths.set(face.color,(paths.get(face.color)??'')+`M${a}L${b}L${c}Z`);
    }
    for(const [color,d]of paths)body+=`<path d="${d}" fill="${color}" stroke="${color}" stroke-width="0.5" stroke-linejoin="round"/>`;
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#eef2e9"/>${body}</svg>\n`);
}

/** A stylized original SVG preview; it is not a rendered/material quality claim. */
export function thumbnail(parts) {
  const polygons = [];
  for (const part of parts) {
    const corners = Array.from({length:8}, (_,i) => [0,1,2].map(axis => part.center[axis] + (i & (1<<axis) ? .5 : -.5)*part.size[axis]));
    for (const face of [[1,3,7,5],[2,6,7,3],[0,2,3,1]]) {
      const points = face.map(i => corners[i]);
      polygons.push({points:points.map(([x,y,z]) => [x+z,(x-z)*.5-y]),depth:points.reduce((n,[x,y,z]) => n+x+y-z,0)/4,color:part.color});
    }
  }
  const points=polygons.flatMap(p=>p.points),min=[0,1].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1].map(i=>Math.max(...points.map(p=>p[i])));
  const scale=224/Math.max(max[0]-min[0],max[1]-min[1]);
  const body=polygons.sort((a,b)=>a.depth-b.depth).map(p=>`<polygon points="${p.points.map(([x,y])=>`${(128+(x-(min[0]+max[0])/2)*scale).toFixed(3)},${(128+(y-(min[1]+max[1])/2)*scale).toFixed(3)}`).join(' ')}" fill="${p.color}" stroke="#314a3d" stroke-width="0.7"/>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#eef2e9"/>${body}</svg>\n`);
}
