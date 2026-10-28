/**
 * D92 AI test mode configuration (owner, 2026-10-28): AI works before any backend, but only for people who know the
 * owner's access code. Turned on by the PUBLIC build flag VITE_ROOM_AI_TEST_MODE=1. The web app calls its own
 * address (`/api`); the Android app has no server of its own, so its build also needs VITE_API_BASE_URL = the web
 * app's https address. The secrets (OPENAI_API_KEY, FAL_KEY, AI_ACCESS_CODE) live only in Vercel's server-side
 * environment; build variables that look like them are refused by vite.config.ts (`publicEnvProblems`).
 * Pure functions only at module level: vite.config.ts imports this file in Node.
 */
export interface TestModeConfig {
 /** Absolute address of the API folder, without a trailing slash, for example https://example.vercel.app/api. */
 readonly base:string;
}
export function testModeConfig(env:Readonly<Record<string,unknown>>,native:boolean,origin:string):TestModeConfig|null{
 if(env.VITE_ROOM_AI_TEST_MODE!=='1')return null;
 if(!native){
  try{const url=new URL(origin);return url.protocol==='https:'||url.protocol==='http:'?{base:`${url.origin}/api`}:null;}catch{return null;}
 }
 const raw=env.VITE_API_BASE_URL;if(typeof raw!=='string'||!raw)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)return null;
  const path=url.pathname.replace(/\/+$/,'');
  return {base:`${url.origin}${path.endsWith('/api')?path:`${path}/api`}`};
 }catch{return null;}
}

/** Names and values that must never be built into the app (the bundle is public). */
export function publicEnvProblems(env:Readonly<Record<string,string|undefined>>):string[]{
 const problems:string[]=[];
 for(const [name,value] of Object.entries(env)){
  if(!name.startsWith('VITE_'))continue;
  const upper=name.toUpperCase(),v=(value??'').trim();
  if(/OPENAI|ACCESS_CODE|(^|_)FAL(_|$)|FAL_KEY/.test(upper))problems.push(`${name}: this name is for a server secret; set it in Vercel without the VITE_ prefix.`);
  else if(/^sk-[A-Za-z0-9_-]{8,}/.test(v))problems.push(`${name}: the value looks like an OpenAI secret key.`);
  else if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{16,}$/i.test(v))problems.push(`${name}: the value looks like a fal.ai key.`);
 }
 return problems;
}

/** The access code is kept on this device only (so testers type it once); "Forget code" removes it. */
const CODE_KEY='gharplan.roomAi.testCode';
export const MAX_CODE_LENGTH=200;
export function loadCode():string|null{try{const v=globalThis.localStorage?.getItem(CODE_KEY)??null;return v&&v.length<=MAX_CODE_LENGTH?v:null;}catch{return null;}}
export function saveCode(code:string):void{try{globalThis.localStorage?.setItem(CODE_KEY,code);}catch{/* asked again next time */}}
export function forgetCode():void{try{globalThis.localStorage?.removeItem(CODE_KEY);}catch{/* nothing kept */}}
/** Test-mode consent, versioned and separate from the D86 account consent (the providers and storage differ). */
export const TEST_CONSENT_VERSION=1;
const CONSENT_KEY=`gharplan.roomAi.testConsent.v${TEST_CONSENT_VERSION}`;
export function hasTestConsent():boolean{try{return !!globalThis.localStorage?.getItem(CONSENT_KEY);}catch{return false;}}
export function giveTestConsent(at=new Date()):void{try{globalThis.localStorage?.setItem(CONSENT_KEY,at.toISOString());}catch{/* asked again next time */}}
