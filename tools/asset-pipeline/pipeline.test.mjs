import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,mkdir,rm,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import fc from 'fast-check';
import {NodeIO} from '@gltf-transform/core';
import {boxData,thumbnail,roundedBoxData,cylinderData} from './geometry.mjs';
import {compileSource,validateSource,validateModernSource,FINISHES,inspectGlb,binaryProfile,sha256,createAssetDocument,modernMeshes,mergeMeshes} from './model.mjs';
import {runPipeline,defaults,assertImmutable} from './pipeline.mjs';
import {verifyVersions} from './versions.mjs';

const structuredClone=globalThis.structuredClone;
const name='a_demo_table-v1.json',sourcePath=`tools/asset-pipeline/sources/${name}`;
const bytes=await readFile(join(defaults.sourceDir,name)),source=JSON.parse(bytes);
const near=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const minus=(a,b)=>a.map((v,i)=>v-b[i]);

test('AST-002/003 analytical cube area, positive volume, unit normals and welded closure across generated mm dimensions',()=>{
  fc.assert(fc.property(fc.tuple(...Array.from({length:3},()=>fc.integer({min:1,max:20000}))),fc.tuple(...Array.from({length:3},()=>fc.integer({min:-20000,max:20000}))),(size,center)=>{
    const {positions,normals,indices}=boxData(),point=i=>[0,1,2].map(axis=>(positions[i*3+axis]*size[axis]+center[axis])/1000),edges=new Map();let area=0,volume=0;
    assert.equal(positions.length,72);assert.equal(indices.length,36);
    for(let i=0;i<indices.length;i+=3){
      const a=point(indices[i]),b=point(indices[i+1]),c=point(indices[i+2]),normal=cross(minus(b,a),minus(c,a)),n=[0,1,2].map(axis=>normals[indices[i]*3+axis]);
      assert.ok(dot(normal,n)>0);near(Math.hypot(...n),1);area+=Math.hypot(...normal)/2;volume+=dot(a,cross(b,c))/6;
      for(const [from,to]of [[a,b],[b,c],[c,a]]){const edge=[from.join(','),to.join(',')].sort().join(':');edges.set(edge,(edges.get(edge)??0)+1);}
    }
    const [w,h,d]=size.map(n=>n/1000);near(area,2*(w*h+w*d+h*d),1e-6);near(volume,w*h*d,1e-6);assert.equal(edges.size,18);assert.ok([...edges.values()].every(n=>n===2));
  }),{numRuns:100,seed:401});
});

test('AST-002/003 actual decoded GLB is metre/Y-up/base-centred, correct dimensions/front and independently positive closed volume',async()=>{
  const compiled=await compileSource(bytes,sourcePath),glb=compiled.files.get(compiled.entry.lods[0].path),doc=await new NodeIO().readBinary(glb);
  assert.equal(compiled.entry.inspection.validator.errors,0);assert.equal(compiled.entry.inspection.validator.warnings,0);assert.equal(compiled.entry.inspection.triangles,72);
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let volume=0;const nodes=doc.getRoot().getDefaultScene().listChildren();assert.equal(nodes.length,6);
  for(const node of nodes){
    const matrix=node.getWorldMatrix(),world=values=>[0,1,2].map(i=>matrix[i]*values[0]+matrix[4+i]*values[1]+matrix[8+i]*values[2]+matrix[12+i]);
    for(const primitive of node.getMesh().listPrimitives()){
      const positions=primitive.getAttribute('POSITION'),indices=primitive.getIndices(),points=Array.from({length:positions.getCount()},(_,i)=>world(positions.getElement(i,[])));
      for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
      for(let i=0;i<indices.getCount();i+=3){const a=points[indices.getScalar(i)],b=points[indices.getScalar(i+1)],c=points[indices.getScalar(i+2)];volume+=dot(a,cross(b,c))/6;}
      if(node.getName()==='front-drawer'){near(Math.min(...points.map(p=>p[2])),-.3);near(Math.max(...points.map(p=>p[2])),-.28);assert.ok(points.every(p=>p[2]<0));}
    }
    if(node.getName()==='top'){assert.deepEqual(node.getTranslation(),[0,.725,0]);assert.deepEqual(node.getScale(),[1.2,.05,.6]);}
  }
  min.forEach((n,i)=>near(n,[-.6,0,-.3][i]));max.forEach((n,i)=>near(n,[.6,.75,.3][i]));near(volume,.0446);
  assert.equal(compiled.entry.lods[0].sha256,sha256(glb));assert.equal(compiled.entry.lods[0].path,compiled.entry.lods[1].path);assert.equal(compiled.entry.sourceSha256,sha256(bytes));
});

