import {QuadMesh,type ShaderMaterial,type WebGPURenderer} from 'three/webgpu'
import {nodeMaterial} from './NodeMaterials'
// Reuse the existing pass scheduling/budget/resize logic. Replace every GLSL
// fullscreen draw with a native NodeMaterial/QuadMesh; EffectComposer is unused.
export function graphPass(pass:{materials:ShaderMaterial[];quad:{material:unknown;render:unknown}},prefix:string){
 const graphs=pass.materials.map((m,i)=>nodeMaterial(m,prefix+i,{},true)),quad=new QuadMesh(graphs[0].material)
 pass.quad.render=(renderer:WebGPURenderer)=>{const i=pass.materials.indexOf(pass.quad.material as ShaderMaterial),g=graphs[i];g.sync();quad.material=g.material;quad.render(renderer)}
 return {dispose:()=>{graphs.forEach(g=>g.material.dispose())}}
}
