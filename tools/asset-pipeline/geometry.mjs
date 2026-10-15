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