test('AST-001 missing/false rights, wrong provenance, invalid date and unsupported source values cannot compile',async()=>{
  for(const mutate of [s=>{delete s.license;},s=>{delete s.license.checkedOn;},s=>{s.license.commercialUse=false;},s=>{s.license.redistributionInApp=false;},s=>{s.license.type='CC0-1.0';},s=>{s.license.url='https://example.com/unverified';},s=>{s.license.checkedOn='2026-02-31';},s=>{s.license.checkedOn='9999-99-99';},s=>{s.version=.5;},s=>{s.parts[0].size[0]=.4;},s=>{s.parts[0].color='unlicensed texture';},s=>{s.parts[1].name=s.parts[0].name;},s=>{s.extra='unsupported';}]){
    const changed=structuredClone(source);mutate(changed);assert.throws(()=>validateSource(changed,sourcePath),/source-/);await assert.rejects(compileSource(Buffer.from(JSON.stringify(changed)),sourcePath),/source-/);
  }
});

test('AST-002 triangle budget counts placed mesh instances; missing normals and wrong physical bounds fail admission',async()=>{
  const doc=createAssetDocument(source),io=new NodeIO(),glb=await io.writeBinary(doc);await assert.rejects(inspectGlb(glb,source.dims,71),/triangle-budget/);assert.equal((await inspectGlb(glb,source.dims,72)).triangles,72);
  await assert.rejects(inspectGlb(glb,{...source.dims,w:1201},3000),/asset-bounds/);doc.getRoot().getDefaultScene().listChildren()[0].setTranslation([0,.726,0]);await assert.rejects(inspectGlb(await io.writeBinary(doc),source.dims,3000),/asset-bounds/);
  const noNormals=createAssetDocument(source);noNormals.getRoot().listMeshes()[0].listPrimitives()[0].setAttribute('NORMAL',null);await assert.rejects(inspectGlb(await io.writeBinary(noNormals),source.dims,3000),/asset-/);
});

function wrapProfile(profile){const text=Buffer.from(JSON.stringify({asset:{version:'2.0'},...profile})),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);const result=Buffer.alloc(20+padded.length);result.writeUInt32LE(0x46546c67,0);result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(padded.length,12);result.writeUInt32LE(0x4e4f534a,16);padded.copy(result,20);return result;}
test('AST-002 official validator rejects damaged GLB; static profile refuses external, textured, animated, skin, camera and line payloads',async()=>{
  const compiled=await compileSource(bytes,sourcePath),glb=Buffer.from(compiled.files.get(compiled.entry.lods[0].path));glb[0]=0;await assert.rejects(inspectGlb(glb,source.dims,3000),/header/);
  for(const profile of [{buffers:[{uri:'https://example.com/model.bin'}]},{images:[{}]},{textures:[{}]},{animations:[{}]},{skins:[{}]},{cameras:[{}]},{extensionsUsed:['UNSUPPORTED']},{meshes:[{primitives:[{mode:1}]}]},{meshes:[{primitives:[{targets:[{}]}]}]}])assert.throws(()=>binaryProfile(wrapProfile(profile)),/unsupported-profile/);
  await assert.rejects(inspectGlb(wrapProfile({meshes:[{primitives:[{}]}]}),source.dims,3000),/validator-errors/);
});

