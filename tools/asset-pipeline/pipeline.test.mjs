import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdtemp,mkdir,rm,readdir,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import fc from 'fast-check';
import {NodeIO} from '@gltf-transform/core';
import {boxData,thumbnail} from './geometry.mjs';
import {compileSource,validateSource,inspectGlb,binaryProfile,sha256,createAssetDocument} from './model.mjs';
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
