import {test,expect} from '@playwright/test';
import type {Page,Route} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// FR-031 (D67) cloud sign-in and saving against an in-test stand-in for Supabase (Auth + the D65 functions).
// Claude-authored; a real Supabase project and Google sign-in are still owner/release checks.
const CLOUD='https://gharplan-e2e.supabase.co',USER={id:'00000000-0000-4000-8000-0000000000e2',aud:'authenticated',role:'authenticated',email:'owner@example.test',user_metadata:{full_name:'Raghvendr Test'},app_metadata:{provider:'google'},created_at:'2026-10-18T00:00:00Z'};
const session=()=>({access_token:'e2e-access',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'e2e-refresh',user:USER});
type Doc={id:string;name:string;revision:number;floors:unknown[]};
type SaveArgs={p_project_id:string;p_expected_revision:number;p_command_id:string;p_document:Doc};
/** The D65 save rules in memory: receipts before the head, compare-and-set, head + 1. */
class FakeCloud {
 heads=new Map<string,{revision:number;document:Doc;name:string}>();receipts=new Map<string,{digest:string;revision:number}>();saves:SaveArgs[]=[];failNext=0;
 save(a:SaveArgs){
  this.saves.push(a);const key=`${a.p_project_id}/${a.p_command_id}`,digest=JSON.stringify([a.p_expected_revision,a.p_document]),receipt=this.receipts.get(key);
  if(receipt)return receipt.digest===digest?{ok:true,serverRevision:receipt.revision,sha256:'x',savedAt:'t',replayed:true}:{ok:false,code:'IDEMPOTENCY_MISMATCH'};
  const head=this.heads.get(a.p_project_id);
  if(!head&&a.p_expected_revision!==0)return {ok:false,code:'NOT_FOUND'};
  if((head?.revision??0)!==a.p_expected_revision)return {ok:false,code:'REVISION_CONFLICT',details:{currentServerRevision:head!.revision}};
  const revision=a.p_expected_revision+1;this.heads.set(a.p_project_id,{revision,document:{...a.p_document,revision},name:a.p_document.name});this.receipts.set(key,{digest,revision});
  return {ok:true,serverRevision:revision,sha256:'x',savedAt:new Date().toISOString()};
 }
}
const cors={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-expose-headers':'*'};
async function install(page:Page,cloud:FakeCloud){
 await page.route(`${CLOUD}/**`,async(route:Route)=>{
  const request=route.request(),url=new URL(request.url()),json=(body:unknown,status=200)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(body)});
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
  if(url.pathname==='/auth/v1/authorize'){expect(url.searchParams.get('provider')).toBe('google');expect(url.searchParams.get('code_challenge')).toBeTruthy();return route.fulfill({status:302,headers:{location:`${url.searchParams.get('redirect_to')}?code=e2e-code`}});}
  if(url.pathname==='/auth/v1/token'){expect(url.searchParams.get('grant_type')).toBe('pkce');expect(request.postDataJSON()).toMatchObject({auth_code:'e2e-code'});return json(session());}
  if(url.pathname==='/auth/v1/user')return json(USER);
  if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,headers:cors});
  if(url.pathname==='/rest/v1/rpc/save_snapshot'){const args=request.postDataJSON() as SaveArgs;if(cloud.failNext>0){cloud.failNext--;cloud.saves.push(args);return route.abort('internetdisconnected');}return json(cloud.save(args));}
  if(url.pathname==='/rest/v1/rpc/load_project'){const id=(request.postDataJSON() as {p_project_id:string}).p_project_id,head=cloud.heads.get(id);return json(head?{ok:true,serverRevision:head.revision,name:head.name,document:head.document}:{ok:false,code:'NOT_FOUND'});}
  if(url.pathname==='/rest/v1/projects')return json([...cloud.heads].map(([id,h])=>({id,name:h.name,current_revision:h.revision,updated_at:'2026-10-18T10:00:00Z'})));
  return json({message:'not in the stand-in'},404);
 });
}
const status=(page:Page)=>page.getByTestId('cloud-status');
async function saved(page:Page){await expect(page.getByTestId('save-status')).toHaveAttribute('data-phase','saved');}
async function backup(page:Page){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Export drawing',exact:true}).click();return JSON.parse(await readFile((await(await d).path())!,'utf8')) as Doc;}
async function signedInWithNewCloudProject(page:Page,cloud:FakeCloud){
 await install(page,cloud);await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await expect(status(page)).toHaveAttribute('data-phase','signed-out');
 await page.getByRole('button',{name:'Sign in with Google',exact:true}).click();
 await expect(page.getByText('Signed in as Raghvendr Test',{exact:true})).toBeVisible();
 await expect(page).not.toHaveURL(/code=/); // the one-time code is removed from the address bar
 await page.getByRole('button',{name:'Save this drawing to the cloud',exact:true}).click();
 // The bundled sample claims revision 1 under a fixed id this account never saved: offered as a new cloud project.
 await expect(status(page)).toHaveAttribute('data-phase','not-in-cloud');
 await page.getByRole('button',{name:'Save as a new cloud project',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','saved');await expect(status(page)).toHaveText('Saved in cloud (version 1)');
 return (await backup(page)).id;
}

test('FR-031 Google sign-in (PKCE) and saving: a new cloud project gets version 1, an edit becomes version 2',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 expect(id).not.toBe('prj_sample_2room');
 expect(cloud.saves.at(-1)).toMatchObject({p_project_id:id,p_expected_revision:0});
 expect(cloud.heads.get(id)!.document.revision).toBe(1);
 expect((await backup(page)).revision).toBe(1); // only document.revision moved
 await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveText('Saved in cloud (version 2)');
 expect(cloud.saves.at(-1)).toMatchObject({p_project_id:id,p_expected_revision:1});
 expect(cloud.heads.get(id)!.document.floors).toHaveLength(2);
});

test('FR-031 no connection: the work stays on the device and the retry resends the same request',async({page})=>{
 const cloud=new FakeCloud();await signedInWithNewCloudProject(page,cloud);
 cloud.failNext=1;
 await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','offline');
 await expect(status(page)).toHaveText('Saved in cloud (version 2)',{timeout:10000});
 const [failed,retried]=cloud.saves.slice(-2);
 expect(retried).toEqual(failed); // same key, same base, same content
});

test('FR-031 a newer cloud version from another device pauses cloud saving and keeps local work',async({page})=>{
 const cloud=new FakeCloud(),id=await signedInWithNewCloudProject(page,cloud);
 const head=cloud.heads.get(id)!;cloud.heads.set(id,{...head,revision:3,document:{...head.document,revision:3}}); // another phone saved twice
 await page.getByRole('group',{name:'Floors',exact:true}).getByRole('button',{name:'+ Add floor',exact:true}).click();
 await expect(status(page)).toHaveAttribute('data-phase','conflict');
 await expect(status(page)).toContainText('newer version (3)');
 const local=await backup(page);expect(local.floors).toHaveLength(2);expect(local.revision).toBe(1);
 expect(cloud.heads.get(id)!.revision).toBe(3); // nothing overwritten
});

test('FR-031 a cloud project opens from the Projects screen without uploading itself again',async({page})=>{
 const cloud=new FakeCloud(),sample=JSON.parse(await readFile(new URL('../../docs/examples/sample-project.json',import.meta.url),'utf8')) as Doc;
 cloud.heads.set('prj_cloud_e2e',{revision:3,name:'Cloud house',document:{...sample,id:'prj_cloud_e2e',name:'Cloud house',revision:3}});
 await install(page,cloud);
 await page.addInitScript(value=>{localStorage.setItem('sb-gharplan-e2e-auth-token',value);},JSON.stringify(session()));
 await page.goto('/');await page.getByRole('button',{name:'Skip welcome',exact:true}).click();await saved(page);
 await page.getByRole('button',{name:'Projects',exact:true}).click();
 await page.getByRole('button',{name:'Open Cloud house from the cloud',exact:true}).click();
 await expect(page.getByRole('heading',{name:/Cloud house/})).toBeVisible();
 await expect(status(page)).toHaveText('Saved in cloud (version 3)');
 await page.waitForTimeout(2500);expect(cloud.saves).toEqual([]);
 const opened=await backup(page);expect(opened).toMatchObject({id:'prj_cloud_e2e',revision:3,name:'Cloud house'});
});