test('AST-003 generated thumbnails have256px dimensions and finite framed vertices for varied original boxes',()=>{
  fc.assert(fc.property(fc.tuple(...Array.from({length:3},()=>fc.integer({min:1,max:20000}))),size=>{
    const svg=thumbnail([{center:[0,size[1]/2,0],size,color:'#aabbcc'}]).toString('utf8');assert.match(svg,/width="256" height="256"/);assert.doesNotMatch(svg,/NaN|Infinity|<script|href=/);
    const points=[...svg.matchAll(/points="([^"]+)"/g)].flatMap(m=>m[1].split(/[ ,]/).map(Number));assert.equal(points.length,24);assert.ok(points.every(n=>Number.isFinite(n)&&n>=16&&n<=240));
  }),{numRuns:100,seed:402});
});

// D72 modern original shapes. Expected values are analytic formulas, not values produced by the generators.
function solid({positions,normals,indices}){
  const point=i=>[positions[i*3],positions[i*3+1],positions[i*3+2]],key=p=>p.map(n=>n.toFixed(6)).join(','),edges=new Map(),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let volume=0,outward=true,unit=true;
  for(let i=0;i<positions.length/3;i++){const p=point(i),n=normals.slice(i*3,i*3+3);p.forEach((v,a)=>{min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);});if(Math.abs(Math.hypot(...n)-1)>1e-9)unit=false;if(dot(p,n)<=0)outward=false;}
  for(let i=0;i<indices.length;i+=3){const [a,b,c]=[0,1,2].map(k=>point(indices[i+k]));volume+=dot(a,cross(b,c))/6;
    for(const [from,to]of [[a,b],[b,c],[c,a]]){if(key(from)===key(to))continue;const edge=key(from)+'>'+key(to);edges.set(edge,(edges.get(edge)??0)+1);}}
  // Watertight and consistently wound: every directed edge appears once and its reverse exactly once.
  const closed=[...edges].every(([edge,count])=>{const [f,t]=edge.split('>');return count===1&&edges.get(t+'>'+f)===1;});
  return {min,max,volume,closed,outward,unit};
}
test('D72 rounded box: exact outer size, closed outward surface, unit normals, volume between flat-slab and true rounded volume',()=>{
  fc.assert(fc.property(fc.tuple(...Array.from({length:3},()=>fc.integer({min:2,max:3000}))),fc.integer({min:1,max:1500}),fc.integer({min:1,max:3}),(size,wish,segments)=>{
    const radius=Math.max(1,Math.min(wish,Math.floor(Math.min(...size)/2))),s=solid(roundedBoxData(size,radius,segments)),[a,b,c]=size,r=radius,[x,y,z]=[a-2*r,b-2*r,c-2*r];
    s.min.forEach((v,i)=>near(v,-size[i]/2,1e-9));s.max.forEach((v,i)=>near(v,size[i]/2,1e-9));assert.ok(s.closed&&s.outward&&s.unit);
    const slabs=x*y*z+2*r*(x*y+y*z+x*z),rounded=slabs+Math.PI*r*r*(x+y+z)+4/3*Math.PI*r**3;
    assert.ok(s.volume>=slabs-1e-6*a*b*c&&s.volume<=rounded+1e-6*a*b*c,`${s.volume} outside [${slabs}, ${rounded}]`);
  }),{numRuns:100,seed:721});
});
test('D72 cylinder: exact extents and the inscribed n-gon prism volume (n/2)·ru·rv·sin(2π/n)·length on every axis',()=>{
  fc.assert(fc.property(fc.tuple(...Array.from({length:3},()=>fc.integer({min:1,max:3000}))),fc.constantFrom('x','y','z'),fc.constantFrom(8,12,16,24),(size,axis,n)=>{
    const s=solid(cylinderData(size,axis,n)),k='xyz'.indexOf(axis),[u,v]=[[1,2],[2,0],[0,1]][k];
    s.min.forEach((m,i)=>near(m,-size[i]/2,1e-9));s.max.forEach((m,i)=>near(m,size[i]/2,1e-9));assert.ok(s.closed&&s.unit);
    near(s.volume,n/2*(size[u]/2)*(size[v]/2)*Math.sin(2*Math.PI/n)*size[k],1e-6*size[0]*size[1]*size[2]);
  }),{numRuns:100,seed:722});
});
const modernName='a_l0_sofa_3-v2.json',modernPath=`tools/asset-pipeline/sources/${modernName}`,modernBytes=await readFile(join(defaults.sourceDir,modernName)),modern=JSON.parse(modernBytes);
test('D72 modern source compiles to one untransformed node per part with finish materials, exact bounds and a bounded preview',async()=>{
  const compiled=await compileSource(modernBytes,modernPath),glb=compiled.files.get(compiled.entry.lods[0].path),doc=await new NodeIO().readBinary(glb),nodes=doc.getRoot().getDefaultScene().listChildren();
  assert.equal(compiled.entry.inspection.validator.errors,0);assert.deepEqual(nodes.map(n=>n.getName()),modern.parts.map(p=>p.name));
  for(const [i,node]of nodes.entries()){const p=modern.parts[i],m=node.getMesh().listPrimitives()[0].getMaterial();assert.deepEqual(node.getTranslation(),[0,0,0]);assert.deepEqual(node.getScale(),[1,1,1]);assert.equal(m.getName(),`${p.color}-${p.finish}`);assert.deepEqual([m.getMetallicFactor(),m.getRoughnessFactor()],{matte:[0,.85],satin:[0,.5],gloss:[0,.25],metal:[.35,.4]}[p.finish]);}
  assert.deepEqual(Object.keys(FINISHES).sort(),['gloss','matte','metal','satin']);
  // Parts per shape: rounded boxes with flat faces give 6·(2s+1)² quads, 8-sided cylinders 4·8 triangles.
  const expected=modern.parts.reduce((n,p)=>n+(p.shape==='cylinder'?4*p.segments:p.shape==='box'?12:12*(2*p.segments+1)**2),0);assert.equal(compiled.entry.inspection.triangles,expected);assert.equal(expected,2744);
  const svg=compiled.files.get(compiled.entry.thumb.path).toString('utf8');assert.ok(svg.length<=128*1024);assert.doesNotMatch(svg,/NaN|Infinity|<script|href=/);
  const points=[...svg.matchAll(/[ML]([-\d.]+),([-\d.]+)/g)].flatMap(m=>[Number(m[1]),Number(m[2])]);assert.ok(points.length>100&&points.every(n=>n>=15.9&&n<=240.1));
});
test('D72 modern sources reject unknown shapes/finishes, oversized radii, unsupported segments, extra keys and schema-1 parts',async()=>{
  for(const mutate of [s=>{s.parts[0].shape='sphere';},s=>{s.parts[4].finish='chrome';},s=>{delete s.parts[4].finish;},s=>{s.parts[4].radius=111;},s=>{s.parts[4].segments=4;},s=>{s.parts[0].segments=10;},s=>{s.parts[0].axis='w';},s=>{s.parts[0].radius=5;},s=>{s.parts[4].center[0]=.5;},s=>{s.parts.push({...s.parts[0]});},s=>{s.license.type='CC0-1.0';},s=>{s.extra=true;},s=>{s.parts=[{name:'box',center:[0,0,0],size:[1,1,1],color:'#000000'}];}]){
    const changed=structuredClone(modern);mutate(changed);assert.throws(()=>validateModernSource(changed,modernPath),/source-/);await assert.rejects(compileSource(Buffer.from(JSON.stringify(changed)),modernPath),/source-/);
  }
  const wrongSize=structuredClone(modern);wrongSize.dims.w=2101;await assert.rejects(compileSource(Buffer.from(JSON.stringify(wrongSize)),modernPath),/asset-bounds/);
});

