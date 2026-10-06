import {WebGLRenderer,type WebGLRendererParameters} from 'three'
export async function createForestRenderer(parameters:WebGLRendererParameters){
 if(new URLSearchParams(location.search).get('renderer')==='webgl')return new WebGLRenderer({...parameters,antialias:true,alpha:false,powerPreference:'high-performance'})
 // Probe before creating a canvas context: a canvas cannot switch context types.
 const gpu=(navigator as Navigator&{gpu?:{requestAdapter:()=>Promise<unknown>}}).gpu
 let available=false
 try{available=Boolean(gpu&&await gpu.requestAdapter())}catch{/* Restricted/unavailable GPU uses the established WebGL path. */}
 if(available){
  const {WebGPURenderer}=await import('three/webgpu')
  const renderer=new WebGPURenderer({canvas:parameters.canvas as HTMLCanvasElement,antialias:false,alpha:false,trackTimestamp:new URLSearchParams(location.search).get('profile')==='1'})
  try{await renderer.init();if((renderer.backend as any).isWebGPUBackend)return renderer as unknown as WebGLRenderer}catch{/* Renderer/device initialization may fail independently of adapter probing. */}
  renderer.dispose()
 }
 return new WebGLRenderer({...parameters,antialias:true,alpha:false,powerPreference:'high-performance'})
}
export function isNativeWebGPU(renderer:unknown):boolean{return Boolean((renderer as any)?.backend?.isWebGPUBackend)}
