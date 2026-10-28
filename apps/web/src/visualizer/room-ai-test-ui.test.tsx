// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen} from '@testing-library/react';
import VisualizerView from './VisualizerView';
import {preparePhoto} from './photo-prep';
import type {TestAi} from './test-surface';
import {TestAiError} from './test-surface';

// D92 Claude-authored UI checks for AI test mode with a fake provider (no network). jsdom has no canvas or modal
// dialogs and lays nothing out, so the photo frame (and brushing) is not shown here; the full flow with a brushed
// area, the wait, the result and tap-to-select runs in the Playwright spec tests/e2e-ai-test/room-ai-test.spec.ts.
vi.mock('./photo-prep',async original=>({...await original<typeof import('./photo-prep')>(),preparePhoto:vi.fn()}));
beforeEach(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(null);
 vi.mocked(preparePhoto).mockResolvedValue({width:40,height:30,data:new Uint8ClampedArray(40*30*4).fill(128)});
});
afterEach(()=>{cleanup();localStorage.clear();});
const fakeAi=()=>({provider:{kind:'server' as const,render:vi.fn(async()=>{throw new TestAiError('UNEXPECTED');})},segment:vi.fn(async()=>null)}) satisfies TestAi;
const open=async(testAi:TestAi|null,locale:'en'|'hi'='en')=>{
 render(<VisualizerView file={new File([new Uint8Array(64)],'room.jpg',{type:'image/jpeg'})} locale={locale} onClose={()=>undefined} testAi={testAi}/>);
 await screen.findByRole('button',{name:locale==='hi'?'नतीजा देखें':'Show result'});
};

it('flag off (no test provider): no AI test mode controls',async()=>{
 await open(null);
 expect(screen.queryByTestId('viz-ai-test')).toBeNull();
 expect(screen.queryByText('AI test mode')).toBeNull();
 expect(screen.queryByRole('button',{name:'Tap to select (AI)'})).toBeNull();
});
it('first use: access code, then the test-mode consent (OpenAI + fal.ai, nothing stored by us), then the normal area check',async()=>{
 const ai=fakeAi();await open(ai);
 expect(screen.getByTestId('viz-ai-test').textContent).toContain('AI test mode');
 expect(screen.queryByTestId('viz-ai')).toBeNull();
 expect(screen.queryByRole('button',{name:'Forget code'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Make AI preview'}));
 const prompt=screen.getByTestId('ai-code');
 expect(prompt.textContent).toContain('Enter the AI access code');
 const input=screen.getByLabelText('Access code') as HTMLInputElement;
 expect([input.type,input.autocomplete]).toEqual(['password','off']);
 fireEvent.click(screen.getByRole('button',{name:'Use this code'}));
 expect(screen.getByRole('alert').textContent).toBe('Type the access code first.');
 fireEvent.change(input,{target:{value:'  tester-code-2026 '}});
 fireEvent.click(screen.getByRole('button',{name:'Use this code'}));
 expect(localStorage.getItem('gharplan.roomAi.testCode')).toBe('tester-code-2026');
 const consent=screen.getByTestId('ai-consent');
 expect(consent.textContent).toContain('sends your room photo, the area you chose and any reference picture (tile, pattern or artwork) to OpenAI.');
 expect(consent.textContent).toContain('it sends your room photo and the tapped point to fal.ai, which runs Meta\'s SAM-2 model.');
 expect(consent.textContent).toContain('GharPlan\'s own server stores none of these.');
 expect(consent.textContent).toContain('may keep it for up to 30 days');
 expect(consent.textContent).toContain('delete the uploaded photo after 1 hour');
 expect(consent.textContent).not.toContain('7 days');
 expect(consent.textContent).toContain('only for testers with the owner\'s access code');
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'I agree, continue'}));await Promise.resolve();});
 expect(localStorage.getItem('gharplan.roomAi.testConsent.v1')).toMatch(/^\d{4}-\d\d-\d\dT/);
 expect(screen.getByRole('alert').textContent).toBe('Choose an area on the photo first.');
 expect(ai.provider.render).not.toHaveBeenCalled();
 // Both are asked once per device; Tap to select goes straight to its tool.
 fireEvent.click(screen.getByRole('button',{name:'Tap to select (AI)'}));
 expect(screen.queryByTestId('ai-code')).toBeNull();
 expect(screen.queryByTestId('ai-consent')).toBeNull();
 expect(screen.getByTestId('ai-tap-note').textContent).toBe('Tap a wall, floor or object; AI adds it to the area.');
 fireEvent.click(screen.getByRole('button',{name:'Forget code'}));
 expect(localStorage.getItem('gharplan.roomAi.testCode')).toBeNull();
 expect(screen.getByTestId('ai-test-note').textContent).toBe('The access code was removed from this device.');
 fireEvent.click(screen.getByRole('button',{name:'Make AI preview'}));
 expect(screen.getByTestId('ai-code')).toBeTruthy();
});
it('Not now and Escape close the code prompt without saving anything; Hindi text',async()=>{
 await open(fakeAi(),'hi');
 expect(screen.getByTestId('viz-ai-test').textContent).toContain('AI टेस्ट मोड');
 fireEvent.click(screen.getByRole('button',{name:'AI झलक बनाएँ'}));
 expect(screen.getByTestId('ai-code').textContent).toContain('AI एक्सेस कोड डालें');
 fireEvent.click(screen.getByRole('button',{name:'अभी नहीं'}));
 expect(screen.queryByTestId('ai-code')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'AI झलक बनाएँ'}));
 fireEvent(screen.getByRole('dialog',{name:'कमरे की फ़ोटो'}),new Event('cancel',{cancelable:true}));
 expect(screen.queryByTestId('ai-code')).toBeNull();
 expect(screen.getByRole('dialog',{name:'कमरे की फ़ोटो'})).toBeTruthy();
 expect(localStorage.length).toBe(0);
});