// D77 opt-in merge: parts that share colour and finish become one node, so a model costs one draw call per material.
// Expected names, counts and triangle totals are written by hand from the sofa source (4 wooden legs, then 10 fabric parts).
test('D77 mergeByMaterial bakes parts sharing colour and finish into one node per material; triangles, bounds and preview stay the same',async()=>{
  const merged=structuredClone(modern);merged.mergeByMaterial=true;const mergedBytes=Buffer.from(JSON.stringify(merged));
  const plain=await compileSource(modernBytes,modernPath),joined=await compileSource(mergedBytes,modernPath);
  const read=async compiled=>(await new NodeIO().readBinary(compiled.files.get(compiled.entry.lods[0].path))).getRoot().getDefaultScene().listChildren();
  const plainNodes=await read(plain),joinedNodes=await read(joined);
  assert.equal(plainNodes.length,14);assert.deepEqual(joinedNodes.map(n=>n.getName()),['leg-lf940','base']);
  assert.deepEqual(joinedNodes.map(n=>n.getMesh().listPrimitives()[0].getMaterial().getName()),['#8a5a3a-satin','#868a90-matte']);
  for(const node of joinedNodes){assert.deepEqual(node.getTranslation(),[0,0,0]);assert.deepEqual(node.getScale(),[1,1,1]);assert.equal(node.getMesh().listPrimitives().length,1);}
  // Four 8-sided legs: 4·32 triangles; the rest of the 2744 are fabric.
  const triangles=node=>node.getMesh().listPrimitives()[0].getIndices().getCount()/3;assert.deepEqual(joinedNodes.map(triangles),[128,2744-128]);
  assert.equal(joined.entry.inspection.triangles,2744);assert.deepEqual(joined.entry.inspection.bounds,plain.entry.inspection.bounds);
  // Same vertices: each merged node holds exactly the vertices of the parts of its material, in source order.
  const points=node=>Array.from(node.getMesh().listPrimitives()[0].getAttribute('POSITION').getArray());
  assert.deepEqual(points(joinedNodes[0]),plainNodes.slice(0,4).flatMap(points));assert.deepEqual(points(joinedNodes[1]),plainNodes.slice(4).flatMap(points));
  assert.equal(joined.entry.thumb.sha256,plain.entry.thumb.sha256);assert.notEqual(joined.entry.lods[0].sha256,plain.entry.lods[0].sha256);
  assert.equal(joined.entry.inspection.validator.errors,0);assert.equal(joined.entry.inspection.validator.warnings,0);
});
test('D77 every published source without mergeByMaterial still compiles to its exact published GLB and preview',async()=>{
  const published=JSON.parse(await readFile(join(defaults.outputDir,'catalog.json'))).assets;let unchanged=0;
  for(const entry of published){
    const file=`${entry.id}-v${entry.version}.json`,raw=await readFile(join(defaults.sourceDir,file));if(Object.hasOwn(JSON.parse(raw),'mergeByMaterial'))continue;
    const compiled=await compileSource(raw,`tools/asset-pipeline/sources/${file}`);assert.equal(compiled.entry.lods[0].sha256,entry.lods[0].sha256,file);assert.equal(compiled.entry.thumb.sha256,entry.thumb.sha256,file);unchanged++;
  }
  // The 68 versions published before D77 carry no merge key.
  assert.ok(unchanged>=68,String(unchanged));
});
test('D77 mergeByMaterial accepts only true on schemaVersion 3 sources',async()=>{
  for(const value of [false,'yes',1,null]){const changed=structuredClone(modern);changed.mergeByMaterial=value;assert.throws(()=>validateModernSource(changed,modernPath),/source-identity/);await assert.rejects(compileSource(Buffer.from(JSON.stringify(changed)),modernPath),/source-/);}
  const old=structuredClone(source);old.mergeByMaterial=true;assert.throws(()=>validateSource(old,sourcePath),/source-identity/);await assert.rejects(compileSource(Buffer.from(JSON.stringify(old)),sourcePath),/source-identity/);
});
test('D77 merging keeps every vertex and triangle, one mesh per colour and finish in first-appearance order, with valid indices',()=>{
  const part=fc.record({shape:fc.constantFrom('box','rounded','cylinder'),size:fc.tuple(...Array.from({length:3},()=>fc.integer({min:4,max:900}))),center:fc.tuple(...Array.from({length:3},()=>fc.integer({min:-900,max:900}))),color:fc.constantFrom('#111111','#222222','#333333'),finish:fc.constantFrom('matte','metal')});
  fc.assert(fc.property(fc.array(part,{minLength:1,maxLength:12}),list=>{
    const parts=list.map((p,i)=>({...p,name:`p${i}`,radius:Math.max(1,Math.floor(Math.min(...p.size)/4)),segments:p.shape==='cylinder'?8:1,axis:'y'}));
    const meshes=modernMeshes({parts}),merged=mergeMeshes(meshes),keys=[...new Set(parts.map(p=>`${p.color}-${p.finish}`))];
    assert.deepEqual(merged.map(m=>`${m.color}-${m.finish}`),keys);assert.deepEqual(merged.map(m=>m.name),keys.map(k=>parts.find(p=>`${p.color}-${p.finish}`===k).name));
    for(const m of merged){
      const own=meshes.filter(x=>x.color===m.color&&x.finish===m.finish);
      assert.deepEqual(m.positions,own.flatMap(x=>[...x.positions]));assert.deepEqual(m.normals,own.flatMap(x=>[...x.normals]));
      assert.equal(m.indices.length,own.reduce((n,x)=>n+x.indices.length,0));assert.ok(m.indices.every(i=>Number.isInteger(i)&&i>=0&&i<m.positions.length/3));
      // Each part's triangles keep their own vertices: index offsets equal the vertices of the parts before it.
      let base=0,at=0;for(const x of own){assert.deepEqual(m.indices.slice(at,at+x.indices.length),[...x.indices].map(i=>i+base));base+=x.positions.length/3;at+=x.indices.length;}
    }
  }),{numRuns:100,seed:771});
});

