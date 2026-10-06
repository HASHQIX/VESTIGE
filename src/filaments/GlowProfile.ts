import {DataTexture,DataUtils,HalfFloatType,LinearFilter,RGBAFormat} from 'three'
export type GlowMode='analytic'|'atlas'|'local'
export function forestGlowMode():GlowMode {
 const mode=typeof location==='undefined'?null:new URLSearchParams(location.search).get('glow')
 return mode==='atlas'||mode==='local'?mode:'analytic'
}
const SIZE=512
let shared:DataTexture|undefined,users=0
/** One reusable optical profile: fiber core, packet head, and a wider local halo. */
export function acquireGlowProfile(){
 if(!shared){
  const data=new Uint16Array(SIZE*4)
  for(let i=0;i<SIZE;i++){
   const x=i/(SIZE-1)*4
   data[i*4]=DataUtils.toHalfFloat(Math.exp(-x*x*36)+Math.exp(-x*x*5)*.075)
   data[i*4+1]=DataUtils.toHalfFloat(Math.exp(-x*x))
   data[i*4+2]=DataUtils.toHalfFloat(Math.exp(-x*x*.22)*.055)
   data[i*4+3]=DataUtils.toHalfFloat(1)
  }
  shared=new DataTexture(data,SIZE,1,RGBAFormat,HalfFloatType)
  shared.name='shared-baked-filament-light';shared.minFilter=shared.magFilter=LinearFilter;shared.generateMipmaps=false;shared.needsUpdate=true
 }
 const texture=shared;users++;let released=false
 return {texture,size:SIZE,release:()=>{if(released)return;released=true;if(--users===0){texture.dispose();shared=undefined}}}
}
