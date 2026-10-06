import {attribute,mod,storage,uint,vec4} from 'three/tsl'
import {StorageBufferAttribute,type DataTexture,type ShaderMaterial,type WebGPURenderer} from 'three/webgpu'

const createField=(array:Float32Array)=>storage(new StorageBufferAttribute(array,4),'vec4',array.length/4).toReadOnly()
const fields=new WeakMap<DataTexture,WeakMap<WebGPURenderer,ReturnType<typeof createField>>>()
function pointField(source:ShaderMaterial,renderer:WebGPURenderer){
 const owner=source.uniforms.pointTexture.value as DataTexture
 let owners=fields.get(owner)
 if(!owners){owners=new WeakMap();fields.set(owner,owners)}
 let field=owners.get(renderer)
 if(!field){
  const array=owner.image.data as Float32Array,attribute=new StorageBufferAttribute(array,4)
  field=storage(attribute,'vec4',array.length/4).toReadOnly();owners.set(renderer,field)
  const node=field
  const dispose=()=>{
   // Pinned r186 boundary, also used by ComputeTracers. BufferAttribute has no
   // public dispose; the source atlas owns this immutable native buffer.
   (renderer as any)._attributes.delete(attribute);node.dispose();owners.delete(renderer);owner.removeEventListener('dispose',dispose)
  }
  owner.addEventListener('dispose',dispose)
 }
 return field
}

/** Supply the existing filament/velocity graph with reconstructed vertex inputs.
 * Current and neighbouring points come from one exact float atlas; all lighting,
 * joins, depth rejection and temporal mathematics remain in the shared graph. */
export function instancedFiberBindings(source:ShaderMaterial,renderer:WebGPURenderer){
 const range=attribute('stripRange','vec2'),vertex=attribute('ribbonVertex','vec3')
 const points=pointField(source,renderer)
 const index=range.x.add(vertex.y).min(range.y)
 const read=(id:any,part:number)=>{
  return points.element(uint(id.mul(2).add(part)))
 }
 const current=read(index,0),params=read(index,1)
 const previous=read(mod(params.w,2).greaterThan(.5).select(index,index.sub(1)),0).xyz
 const next=read(params.w.greaterThan(1.5).select(index,index.add(1)),0).xyz
 return {position:current.xyz,previous,next,flow:next.sub(previous),data:vec4(vertex.x,params.x,current.w,params.y),level:params.z}
}