async function snapshot(directory,prefix=''){
  const result={};for(const name of (await readdir(directory)).sort()){const path=join(directory,name),s=await stat(path);if(s.isDirectory())Object.assign(result,await snapshot(path,prefix+name+'/'));else result[prefix+name]={sha:sha256(await readFile(path)),mtime:s.mtimeMs};}return result;
}
test('AST-001/002 build is byte-reproducible, check is read-only, altered artifacts/source/version fail without erasing prior output',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'gharplan-asset-test-')),input=join(temporary,'sources'),a=join(temporary,'a'),b=join(temporary,'b');
  try{
    await mkdir(input);await writeFile(join(input,name),bytes);await runPipeline({sourceDir:input,outputDir:a});await runPipeline({sourceDir:input,outputDir:b});
    const first=await snapshot(a),second=await snapshot(b);assert.deepEqual(Object.fromEntries(Object.entries(first).map(([k,v])=>[k,v.sha])),Object.fromEntries(Object.entries(second).map(([k,v])=>[k,v.sha])));
    await runPipeline({sourceDir:input,outputDir:a,check:true});assert.deepEqual(await snapshot(a),first);
    const manifest=JSON.parse(await readFile(join(a,'catalog.json'))),blob=join(a,manifest.assets[0].lods[0].path),bad=Buffer.from(await readFile(blob));bad[bad.length-1]^=1;await writeFile(blob,bad);const corrupted=await snapshot(a);await assert.rejects(runPipeline({sourceDir:input,outputDir:a,check:true}),/blob-stale/);assert.deepEqual(await snapshot(a),corrupted);
    await runPipeline({sourceDir:input,outputDir:a});const restored=await snapshot(a),changed=structuredClone(source);changed.license.attribution+=' Changed';await writeFile(join(input,name),JSON.stringify(changed));await assert.rejects(runPipeline({sourceDir:input,outputDir:a}),/immutable/);assert.deepEqual(await snapshot(a),restored);
    changed.license.commercialUse=false;await writeFile(join(input,name),JSON.stringify(changed));await assert.rejects(runPipeline({sourceDir:input,outputDir:a}),/rights-record/);assert.deepEqual(await snapshot(a),restored);
    await writeFile(join(input,name),bytes);manifest.assets[0].version=999;await writeFile(join(a,'catalog.json'),JSON.stringify(manifest));const wrongVersion=await snapshot(a);await assert.rejects(runPipeline({sourceDir:input,outputDir:a,check:true}),/catalog-stale/);await assert.rejects(runPipeline({sourceDir:input,outputDir:a}),/immutable/);assert.deepEqual(await snapshot(a),wrongVersion);
  }finally{await rm(temporary,{recursive:true,force:true});}
});

