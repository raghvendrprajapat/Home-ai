import {describe,expect,it} from 'vitest';
import fc from 'fast-check';
import {encodedSize,pictureFileName,watermarkLayout} from './hd-picture';

// D89 builder (Claude) tests with hand-written expected values.
describe('D89 picture file name',()=>{
 const day=new Date(2026,9,27,23,59);
 it('project name + local date + size + extension',()=>{
  expect(pictureFileName('My Home 2BHK!',day,1920,1080,'png')).toBe('gharplan-my-home-2bhk-2026-10-27-1920x1080.png');
  expect(pictureFileName('  Sharma ji / Plot #12 ',day,2048,2048,'jpeg')).toBe('gharplan-sharma-ji-plot-12-2026-10-27-2048x2048.jpg');
  expect(pictureFileName('मेरा घर',new Date(2026,0,5),2560,1440,'png')).toBe('gharplan-मेरा-घर-2026-01-05-2560x1440.png');
  expect(pictureFileName('***',day,1920,1080,'png')).toBe('gharplan-design-2026-10-27-1920x1080.png');
  expect(pictureFileName('a'.repeat(39)+' bcd',day,1,1,'png')).toBe(`gharplan-${'a'.repeat(39)}-2026-10-27-1x1.png`);
  expect(pictureFileName('x',new Date(Number.NaN),1,1,'png')).toBe('gharplan-x-undated-1x1.png');
 });
 it('property: always a safe single file name',()=>{
  fc.assert(fc.property(fc.string({maxLength:120}),fc.integer({min:1,max:4096}),fc.integer({min:1,max:4096}),fc.constantFrom('png','jpeg' as const),(name,w,h,format)=>{
   const file=pictureFileName(name,day,w,h,format);expect(file).toMatch(new RegExp(`^gharplan-[\\p{L}\\p{M}\\p{N}-]{1,40}-2026-10-27-${w}x${h}\\.(png|jpg)$`,'u'));expect(file).not.toMatch(/[/\\:*?"<>|\s]/);
  }));
 });
});
describe('D89 watermark and encoded size',()=>{
 it('bottom-right mark scales with the short side',()=>{
  expect(watermarkLayout(1920,1080)).toEqual({fontSize:28,x:1895,y:1055});expect(watermarkLayout(2048,2048)).toEqual({fontSize:53,x:2000,y:2000});expect(watermarkLayout(300,200)).toEqual({fontSize:14,x:287,y:187});
 });
 it('reads PNG IHDR and JPEG start-of-frame dimensions',()=>{
  const png=new Uint8Array(33);png.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0x07,0x80,0,0,0x04,0x38]);expect(encodedSize(png)).toEqual({format:'png',width:1920,height:1080});
  const app0=[0xff,0xe0,0,16,...new Array<number>(14).fill(0)];
  for(const sof of [0xc0,0xc2])expect(encodedSize(Uint8Array.from([0xff,0xd8,...app0,0xff,sof,0,17,8,0x05,0xa0,0x0a,0x00,3,1,0x22,0]))).toEqual({format:'jpeg',width:2560,height:1440});
  expect(()=>encodedSize(Uint8Array.from([0xff,0xd8,0xff,0xd9]))).toThrow('image-encode');expect(()=>encodedSize(new Uint8Array(40))).toThrow('image-encode');
 });
});
