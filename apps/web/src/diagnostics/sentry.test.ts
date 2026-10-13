import { expect, it } from 'vitest';
import { safeEvent } from './sentry';
it('reconstructs event from fixed allowlist; drops project, identity, messages, URLs, stacks, breadcrumbs and attachments', () => {
  const event = { message:'render-crash', event_id:'a'.repeat(32), timestamp:123, user:{email:'secret@example.com',id:'project-private'}, request:{url:'https://app.test/?name=Secret'}, extra:{document:{name:'Private house',vertices:[1,2]}}, tags:{projectId:'secret'}, breadcrumbs:[{message:'private room'}], exception:{values:[{value:'Secret room 4500mm'}]}, contexts:{drawing:{name:'Private'}}, release:'private', environment:'private' };
  expect(safeEvent(event,true)).toEqual({type:undefined,message:'render-crash',level:'error',platform:'javascript',sdk:{name:'sentry.javascript.browser',version:'11.6.0',settings:{infer_ip:'never'}},event_id:'a'.repeat(32),timestamp:123});
  expect(JSON.stringify(safeEvent(event,true))).not.toContain('secret'); expect(safeEvent(event,false)).toBeNull();
  expect(safeEvent({message:'Private exception'},true)).toBeNull(); expect(safeEvent({message:'render-crash',type:'transaction'},true)).toBeNull();
});
it('actual SDK transport emits only the allowlisted envelope, no credentials/referrer; revocation stops later sends', async () => {
  const { createReporter } = await import('./sentry');
  const { getIsolationScope } = await import('@sentry/browser');
  const isolation = getIsolationScope(); isolation.setExtra('drawing', { name:'Private house' }); isolation.setUser({ email:'private@example.com' }); isolation.addAttachment({filename:'private.json',data:'Secret drawing'});
  const requests: {url: string; init: RequestInit | undefined}[]=[]; let allowed=true;
  const reporter = createReporter('https://0123456789abcdef0123456789abcdef@o123.ingest.us.sentry.io/123',()=>allowed,async(url,init)=>{requests.push({url:String(url),init});return new Response(null,{status:200});});
  try {
    reporter.report('render-crash');await new Promise(resolve=>setTimeout(resolve,100));expect(requests).toHaveLength(1);
    const request=requests[0]!;expect(request.init?.credentials).toBe('omit');expect(request.init?.referrerPolicy).toBe('no-referrer');
    const lines=String(request.init?.body).split('\n');expect(lines).toHaveLength(3);expect(Object.keys(JSON.parse(lines[0]!)).sort()).toEqual(['event_id','sent_at']);expect(JSON.parse(lines[1]!)).toEqual({type:'event'});
    expect(JSON.parse(lines[2]!)).toMatchObject({message:'render-crash',level:'error',platform:'javascript'});expect(Object.keys(JSON.parse(lines[2]!)).sort()).toEqual(['event_id','level','message','platform','sdk','timestamp']);
    expect(JSON.parse(lines[2]!).sdk).toEqual({name:'sentry.javascript.browser',version:'11.6.0',settings:{infer_ip:'never'}});expect(String(request.init?.body)).not.toMatch(/Private|Secret|private|attachment|exception|breadcrumb|request|user/);
    allowed=false;reporter.report('startup-failed');await new Promise(resolve=>setTimeout(resolve,100));expect(requests).toHaveLength(1);
  } finally { allowed=false;reporter.close();isolation.clearAttachments();isolation.setUser(null);isolation.setExtras({}); }
});