test('AST-001/002 existing asset versions cannot be overwritten, removed or duplicated; append-only versions remain possible',()=>{
  const old={formatVersion:1,assets:[{id:'a_demo',version:1,dims:{w:1200}}]},next=structuredClone(old);next.assets.push({id:'a_demo',version:2,dims:{w:1400}});assert.doesNotThrow(()=>assertImmutable(old,next));
  const changed=structuredClone(old);changed.assets[0].dims.w=1201;assert.throws(()=>assertImmutable(old,changed),/immutable/);assert.throws(()=>assertImmutable(old,{assets:[]}),/immutable/);const duplicated=structuredClone(old);duplicated.assets.push({...duplicated.assets[0]});assert.throws(()=>assertImmutable(duplicated,next),/duplicate/);
});

test('AST-001/002 preflight and actual I/O failure preserve prior catalog and immutable blobs; repeat and append builds do not rewrite old files',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'gharplan-publication-test-')),input=join(temporary,'sources'),output=join(temporary,'output');
  try{
    await mkdir(input);await writeFile(join(input,name),bytes);const first=await runPipeline({sourceDir:input,outputDir:output}),before=await snapshot(output);await runPipeline({sourceDir:input,outputDir:output});assert.deepEqual(await snapshot(output),before);
    const next=structuredClone(source);next.version=2;next.dims.w=1400;next.parts[0].size[0]=1400;const nextName='a_demo_table-v2.json',nextPath=`tools/asset-pipeline/sources/${nextName}`;next.license.source=nextPath;next.license.url=`https://github.com/raghvendrprajapat/Home-ai/blob/main/${nextPath}`;const nextBytes=Buffer.from(JSON.stringify(next));await writeFile(join(input,nextName),nextBytes);
    const foreign=join(output,'blobs','foreign.txt');await writeFile(foreign,'unknown');const unknown=await snapshot(output);await assert.rejects(runPipeline({sourceDir:input,outputDir:output}),/blob-set/);assert.deepEqual(await snapshot(output),unknown);await rm(foreign);
    const compiled=await compileSource(nextBytes,nextPath),blocked=join(output,compiled.entry.lods[0].path);await mkdir(blocked);await assert.rejects(runPipeline({sourceDir:input,outputDir:output}));for(const [path,old]of Object.entries(before))assert.deepEqual((await snapshot(output))[path],old);assert.deepEqual(JSON.parse(await readFile(join(output,'catalog.json'))),first);await rm(blocked,{recursive:true});
    const second=await runPipeline({sourceDir:input,outputDir:output});assert.equal(second.assets.length,2);assert.deepEqual(second.assets[0],first.assets[0]);const after=await snapshot(output);for(const [path,old]of Object.entries(before))if(path!=='catalog.json')assert.deepEqual(after[path],old);
  }finally{await rm(temporary,{recursive:true,force:true});}
});


