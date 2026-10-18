import {Buffer} from 'node:buffer';
import {TextDecoder} from 'node:util';
import {createHash} from 'node:crypto';
import {Document,NodeIO,getBounds} from '@gltf-transform/core';
import validator from 'gltf-validator';
import {boxData,thumbnail,roundedBoxData,cylinderData,meshThumbnail} from './geometry.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => {throw new Error(code);};
const exactKeys=(value,keys)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...keys].sort().join(',');
const text=value=>typeof value==='string'&&value.length>0&&value.length<=500;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const vec=(value,min,max)=>Array.isArray(value)&&value.length===3&&value.every(v=>integer(v,min,max));
const SOURCE_KEYS=['schemaVersion','id','version','name_en','name_hi','category','tags','dims','license','parts'];
const LICENSE_KEYS=['source','url','type','attribution','commercialUse','redistributionInApp','standaloneRedistribution','checkedOn'];
/** A deliberately narrow original static-box authoring profile, in integer mm. */
export function validateSource(source,path) {
  if(!exactKeys(source,SOURCE_KEYS)||source.schemaVersion!==1||!/^a_[a-z0-9_]{1,36}$/.test(source.id)||!integer(source.version,1,1000000))fail('source-identity');
  if(!['name_en','name_hi','category'].every(k=>text(source[k]))||!Array.isArray(source.tags)||source.tags.length>30||!source.tags.every(text))fail('source-labels');
  if(!exactKeys(source.dims,['w','d','h'])||!Object.values(source.dims).every(v=>integer(v,1,20000)))fail('source-dimensions');
  const l=source.license;
  if(!exactKeys(l,LICENSE_KEYS)||l.type!=='project-original-app-use'||l.source!==path||l.url!==`https://github.com/raghvendrprajapat/Home-ai/blob/main/${path}`||!text(l.attribution)||l.commercialUse!==true||l.redistributionInApp!==true||l.standaloneRedistribution!==false||!validDate(l.checkedOn))fail('source-rights-record');
  if(!Array.isArray(source.parts)||!source.parts.length||source.parts.length>64)fail('source-parts');
  const names=new Set();
  for(const p of source.parts){
    if(!exactKeys(p,['name','center','size','color'])||!text(p.name)||names.has(p.name)||!vec(p.center,-20000,20000)||!vec(p.size,1,20000)||!/^#[0-9a-f]{6}$/.test(p.color))fail('source-part');names.add(p.name);
  }
  return source;
}

const linearColor=hex=>hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
export function createAssetDocument(source) {
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('catalog-model'),data=boxData();doc.getRoot().setDefaultScene(scene);
  const accessor=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
  const positions=accessor('box-position','VEC3',data.positions),normals=accessor('box-normal','VEC3',data.normals),indices=accessor('box-index','SCALAR',data.indices);
  const meshes=new Map();
  for(const p of source.parts){
    let mesh=meshes.get(p.color);
    if(!mesh){
      const material=doc.createMaterial(p.color).setBaseColorFactor([...linearColor(p.color),1]).setMetallicFactor(0).setRoughnessFactor(.8);
      mesh=doc.createMesh(p.color).addPrimitive(doc.createPrimitive().setAttribute('POSITION',positions).setAttribute('NORMAL',normals).setIndices(indices).setMaterial(material));meshes.set(p.color,mesh);
    }
    scene.addChild(doc.createNode(p.name).setMesh(mesh).setTranslation(p.center.map(n=>n/1000)).setScale(p.size.map(n=>n/1000)));
  }
  return doc;
}

/** Profile check precedes NodeIO, so binary admission never resolves external files. */
export function binaryProfile(bytes) {
  if(bytes.length<28||bytes.length>2*1024*1024)fail('asset-byte-budget');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==bytes.length||v.getUint32(16,true)!==0x4e4f534a)fail('asset-glb-header');
  const length=v.getUint32(12,true);if(length%4||20+length>bytes.length)fail('asset-glb-json');
  const json=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(20,20+length)));
  if((json.extensionsUsed?.length??0)||(json.extensionsRequired?.length??0)||(json.animations?.length??0)||(json.skins?.length??0)||(json.cameras?.length??0)||(json.images?.length??0)||(json.textures?.length??0)||json.buffers?.some(b=>b.uri)||json.meshes?.some(m=>m.primitives.some(p=>p.targets?.length||p.mode!==undefined&&p.mode!==4)))fail('asset-unsupported-profile');
  return json;
}

export async function inspectGlb(bytes,dims,maximumTriangles) {
  binaryProfile(bytes);
  const report=await validator.validateBytes(new Uint8Array(bytes),{uri:'asset.glb',maxIssues:1000,severityOverrides:{ACCESSOR_INDEX_TRIANGLE_DEGENERATE:0},externalResourceFunction:async()=>fail('asset-external-resource')});
  if(report.issues.numErrors||report.issues.truncated)fail('asset-validator-errors');
  const doc=await new NodeIO().readBinary(new Uint8Array(bytes)),root=doc.getRoot(),scene=root.getDefaultScene();
  if(root.listScenes().length!==1||!scene)fail('asset-scene');
  let triangles=0;const nodes=[...scene.listChildren()];
  while(nodes.length){const node=nodes.pop();nodes.push(...node.listChildren());const mesh=node.getMesh();if(!mesh)continue;
    if(node.getWorldScale().some(n=>!Number.isFinite(n)||n<=0))fail('asset-transform');
    for(const p of mesh.listPrimitives()){
      const positions=p.getAttribute('POSITION'),normals=p.getAttribute('NORMAL'),indices=p.getIndices();
      if(p.getMode()!==4||!positions||!normals||normals.getCount()!==positions.getCount())fail('asset-primitive');
      const count=indices?.getCount()??positions.getCount();if(count%3)fail('asset-primitive');triangles+=count/3;
    }
  }
  if(!integer(maximumTriangles,1,20000)||!triangles||triangles>maximumTriangles)fail('asset-triangle-budget');
  const bounds=getBounds(scene),min=bounds.min,max=bounds.max,tolerance=.00001;
  if(![...min,...max].every(Number.isFinite)||Math.abs(min[1])>tolerance||Math.abs(min[0]+max[0])>tolerance||Math.abs(min[2]+max[2])>tolerance||[dims.w,dims.h,dims.d].some((mm,i)=>Math.abs(max[i]-min[i]-mm/1000)>tolerance))fail('asset-bounds');
  return {triangles,bounds:{min,max},validator:{version:validator.version(),errors:report.issues.numErrors,warnings:report.issues.numWarnings,infos:report.issues.numInfos,messages:report.issues.messages}};
}

