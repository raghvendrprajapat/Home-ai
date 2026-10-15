import {Buffer} from 'node:buffer';
import {randomUUID} from 'node:crypto';
import {readdir,readFile,writeFile,mkdir,rename,rm} from 'node:fs/promises';
import {resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileSource} from './model.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
export const defaults={sourceDir:resolve(root,'tools/asset-pipeline/sources'),outputDir:resolve(root,'apps/web/public/catalog')};
const key=entry=>`${entry.id}@${entry.version}`;
const json=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');

export async function compileDirectory(sourceDir) {
  const names=(await readdir(sourceDir)).sort();if(!names.length||names.some(n=>!/^a_[a-z0-9_]+-v[1-9][0-9]*\.json$/.test(n)))throw Error('source-filenames');
  const assets=[],files=new Map(),seen=new Set();
  for(const name of names){
    const path=`tools/asset-pipeline/sources/${name}`,result=await compileSource(await readFile(resolve(sourceDir,name)),path),entry=result.entry;
    if(name!==`${entry.id}-v${entry.version}.json`||seen.has(key(entry)))throw Error('source-version');seen.add(key(entry));assets.push(entry);
    for(const [path,bytes]of result.files){if(files.has(path)&&!files.get(path).equals(bytes))throw Error('asset-hash-collision');files.set(path,bytes);}
  }
  assets.sort((a,b)=>a.id.localeCompare(b.id,'en')||a.version-b.version);
  return {catalog:{formatVersion:1,assets},files};
}

export function assertImmutable(existing,next) {
  if(!existing||existing.formatVersion!==1||!Array.isArray(existing.assets))throw Error('catalog-format');
  const seen=new Set();
  for(const old of existing.assets){
    if(seen.has(key(old)))throw Error('catalog-duplicate-version');seen.add(key(old));
    const current=next.assets.find(e=>key(e)===key(old));
    if(!current||!json(current).equals(json(old)))throw Error('catalog-version-is-immutable');
  }
}

async function namesOrEmpty(path) {try{return await readdir(path);}catch(error){if(error.code==='ENOENT')return [];throw error;}}
async function preflight(outputDir,result) {
  if((await namesOrEmpty(outputDir)).some(n=>!['catalog.json','blobs'].includes(n)))throw Error('catalog-output-files');
  if((await namesOrEmpty(resolve(outputDir,'blobs'))).some(n=>!result.files.has(`blobs/${n}`)))throw Error('catalog-blob-set');
}
async function checkBlobs(outputDir,result) {
  const actual=(await readdir(resolve(outputDir,'blobs'))).map(n=>`blobs/${n}`).sort();
  if(JSON.stringify(actual)!==JSON.stringify([...result.files.keys()].sort()))throw Error('catalog-blob-set');
  for(const [path,bytes]of result.files)if(!(await readFile(resolve(outputDir,path))).equals(bytes))throw Error('catalog-blob-stale');
}
export async function checkOutput(outputDir,result) {
  await preflight(outputDir,result);
  if(!(await readFile(resolve(outputDir,'catalog.json'))).equals(json(result.catalog)))throw Error('catalog-stale');
  await checkBlobs(outputDir,result);
}
async function atomicFile(path,bytes) {
  try{if((await readFile(path)).equals(bytes))return;}catch(error){if(error.code!=='ENOENT')throw error;}
  const temporary=resolve(dirname(path),`.${basename(path)}-${randomUUID()}.tmp`);
  try{await writeFile(temporary,bytes,{flag:'wx'});await rename(temporary,path);}catch(error){await rm(temporary,{force:true}).catch(()=>{});throw error;}
}

export async function runPipeline({sourceDir=defaults.sourceDir,outputDir=defaults.outputDir,check=false}={}) {
  // Complete generation/validation before touching any published artifact.
  const result=await compileDirectory(sourceDir);
  if(check){await checkOutput(outputDir,result);return result.catalog;}
  let existing;
  try{existing=JSON.parse(await readFile(resolve(outputDir,'catalog.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing)assertImmutable(existing,result.catalog);
  await preflight(outputDir,result);
  await mkdir(resolve(outputDir,'blobs'),{recursive:true});
  for(const [path,bytes]of result.files)await atomicFile(resolve(outputDir,path),bytes);
  // Every check that can fail precedes the single manifest publication.
  await checkBlobs(outputDir,result);
  await atomicFile(resolve(outputDir,'catalog.json'),json(result.catalog));return result.catalog;
}
