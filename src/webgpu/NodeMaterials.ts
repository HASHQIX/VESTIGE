import {NodeMaterial,Texture,type ShaderMaterial,type WebGPURenderer} from 'three/webgpu'
import {Fn,attribute,cameraProjectionMatrix,modelViewMatrix,modelWorldMatrix,property,screenCoordinate,float,vec4,varying,texture,uniform,uniformArray,uv,outputStruct} from 'three/tsl'
import metadata from './generated/bindings.json'
import {instancedFiberBindings} from './InstancedFiberBindings.ts'
import {filamentVertex} from './generated/filamentVertex.js'
import {filamentFragment} from './generated/filamentFragment.js'
import {sporeVertex} from './generated/sporeVertex.js'
import {sporeFragment} from './generated/sporeFragment.js'
import {dustVertex} from './generated/dustVertex.js'
import {dustFragment} from './generated/dustFragment.js'
import {tracerVertex} from './generated/tracerVertex.js'
import {tracerFragment} from './generated/tracerFragment.js'
import {previewVertex} from './generated/previewVertex.js'
import {previewFragment} from './generated/previewFragment.js'
import {groundPreviewVertex} from './generated/groundPreviewVertex.js'
import {groundPreviewFragment} from './generated/groundPreviewFragment.js'
import {atmosphereVertex} from './generated/atmosphereVertex.js'
import {atmosphereFragment} from './generated/atmosphereFragment.js'
import {velocityFilamentVertex} from './generated/velocityFilamentVertex.js'
import {velocityFilamentFragment} from './generated/velocityFilamentFragment.js'
import {velocityTracerVertex} from './generated/velocityTracerVertex.js'
import {velocityTracerFragment} from './generated/velocityTracerFragment.js'
import {velocityDustVertex} from './generated/velocityDustVertex.js'
import {velocityDustFragment} from './generated/velocityDustFragment.js'
import {velocitySporeVertex} from './generated/velocitySporeVertex.js'
import {velocitySporeFragment} from './generated/velocitySporeFragment.js'
import {matter0} from './generated/matter0.js'
import {matter1} from './generated/matter1.js'
import {matter2} from './generated/matter2.js'
import {matter3} from './generated/matter3.js'
// Generated factories are an intentionally small untyped boundary around Three's
// shader graph. Application settings, source material and lifecycle stay typed.
type Bindings=Record<string,any>
const factories:Record<string,(bindings:Bindings)=>any>={filamentVertex,filamentFragment,sporeVertex,sporeFragment,dustVertex,dustFragment,tracerVertex,tracerFragment,previewVertex,previewFragment,groundPreviewVertex,groundPreviewFragment,atmosphereVertex,atmosphereFragment,velocityFilamentVertex,velocityFilamentFragment,velocityTracerVertex,velocityTracerFragment,velocityDustVertex,velocityDustFragment,velocitySporeVertex,velocitySporeFragment,matter0,matter1,matter2,matter3}
export type GraphMaterial={material:NodeMaterial;sync:()=>void;bindings:Bindings}
export function nodeMaterial(source:ShaderMaterial,kind:string,overrides:Bindings={},fullscreen=false,renderer?:WebGPURenderer):GraphMaterial {
 if(source.userData.filamentPacking==='instanced'){
  if(!renderer)throw new Error('Instanced filament graphs require their owning renderer')
  overrides={...instancedFiberBindings(source,renderer),...overrides}
 }
 const keys=fullscreen?[kind]:[kind+'Vertex',kind+'Fragment']
 const types=Object.assign({},...keys.map(k=>(metadata as Record<string,Record<string,string>>)[k])) as Record<string,string>
 const bindings:Bindings={},updates:(()=>void)[]=[]
 const text=source.vertexShader+'\n'+source.fragmentShader
 const varyings=new Set([...text.matchAll(/varying\s+\w+\s+(\w+)\s*;/g)].map(m=>m[1]))
 const attrs=new Set(['position',...Array.from(text.matchAll(/attribute\s+\w+\s+(\w+)\s*;/g),m=>m[1])])
 for(const [key,type] of Object.entries(types)){
  if(key in overrides){bindings[key]=overrides[key];continue}
  if(key==='level'&&source.userData.filamentPacking==='legacy'){bindings[key]=attribute('fiberMeta','vec4').x;continue}
  if(key==='flow'&&source.userData.filamentPacking==='tangent'){bindings[key]=attribute('next','vec3').sub(attribute('previous','vec3'));continue}
  if(key==='projectionMatrix'){bindings[key]=cameraProjectionMatrix;continue}
  if(key==='modelViewMatrix'){bindings[key]=modelViewMatrix;continue}
  if(key==='modelMatrix'){bindings[key]=modelWorldMatrix;continue}
  if(key==='pixelCoord'){bindings[key]=vec4(screenCoordinate,0,1);continue}
  if(key==='uv'||fullscreen&&(key==='uv0'||key==='vUv')){bindings[key]=uv();continue}
  if(key==='fiberMeta'||attrs.has(key)){bindings[key]=attribute(key,type as any);continue}
  const shared=source.uniforms[key]
  if(shared){
   if(type==='texture'){
    const t=texture(shared.value??new Texture());bindings[key]={sample:(p:any)=>t.sample(p).level(float(0))};updates.push(()=>{if(shared.value)t.value=shared.value})
   }else if(Array.isArray(shared.value)){
    const n=uniformArray(shared.value,type as any);bindings[key]=n;updates.push(()=>{n.array=shared.value})
   }else{
    const n=uniform(shared.value,type as any);bindings[key]=n;updates.push(()=>{n.value=shared.value})
   }
  }else bindings[key]=varyings.has(key)&&!fullscreen?varying(property(type as any),key):property(type as any)
 }
 const material=new NodeMaterial()
 material.name='webgpu-'+kind;material.transparent=source.transparent;material.depthTest=source.depthTest;material.depthWrite=source.depthWrite;material.side=source.side;material.blending=source.blending;material.forceSinglePass=source.forceSinglePass;material.toneMapped=false;material.fog=false
 if(!fullscreen){const vertex=factories[keys[0]](bindings);material.vertexNode=Fn(()=>{vertex.shaderMain();return bindings.gl_Position})()}
 const fragment=factories[keys.at(-1)!](bindings)
 if(kind.startsWith('velocity'))material.fragmentNode=outputStruct(Fn(()=>{fragment.shaderMain();return bindings.mcVelocityOutput})(),bindings.mcFlowOutput)
 else material.fragmentNode=Fn(()=>{fragment.shaderMain();return bindings.shaderColor})()
 const sync=()=>updates.forEach(update=>update());sync()
 return {material,sync,bindings}
}
