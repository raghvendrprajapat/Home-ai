// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import type {AiQuota,CloudApi,CloudUser,RoomAiApi} from '../cloud/api';
import {CloudSession} from '../cloud/session';
import {RoomPhotoPanel} from './RoomPhotoPanel';
import {preparePhoto} from './photo-prep';

// D86 Claude-authored UI checks for the AI controls with a fake signed-in session (no network). jsdom has no canvas
// or modal dialogs (as in room-photo-ui.test.tsx); photo decoding is replaced.
vi.mock('./photo-prep',async original=>({...await original<typeof import('./photo-prep')>(),preparePhoto:vi.fn()}));
const USER:CloudUser={id:'0a1b2c3d-0000-4000-8000-000000000001',email:'owner@example.test',name:'Owner',lastSignInAt:null};
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 vi.mocked(preparePhoto).mockResolvedValue({width:40,height:30,data:new Uint8ClampedArray(40*30*4).fill(128)});
});
afterEach(()=>{cleanup();localStorage.clear();});
async function session(user:CloudUser|null,quota:Partial<AiQuota>={}){
 const roomAi={quota:vi.fn(async()=>({ok:true as const,enabled:true,paused:false,segmentPaused:false,previewsPerMonth:3,previewsLeft:2,segmentsLeft:20,...quota})),reserve:vi.fn(),upload:vi.fn(),submit:vi.fn(),segment:vi.fn(),job:vi.fn(),download:vi.fn(),remove:vi.fn()} as unknown as RoomAiApi;
 const api={user:()=>user,onUser:()=>()=>undefined,onSignInFailed:()=>()=>undefined,roomAi} as unknown as CloudApi;
 const cloud=new CloudSession({url:'https://gharplan-e2e.supabase.co',anonKey:'sb_publishable_test'},async()=>api);await cloud.ensure();
 return {cloud,roomAi};
}
const open=async(cloud:CloudSession|null,locale:'en'|'hi'='en')=>{
 render(<RoomPhotoPanel locale={locale} cloud={cloud}/>);
 fireEvent.change(document.querySelector('input.viz-file')!,{target:{files:[new File([new Uint8Array(64)],'room.jpg',{type:'image/jpeg'})]}});
 return screen.findByRole('dialog',{name:locale==='hi'?'कमरे की फ़ोटो':'Room photo'});
};

it('without cloud set up there are no AI controls at all',async()=>{
 const view=await open(null);await screen.findByRole('button',{name:'Show result'});
 expect(view.querySelector('[data-testid=viz-ai]')).toBeNull();
 expect(screen.queryByRole('button',{name:'Tap to select (AI)'})).toBeNull();
});
it('signed out: the AI controls only explain how to get previews',async()=>{
 const {cloud,roomAi}=await session(null);await open(cloud);
 expect(await screen.findByText('Sign in under Project → Cloud saving to get free AI previews every month.')).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Make AI preview (uses 1)'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Tap to select (AI)'})).toBeNull();
 expect(roomAi.quota).not.toHaveBeenCalled();
});
it('signed in: previews left, consent before the first use (Not now keeps it unsaved), then the normal area check',async()=>{
 const {cloud,roomAi}=await session(USER);await open(cloud);
 expect((await screen.findByTestId('ai-quota')).textContent).toBe('AI previews left this month: 2 of 3');
 expect(screen.getByRole('button',{name:'Tap to select (AI)'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Make AI preview (uses 1)'}));
 const consent=screen.getByTestId('ai-consent');
 expect(consent.getAttribute('role')).toBe('dialog');
 expect(consent.textContent).toContain('sends your room photo, the area you chose and any reference picture (tile, pattern or artwork) to fal.ai, a service that runs an OpenAI image model.');
 expect(consent.textContent).toContain('deleted automatically after 7 days. They are not used for marketing and are not sold.');
 expect(consent.textContent).toContain('Each account gets 3 free AI previews a month.');
 const link=screen.getByRole('link',{name:'Privacy policy'}) as HTMLAnchorElement;
 expect(link.href.endsWith('/privacy.html')).toBe(true);expect(link.target).toBe('_blank');
 fireEvent.click(screen.getByRole('button',{name:'Not now'}));
 expect(screen.queryByTestId('ai-consent')).toBeNull();
 expect(localStorage.getItem(`gharplan.roomAi.consent.v1.${USER.id}`)).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Make AI preview (uses 1)'}));
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'I agree, continue'}));await Promise.resolve();});
 expect(localStorage.getItem(`gharplan.roomAi.consent.v1.${USER.id}`)).toMatch(/^\d{4}-\d\d-\d\dT/);
 expect(screen.getByRole('alert').textContent).toBe('Choose an area on the photo first.');
 expect(roomAi.reserve).not.toHaveBeenCalled();
 // Consent is asked once per account on this device.
 fireEvent.click(screen.getByRole('button',{name:'Tap to select (AI)'}));
 expect(screen.queryByTestId('ai-consent')).toBeNull();
 expect(screen.getByTestId('ai-tap-note').textContent).toBe('Tap a wall, floor or object; AI adds it to the area. Taps left today: 20.');
});
it('Escape closes the consent, not the visualizer',async()=>{
 const {cloud}=await session(USER);const view=await open(cloud);await screen.findByTestId('ai-quota');
 fireEvent.click(screen.getByRole('button',{name:'Tap to select (AI)'}));
 expect(screen.getByTestId('ai-consent')).toBeTruthy();
 fireEvent(view,new Event('cancel',{cancelable:true}));
 expect(screen.queryByTestId('ai-consent')).toBeNull();
 expect(screen.getByRole('dialog',{name:'Room photo'})).toBeTruthy();
});
it('the monthly cap shows "paused" and the button is off; used-up previews switch it off too; Hindi text',async()=>{
 const paused=await session(USER,{paused:true});await open(paused.cloud);
 expect((await screen.findByText('AI is paused for this month. The offline preview still works.'))).toBeTruthy();
 expect((screen.getByRole('button',{name:'Make AI preview (uses 1)'}) as HTMLButtonElement).disabled).toBe(true);
 cleanup();
 const used=await session(USER,{previewsLeft:0});await open(used.cloud,'hi');
 expect((await screen.findByTestId('ai-quota')).textContent).toBe('इस महीने बची AI झलक: 3 में से 0');
 expect((screen.getByRole('button',{name:'AI झलक बनाएँ (1 लगेगी)'}) as HTMLButtonElement).disabled).toBe(true);
});