test('AST-001/002 Git baseline detects joint committed source/catalog changes under an old version and allows append-only versions',async()=>{
  const repository=await mkdtemp(join(tmpdir(),'gharplan-version-baseline-')),catalogPath='catalog.json',git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  try{
    git(['init','--initial-branch=main']);await writeFile(join(repository,'initial.txt'),'baseline');git(['add','initial.txt']);git(['-c','user.name=GharPlan test','-c','user.email=test@example.invalid','commit','-m','initial']);const empty=git(['rev-parse','HEAD']);
    const first={formatVersion:1,assets:[{id:'a_demo',version:1,dims:{w:1200}}]};await writeFile(join(repository,catalogPath),JSON.stringify(first));assert.equal((await verifyVersions({repository,baseSha:empty,catalogPath})).historicalVersions,0);git(['add',catalogPath]);git(['-c','user.name=GharPlan test','-c','user.email=test@example.invalid','commit','-m','version1']);const baseline=git(['rev-parse','HEAD']);
    const changed=structuredClone(first);changed.assets[0].dims.w=1400;await writeFile(join(repository,catalogPath),JSON.stringify(changed));await writeFile(join(repository,'source.json'),JSON.stringify({version:1,width:1400}));git(['add',catalogPath,'source.json']);git(['-c','user.name=GharPlan test','-c','user.email=test@example.invalid','commit','-m','joint changed version1']);await assert.rejects(verifyVersions({repository,baseSha:baseline,catalogPath}),/immutable/);
    const second=structuredClone(first);second.assets.push({id:'a_demo',version:2,dims:{w:1400}});await writeFile(join(repository,catalogPath),JSON.stringify(second));assert.equal((await verifyVersions({repository,baseSha:baseline,catalogPath})).historicalVersions,1);await assert.rejects(verifyVersions({repository,baseSha:'main; echo unsafe',catalogPath}),/baseline-sha/);await assert.rejects(verifyVersions({repository,baseSha:'f'.repeat(40),catalogPath}));
  }finally{await rm(repository,{recursive:true,force:true});}
});

