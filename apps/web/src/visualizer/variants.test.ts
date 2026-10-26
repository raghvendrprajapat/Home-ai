import {describe,expect,it} from 'vitest';
import {sliderFromPointer,sliderKey} from './CompareSlider';
import {addVariant,MAX_VARIANTS,nextLetter,variantLabel} from './variants';

// D85 Claude-authored builder tests.
describe('D85 kept options',()=>{
 it('keeps at most four options and refuses a fifth or a duplicate',()=>{
  let list:{id:string}[]=[];
  for(const id of ['a','b','c','d']){const next=addVariant(list,{id});expect(next).toBeDefined();list=next!;}
  expect(list.map(v=>v.id)).toEqual(['a','b','c','d']);expect(MAX_VARIANTS).toBe(4);
  expect(addVariant(list,{id:'e'})).toBeUndefined();
  expect(addVariant(list.slice(0,2),{id:'a'})).toBeUndefined();
 });
 it('labels are short and default to the next free letter',()=>{
  expect(variantLabel('   Tile   A  ','Option A')).toBe('Tile A');
  expect(variantLabel('','Option B')).toBe('Option B');
  expect(variantLabel('x'.repeat(40),'Option A')).toBe('x'.repeat(24));
  expect(nextLetter([],'Option')).toBe('Option A');
  expect(nextLetter([{label:'Option A'},{label:'Tile'}],'Option')).toBe('Option B');
  expect(nextLetter([{label:'Option B'}],'विकल्प')).toBe('विकल्प A');
 });
});

describe('D85 compare slider maths',()=>{
 it('follows the pointer across the frame, kept within 0–100 %',()=>{
  expect(sliderFromPointer(150,{left:100,width:200})).toBe(25);
  expect(sliderFromPointer(50,{left:100,width:200})).toBe(0);expect(sliderFromPointer(400,{left:100,width:200})).toBe(100);
 });
 it('moves by keyboard: arrows 2 %, Page keys 10 %, Home/End to the ends',()=>{
  expect(sliderKey(50,'ArrowRight')).toBe(52);expect(sliderKey(50,'ArrowLeft')).toBe(48);expect(sliderKey(50,'ArrowUp')).toBe(52);
  expect(sliderKey(95,'PageUp')).toBe(100);expect(sliderKey(5,'PageDown')).toBe(0);expect(sliderKey(37,'Home')).toBe(0);expect(sliderKey(37,'End')).toBe(100);
  expect(sliderKey(37,'Enter')).toBeUndefined();
 });
});