/* D72 modern original profile (schemaVersion 3): still original, integer-mm and untextured, but parts may be rounded
 * boxes or cylinders with a surface finish. Each part is baked into its own flat node, so the FR-022 main-material
 * rule keeps measuring real part volumes. Schema 1 sources and their published bytes are unchanged. */
// [metallic, roughness]. The 3D view has no reflection map, so `metal` stays partly metallic to avoid rendering black.
export const FINISHES={matte:[0,.85],satin:[0,.5],gloss:[0,.25],metal:[.35,.4]};
const PART_KEYS={box:['name','shape','center','size','color','finish'],rounded:['name','shape','center','size','color','finish','radius','segments'],cylinder:['name','shape','center','size','color','finish','axis','segments']};
export function validateModernSource(source,path) {
  validateSource({...source,schemaVersion:1,parts:source?.parts?.map?.(p=>({name:p?.name,center:p?.center,size:p?.size,color:p?.color}))},path);
  if(!exactKeys(source,SOURCE_KEYS)||source.schemaVersion!==3)fail('source-identity');
  for(const p of source.parts){
    if(!exactKeys(p,PART_KEYS[p?.shape]??[])||!Object.hasOwn(FINISHES,p.finish))fail('source-part');
    if(p.shape==='rounded'&&(!integer(p.radius,1,Math.floor(Math.min(...p.size)/2))||!integer(p.segments,1,3)))fail('source-part');
    if(p.shape==='cylinder'&&(!['x','y','z'].includes(p.axis)||![8,12,16,24].includes(p.segments)))fail('source-part');
  }
  return source;
}
export function modernMeshes(source) {
  return source.parts.map(p=>{
    const data=p.shape==='rounded'?roundedBoxData(p.size,p.radius,p.segments):p.shape==='cylinder'?cylinderData(p.size,p.axis,p.segments):(()=>{const b=boxData();return {positions:[...b.positions].map((n,i)=>n*p.size[i%3]),normals:[...b.normals],indices:[...b.indices]};})();
    return {name:p.name,color:p.color,finish:p.finish,positions:data.positions.map((n,i)=>n+p.center[i%3]),normals:data.normals,indices:data.indices};
  });
}
export function createModernDocument(meshes) {
  const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('catalog-model'),materials=new Map();doc.getRoot().setDefaultScene(scene);
  const accessor=(name,type,array)=>doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);
  for(const m of meshes){
    const key=`${m.color}-${m.finish}`;let material=materials.get(key);
    if(!material){const [metallic,roughness]=FINISHES[m.finish];material=doc.createMaterial(key).setBaseColorFactor([...linearColor(m.color),1]).setMetallicFactor(metallic).setRoughnessFactor(roughness);materials.set(key,material);}
    const primitive=doc.createPrimitive().setAttribute('POSITION',accessor(`${m.name}-position`,'VEC3',new Float32Array(m.positions.map(n=>n/1000)))).setAttribute('NORMAL',accessor(`${m.name}-normal`,'VEC3',new Float32Array(m.normals))).setIndices(accessor(`${m.name}-index`,'SCALAR',new Uint16Array(m.indices))).setMaterial(material);
    scene.addChild(doc.createNode(m.name).setMesh(doc.createMesh(m.name).addPrimitive(primitive)));
  }
  return doc;
}

export async function compileSource(bytes,path) {
  const raw=JSON.parse(Buffer.from(bytes).toString('utf8'));let source,glb,thumb;
  if(raw?.schemaVersion===3){source=validateModernSource(raw,path);const meshes=modernMeshes(source);glb=Buffer.from(await new NodeIO().writeBinary(createModernDocument(meshes)));thumb=meshThumbnail(meshes);}
  else{source=validateSource(raw,path);glb=Buffer.from(await new NodeIO().writeBinary(createAssetDocument(source)));thumb=thumbnail(source.parts);}
  const inspection=await inspectGlb(glb,source.dims,3000),modelHash=sha256(glb),thumbHash=sha256(thumb);
  const file=(hash,extension)=>`blobs/${hash}.${extension}`;
  const entry={id:source.id,version:source.version,name_en:source.name_en,name_hi:source.name_hi,category:source.category,tags:source.tags,dims:source.dims,sourceSha256:sha256(bytes),license:source.license,lods:[0,1].map(level=>({level,path:file(modelHash,'glb'),sha256:modelHash,bytes:glb.length,triangles:inspection.triangles})),thumb:{path:file(thumbHash,'svg'),sha256:thumbHash,bytes:thumb.length,width:256,height:256},inspection};
  return {entry,files:new Map([[file(modelHash,'glb'),glb],[file(thumbHash,'svg'),thumb]])};
}
