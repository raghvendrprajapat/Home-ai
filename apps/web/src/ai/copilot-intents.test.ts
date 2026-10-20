import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {readIntent} from './copilot-intents';

// D76 M3 Claude-authored phrase table: the spec's English/Hinglish examples plus everyday variants and Hindi script.
describe('D76 Copilot intents',()=>{
 it.each([
  ['Make a 2BHK',{kind:'template',template:'2bhk'}],
  ['2BHK banao',{kind:'template',template:'2bhk'}],
  ['ek 2 bhk ghar banao',{kind:'template',template:'2bhk'}],
  ['मुझे २ बीएचके चाहिए',{kind:'template',template:'2bhk'}],
  ['start a 1BHK plan',{kind:'template',template:'1bhk'}],
 ])('template: %s',(text,expected)=>expect(readIntent(text)).toEqual(expected));
 it.each([
  ['Furnish the bedroom','bedroom'],
  ['bedroom furnish karo','bedroom'],
  ['living room sajao','living'],
  ['बेडरूम सजाओ','bedroom'],
  ['add furniture to the dining room','dining'],
 ])('furnish: %s',(text,type)=>{const intent=readIntent(text);expect(intent.kind).toBe('furnish');if(intent.kind==='furnish')expect(intent.room?.type).toBe(type);});
 it('furnish without a room keeps the room open',()=>expect(readIntent('furnish it')).toEqual({kind:'furnish',room:null}));
 it.each([
  ['Paint the walls beige','beige',null],
  ['deewar beige karo','beige',null],
  ['deewaron ko safed rang do','white',null],
  ['दीवार बेज करो','beige',null],
  ['paint the bedroom walls sky blue','sky_blue','bedroom'],
  ['walls ka colour change karo',null,null],
 ])('paint walls: %s',(text,colour,type)=>{const intent=readIntent(text);expect(intent.kind).toBe('paintWalls');if(intent.kind==='paintWalls'){expect(intent.colour).toBe(colour);expect(intent.room?.type??null).toBe(type);}});
 it.each([
  ['Wooden floor in the living room','wood','living'],
  ['living room mein wooden floor','wood','living'],
  ['bedroom ka farsh marble karo','marble','bedroom'],
  ['रसोई में टाइल का फ़र्श','tile','kitchen'],
  ['रसोई में टाइल का फर्श','tile','kitchen'],
  ['kitchen me tiles lagao','tile','kitchen'],
  ['change the floor',null,null],
 ])('floor: %s',(text,finish,type)=>{const intent=readIntent(text);expect(intent.kind).toBe('floor');if(intent.kind==='floor'){expect(intent.finish).toBe(finish);expect(intent.room?.type??null).toBe(type);}});
 it.each(['hello','make it look nice','delete everything','add a fridge','furniture ko blue karo','','   ',
  'x'.repeat(500)])('anything else is help: %j',text=>expect(readIntent(text)).toEqual({kind:'help'}));
 it('property: any text gives one of the five intents and never throws',()=>{
  fc.assert(fc.property(fc.string({maxLength:300}),text=>{expect(['template','furnish','paintWalls','floor','help']).toContain(readIntent(text).kind);}),{numRuns:500});
 });
});
