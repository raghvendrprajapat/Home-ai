import {expect} from '@playwright/test';
import type {Page,Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {openTool} from './helpers/tools';
// Shared stand-in for Supabase Auth + the D65 functions used by the cloud browser tests (FR-031/032). Not shipped.
export const CLOUD='https://gharplan-e2e.supabase.co',USER={id:'00000000-0000-4000-8000-0000000000e2',aud:'authenticated',role:'authenticated',email:'owner@example.test',user_metadata:{full_name:'Raghvendr Test'},app_metadata:{provider:'google'},created_at:'2026-10-18T00:00:00Z'};
export const session=(lastSignInAt=new Date().toISOString())=>({access_token:'e2e-access',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'e2e-refresh',user:{...USER,last_sign_in_at:lastSignInAt}});
export type Doc={id:string;name:string;revision:number;floors:unknown[]};
export type SaveArgs={p_project_id:string;p_expected_revision:number;p_command_id:string;p_document:Doc};
/** The D65 save rules in memory: receipts before the head, compare-and-set, head + 1. */
export class FakeCloud {
 heads=new Map<string,{revision:number;document:Doc;name:string}>();receipts=new Map<string,{digest:string;revision:number}>();saves:SaveArgs[]=[];failNext=0;versions=new Map<string,Map<number,Doc>>();
 #commit(id:string,revision:number,document:Doc){const next={...document,revision};this.heads.set(id,{revision,document:next,name:next.name});const kept=this.versions.get(id)??new Map<number,Doc>();kept.set(revision,next);this.versions.set(id,kept);}
 /** Another device saved on top of the head (used to create conflicts). */
 otherDevice(id:string,times:number){for(let i=0;i<times;i++){const head=this.heads.get(id)!;this.#commit(id,head.revision+1,head.document);}}
 save(a:SaveArgs){
  this.saves.push(a);const key=`${a.p_project_id}/${a.p_command_id}`,digest=JSON.stringify([a.p_expected_revision,a.p_document]),receipt=this.receipts.get(key);
  if(receipt)return receipt.digest===digest?{ok:true,serverRevision:receipt.revision,sha256:'x',savedAt:'t',replayed:true}:{ok:false,code:'IDEMPOTENCY_MISMATCH'};
  const head=this.heads.get(a.p_project_id);
  if(!head&&a.p_expected_revision!==0)return {ok:false,code:'NOT_FOUND'};
  if((head?.revision??0)!==a.p_expected_revision)return {ok:false,code:'REVISION_CONFLICT',details:{currentServerRevision:head!.revision}};
  const revision=a.p_expected_revision+1;this.#commit(a.p_project_id,revision,a.p_document);this.receipts.set(key,{digest,revision});
  return {ok:true,serverRevision:revision,sha256:'x',savedAt:new Date().toISOString()};
 }
 shares=new Map<string,{id:string;projectId:string;revoked:boolean;createdAt:string}>();
 createShare(projectId:string){if(!this.heads.has(projectId))return {ok:false,code:'NOT_FOUND'};const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID();this.shares.set(token,{id,projectId,revoked:false,createdAt:new Date().toISOString()});return {ok:true,shareId:id,token};}
 revokeShare(id:string){const share=[...this.shares.values()].find(s=>s.id===id&&!s.revoked);if(!share)return {ok:false,code:'NOT_FOUND'};share.revoked=true;return {ok:true};}
 getShared(token:string){const share=this.shares.get(token),head=share&&!share.revoked?this.heads.get(share.projectId):undefined;return head?{ok:true,serverRevision:head.revision,name:head.name,document:head.document}:{ok:false,code:'NOT_FOUND'};}
 deleted=false;reauthRequired=false;
 deleteAccount(confirm:string){if(confirm!=='DELETE')return {ok:false,code:'CONFIRMATION_REQUIRED'};if(this.reauthRequired)return {ok:false,code:'REAUTH_REQUIRED'};this.heads.clear();this.versions.clear();this.shares.clear();this.deleted=true;return {ok:true};}
 restores:{p_project_id:string;p_from_revision:number;p_expected_revision:number;p_command_id:string}[]=[];
 restore(a:{p_project_id:string;p_from_revision:number;p_expected_revision:number;p_command_id:string}){
  this.restores.push(a);const key=`${a.p_project_id}/${a.p_command_id}`,digest=JSON.stringify(['restore',a.p_from_revision,a.p_expected_revision]),receipt=this.receipts.get(key);
  if(receipt)return receipt.digest===digest?{ok:true,serverRevision:receipt.revision,sha256:'x',savedAt:'t',replayed:true}:{ok:false,code:'IDEMPOTENCY_MISMATCH'};
  const head=this.heads.get(a.p_project_id);if(!head)return {ok:false,code:'NOT_FOUND'};
  if(head.revision!==a.p_expected_revision)return {ok:false,code:'REVISION_CONFLICT',details:{currentServerRevision:head.revision}};
  const old=this.versions.get(a.p_project_id)?.get(a.p_from_revision);if(!old)return {ok:false,code:'VERSION_NOT_FOUND'};
  const revision=head.revision+1;this.#commit(a.p_project_id,revision,old);this.receipts.set(key,{digest,revision});
  return {ok:true,serverRevision:revision,sha256:'x',savedAt:new Date().toISOString()};
 }
}
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-expose-headers':'*'};
export async function install(page:Page,cloud:FakeCloud){
 await page.route(`${CLOUD}/**`,async(route:Route)=>{
  const request=route.request(),url=new URL(request.url()),json=(body:unknown,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(body)});
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(url.pathname==='/auth/v1/authorize'){expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('code_challenge')).toBeTruthy();return route.fulfill({status:302,headers:{location:`${url.searchParams.get('redirect_to')}?code=e2e-code`}});}
  if(url.pathname==='/auth/v1/token'){expect(url.searchParams.get('grant_type')).toBe('pkce');expect(request.postDataJSON()).toMatchObject({auth_code:'e2e-code'});return json(session());}
  if(url.pathname==='/auth/v1/user')return json({...USER,last_sign_in_at:new Date().toISOString()});
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers:cors});
  if(url.pathname==='/rest/v1/rpc/save_snapshot'){const args=request.postDataJSON() as SaveArgs;if(cloud.failNext>0){cloud.failNext--;cloud.saves.push(args);return route.abort('internetdisconnected');}return json(cloud.save(args));}
  if(url.pathname==='/rest/v1/rpc/load_project'){const id=(request.postDataJSON() as {p_project_id:string}).p_project_id,head=cloud.heads.get(id);return json(head?{ok:true,serverRevision:head.revision,name:head.name,document:head.document}:{ok:false,code:'NOT_FOUND'});}
  if(url.pathname==='/rest/v1/rpc/delete_account')return json(cloud.deleteAccount((request.postDataJSON() as {p_confirm:string}).p_confirm));
  if(url.pathname==='/rest/v1/rpc/create_share')return json(cloud.createShare((request.postDataJSON() as {p_project_id:string}).p_project_id));
  if(url.pathname==='/rest/v1/rpc/revoke_share')return json(cloud.revokeShare((request.postDataJSON() as {p_share_id:string}).p_share_id));
  if(url.pathname==='/rest/v1/rpc/get_shared_project')return json(cloud.getShared((request.postDataJSON() as {p_token:string}).p_token));
  if(url.pathname==='/rest/v1/project_shares'){const id=url.searchParams.get('project_id')!.replace(/^eq\./,'');return json([...cloud.shares.values()].filter(s=>s.projectId===id&&!s.revoked).map(s=>({id:s.id,created_at:s.createdAt})));}
  if(url.pathname==='/rest/v1/rpc/restore_version')return json(cloud.restore(request.postDataJSON()));
  if(url.pathname==='/rest/v1/project_versions'){
   const id=url.searchParams.get('project_id')!.replace(/^eq\./,''),kept=[...(cloud.versions.get(id)??new Map<number,Doc>())].sort((a,b)=>b[0]-a[0]).slice(0,20);
   const revision=url.searchParams.get('revision');
   if(revision)return json(kept.filter(([r])=>`eq.${r}`===revision).map(([,snapshot])=>({snapshot})));
   return json(kept.map(([r])=>({revision:r,created_at:`2026-10-18T10:0${r%10}:00Z`})));
  }
  if(url.pathname==='/rest/v1/projects')return json([...cloud.heads].map(([id,h])=>({id,name:h.name,current_revision:h.revision,updated_at:'2026-10-18T10:00:00Z'})));
  return json({message:'not in the stand-in'},404);
 });
}
export const status=(page:Page)=>page.getByTestId('cloud-status');
export async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
export async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8')) as Doc;}
export async function signedInWithNewCloudProject(page:Page,cloud:FakeCloud){
 await install(page,cloud);await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await expect(status(page)).toHaveAttribute('data-phase','signed-out');
 await openTool(page,'Project');await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
 await openTool(page,'Project');await expect(page.getByText('Signed in as Raghvendr Test',{exact:true})).toBeVisible();
 await expect(page).not.toHaveURL(/code=/); // the one-time code is removed from the address bar
 await page.getByRole('button',{name:'Save this drawing to the cloud',exact:true}).click();
 // The bundled sample claims revision 1 under a fixed id this account never saved: offered as a new cloud project.
 await expect(status(page)).toHaveAttribute('data-phase','not-in-cloud');
 await page.getByRole('button',{name:'Save as a new cloud project',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','saved');await expect(status(page)).toHaveText('Saved in cloud (version 1)');
 return (await backup(page)).id;
}
