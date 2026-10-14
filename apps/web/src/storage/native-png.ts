import {registerPlugin} from '@capacitor/core';
import type {NativeExportReceipt} from './native-export';
import {inspectPng,MAX_PNG_BYTES} from '../editor/png';
export interface NativePngIo {write(path:string,bytes:Uint8Array):Promise<void>;read(path:string):Promise<Uint8Array>;remove(path:string):Promise<void>;save(input:{path:string;bytes:number;sha256:string;format:'png'}):Promise<NativeExportReceipt>}
const ProjectFiles=registerPlugin<{save(input:{path:string;bytes:number;sha256:string;format:'png'}):Promise<NativeExportReceipt>}>('ProjectFiles');
export function encodeBase64(bytes:Uint8Array):string {if(bytes.length>MAX_PNG_BYTES)throw new Error('png-budget');let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));return btoa(text);}
export function decodeBase64(text:string):Uint8Array<ArrayBuffer> {if(text.length>Math.ceil(MAX_PNG_BYTES/3)*4||text.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('invalid-png');const decoded=atob(text);if(decoded.length>MAX_PNG_BYTES)throw new Error('png-budget');return Uint8Array.from(decoded,c=>c.charCodeAt(0));}
const nativeIo:NativePngIo={
 write:async(path,bytes)=>{const {Directory,Filesystem}=await import('@capacitor/filesystem');try{if((await Filesystem.readdir({path:'exports',directory:Directory.Cache})).files.length>=32)throw new Error('Export cache full');}catch(e){if(!e||typeof e!=='object'||!('code'in e)||e.code!=='OS-PLUG-FILE-0008')throw e;}await Filesystem.writeFile({path,directory:Directory.Cache,data:encodeBase64(bytes),recursive:true});},
 read:async path=>{const {Directory,Filesystem}=await import('@capacitor/filesystem'),result=await Filesystem.readFile({path,directory:Directory.Cache});if(typeof result.data!=='string')throw new Error('Image cache read failed');return decodeBase64(result.data);},
 remove:async path=>{const {Directory,Filesystem}=await import('@capacitor/filesystem');await Filesystem.deleteFile({path,directory:Directory.Cache});},save:input=>ProjectFiles.save(input),
};
async function hash(bytes:Uint8Array):Promise<string>{const digest=await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function exportNativePng(blob:Blob,io:NativePngIo=nativeIo):Promise<NativeExportReceipt>{
 if(blob.type!=='image/png'||blob.size<1||blob.size>MAX_PNG_BYTES)throw new Error('invalid-png');const bytes=new Uint8Array(await blob.arrayBuffer());inspectPng(bytes);const checksum=await hash(bytes),path=`exports/gharplan-${crypto.randomUUID().replaceAll('-','')}.png`;
 try{await io.write(path,bytes);const read=await io.read(path);if(read.length!==bytes.length||await hash(read)!==checksum)throw new Error('Image cache differs');const receipt=await io.save({path,bytes:bytes.length,sha256:checksum,format:'png'});if(receipt.verified!==true||receipt.bytes!==bytes.length||receipt.sha256!==checksum)throw new Error('Image destination unverified');return receipt;}finally{void Promise.resolve().then(()=>io.remove(path)).catch(()=>{});}
}
