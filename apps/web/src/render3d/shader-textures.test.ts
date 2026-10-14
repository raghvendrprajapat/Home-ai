import {it,expect,vi} from 'vitest';
import {Texture} from 'three';
import {ShaderTextures} from './shader-textures';
it('leases shared shader LUT until every renderer releases it; samples mutable uniforms at failed-render cleanup',()=>{
 const texture=new Texture(),dispose=vi.spyOn(texture,'dispose'),a=new ShaderTextures(),b=new ShaderTextures(),uniform={value:null as unknown};
 a.observe({dfgLUT:uniform});a.sample();uniform.value=texture;a.sample();b.observe({dfgLUT:{value:texture}});b.sample();a.close();a.close();expect(dispose).not.toHaveBeenCalled();b.close();expect(dispose).toHaveBeenCalledTimes(1);
 const c=new ShaderTextures();c.observe({dfgLUT:{value:texture}});c.close();expect(dispose).toHaveBeenCalledTimes(2);c.observe({dfgLUT:{value:texture}});c.sample();c.close();expect(dispose).toHaveBeenCalledTimes(2);
});
it('does not dispose canonical textures or unassigned uniforms',()=>{const texture=new Texture(),dispose=vi.spyOn(texture,'dispose'),owned=new ShaderTextures();owned.observe({map:{value:texture},dfgLUT:{value:null}});owned.close();expect(dispose).not.toHaveBeenCalled();});

it('shader cleanup releases later leases despite an earlier texture disposer error and closes once',()=>{const a=new Texture(),b=new Texture(),disposeA=vi.spyOn(a,'dispose').mockImplementation(()=>{throw Error('texture-dispose');}),disposeB=vi.spyOn(b,'dispose'),owned=new ShaderTextures();owned.observe({dfgLUT:{value:a}});owned.observe({dfgLUT:{value:b}});expect(()=>owned.close()).toThrow('texture-dispose');owned.close();expect(disposeA).toHaveBeenCalledTimes(1);expect(disposeB).toHaveBeenCalledTimes(1);});