// D91 catalog wave (Claude-authored builder test). Node counts and triangle totals are hand-counted from the designs:
// box 12, cylinder 4·segments (8→32, 12→48, 16→64, 24→96), rounded box 12·(2·segments+1)² (1→108, 2→300).
// The bed's headboard pad is 40 mm thick with a 20 mm radius, so its two middle depth rows coincide: (25+20+20)·4=260.
test('D91 the twenty new sources are merged schemaVersion 3 originals with hand-counted material nodes and triangles',async()=>{
  const expected={a_l0_diwan:[3,4*48+108+3*300+2*64],a_l0_baithak:[2,3*300+2*64],a_l0_shoe_bench:[2,12*12+300],a_l0_rocking_chair:[2,2*96+8*48+5*108+2*300],a_l0_floor_cushion:[2,300+2*12+64],
    a_l0_media_wall:[5,32*12+2*64],a_l0_crockery_unit:[4,17*12+4*48],a_l0_wall_shelf:[5,14*12+64],a_l0_kids_wardrobe:[4,6*12+4*64],a_l0_pooja_unit:[3,12*12+2*48],
    a_l0_storage_single_bed:[6,5*12+260+2*300+108],a_l0_baby_cot:[3,11*12+18*32+2*300],a_l0_kids_study_desk:[4,108+11*12],a_l0_folding_dining_table:[2,108+6*12+4*48],a_l0_computer_desk:[3,108+8*12],
    a_l0_wall_mirror:[2,2*96],a_l0_wall_clock:[3,2*96+6*12+64],a_l0_tall_plant:[6,2*96+64+6*32+48*48],a_l0_round_rug:[3,3*96],a_l0_runner_rug:[4,7*12]};
  for(const [id,[nodes,triangles]]of Object.entries(expected)){
    const file=`${id}-v1.json`,path=`tools/asset-pipeline/sources/${file}`,raw=await readFile(join(defaults.sourceDir,file)),src=JSON.parse(raw);
    assert.equal(src.schemaVersion,3,id);assert.equal(src.mergeByMaterial,true,id);assert.equal(src.license.type,'project-original-app-use',id);assert.equal(src.license.checkedOn,'2026-10-27',id);
    const compiled=await compileSource(raw,path),scene=(await new NodeIO().readBinary(compiled.files.get(compiled.entry.lods[0].path))).getRoot().getDefaultScene().listChildren();
    assert.equal(scene.length,nodes,id);assert.equal(compiled.entry.inspection.triangles,triangles,id);assert.ok(triangles<=3000,id);
    assert.equal(compiled.entry.inspection.validator.errors,0,id);assert.equal(compiled.entry.inspection.validator.warnings,0,id);
    for(const node of scene){assert.deepEqual(node.getTranslation(),[0,0,0],id);assert.deepEqual(node.getScale(),[1,1,1],id);}
  }
});
