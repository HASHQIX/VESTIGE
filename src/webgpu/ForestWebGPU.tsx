import {forestGlowMode} from '../filaments/GlowProfile.ts'
import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {DepthTexture,DepthFormat,UnsignedIntType,HalfFloatType,RenderTarget,NearestFilter,Vector3,Matrix4,Quaternion,RenderPipeline,type Mesh,type WebGPURenderer} from 'three/webgpu'
import {texture,renderOutput} from 'three/tsl'
import {bloom} from 'three/addons/tsl/display/BloomNode.js'
import {fxaa} from 'three/addons/tsl/display/FXAANode.js'
import type {Forest} from '../forest'
import {forestSources} from '../experience/ForestGlow'
import {MatterCameraPass} from '../filaments/camera/MatterCameraPass'
import {cameraCut,type MatterCameraSettings} from '../filaments/camera/matterCameraSettings'
import {computeTracers} from './ComputeTracers'
import {compactTracerIndex} from './CompactTracerIndex'
import {nodeMaterial,type GraphMaterial} from './NodeMaterials'
import {graphPass} from './GraphPass'
import {GpuVelocity} from './GpuVelocity'
import {ForestProfiler} from './ForestProfiler'
const kinds:Record<string,string>={'layered-filament-matter':'filament','walking-ground-filaments':'filament','world-time-tracer-histories':'tracer','detached-filament-fragments':'spore','ambient-matter-dust':'dust','static-forest-preview':'preview','woven-ground-preview':'groundPreview','cold-luminous-atmosphere':'atmosphere'}
export function ForestWebGPU({forest,settings,onReady,onError}:{forest:Forest;settings:MatterCameraSettings;onReady:()=>void;onError:()=>void}){
 const {gl,scene,camera,size,invalidate}=useThree(),renderer=gl as unknown as WebGPURenderer
 const reportedReady=useRef(false)
 const effects=useMemo(()=>{
  const profiler=new URLSearchParams(location.search).get('profile')==='1'?new ForestProfiler(renderer):undefined
  if(profiler)Object.assign(forest.matterCamera,{profile:profiler.stats})
  const compute=computeTracers(forest.tracers!),tails=compactTracerIndex(renderer,forest.tracers!,compute.histories),tracerOverrides={...compute.overrides,...tails.overrides},matter=new MatterCameraPass(forest.matterCamera)
  const adaptMatter=graphPass(matter,'matter')
  const velocity=new GpuVelocity(tracerOverrides,renderer)
  const color=new RenderTarget(1,1,{type:HalfFloatType}),scratch=[new RenderTarget(1,1,{type:HalfFloatType,depthBuffer:false})],encoded=new RenderTarget(1,1,{type:HalfFloatType,depthBuffer:false})
  const depth=new RenderTarget(1,1,{minFilter:NearestFilter,magFilter:NearestFilter});depth.depthTexture=new DepthTexture(1,1,UnsignedIntType);depth.depthTexture.format=DepthFormat
  forest.filaments!.uniforms.bodyDepth.value=depth.depthTexture
  const finalTexture=texture(color.texture),glow=forestGlowMode()==='local'?undefined:bloom(finalTexture,.38,.25,1.05),output=new RenderPipeline(renderer,renderOutput(glow?finalTexture.add(glow):finalTexture));output.outputColorTransform=false;glow?.setResolutionScale(1/3)
  const final=new RenderPipeline(renderer,fxaa(texture(encoded.texture)));final.outputColorTransform=false
  const meshes=new Map<Mesh,{source:any;graph:GraphMaterial;dispose:()=>void}>()
  // Streaming increments matterRevision after adding/removing forest objects.
  // Discover graphs on those changes; ordinary frames only sync cached uniforms.
  function refreshMaterials(){
   const live=new Set<Mesh>()
   forest.group.traverse(object=>{
    const mesh=object as Mesh,kind=kinds[mesh.name];if(!kind||!('material' in mesh))return
    if(mesh.geometry.getAttribute('meta'))mesh.geometry.setAttribute('fiberMeta',mesh.geometry.getAttribute('meta'))
    live.add(mesh);let entry=meshes.get(mesh)
    if(!entry){const source=mesh.material as any,graph=nodeMaterial(source,kind,kind==='tracer'?tracerOverrides:{},false,renderer),dispose=()=>graph.material.dispose();entry={source,graph,dispose};meshes.set(mesh,entry);source.addEventListener('dispose',dispose);mesh.material=graph.material}
   })
   for(const [mesh,e] of meshes)if(!live.has(mesh)){e.source.removeEventListener('dispose',e.dispose);e.graph.material.dispose();meshes.delete(mesh)}
  }
  function syncMaterials(){for(const entry of meshes.values())entry.graph.sync()}
  refreshMaterials();velocity.syncSources(forestSources(forest))
  Object.assign(forest.matterCamera,{backend:'webgpu',compute:compute.stats,renderBudget:{bloomMode:glow?'screen':'local-profile',bloomScale:glow?.getResolutionScale()??0,filamentDensity:'preserved'}})
  const state={profiler,compute,tails,matter,adaptMatter,velocity,color,scratch,encoded,depth,finalTexture,glow,output,final,meshes,refreshMaterials,syncMaterials,previousView:new Matrix4(),previousProjection:new Matrix4(),previousPosition:new Vector3(),previousRotation:new Quaternion(),direction:new Vector3(),pose:{clock:0,dissolve:0,activity:1},initialized:false,temporal:false,revision:forest.matterRevision,compiled:false,disposed:false,error:undefined as unknown}
  // r186 precompiles the native compute pipeline before the first warm-up.
  // Stop between pipelines on unmount. An in-flight compilation may allocate
  // buffers after cleanup; release those once it settles, before continuing.
  const compile=async()=>{
   try{
    for(const node of [compute.simulation,...tails.passes]){if(state.disposed)return;await renderer.compileComputeAsync(node)}
    if(!state.disposed){state.compiled=true;invalidate()}
   }catch(error){if(!state.disposed){state.error=error;console.error('Forest compute compilation failed',error);onError()}}
   finally{if(state.disposed){tails.dispose();compute.dispose(renderer)}}
  }
  void compile()
  return state
 },[renderer,forest,scene,camera,invalidate,onError])
 useEffect(()=>{invalidate()},[settings,invalidate])
 useEffect(()=>{forest.requestFrame=invalidate;return()=>{forest.requestFrame=undefined}},[forest,invalidate])
 useEffect(()=>{
  const w=size.width,h=size.height;effects.depth.setSize(w,h);effects.color.setSize(w,h);effects.scratch.forEach(t=>t.setSize(w,h));effects.encoded.setSize(w,h);effects.velocity.setSize(w,h);effects.matter.setSize(w,h);forest.uniforms.resolution.value.set(w,h);invalidate()
 },[effects,forest,size.width,size.height,invalidate])
 useEffect(()=>{
  const previous=renderer.info.autoReset;renderer.info.autoReset=false
  return()=>{effects.disposed=true;effects.profiler?.dispose();renderer.info.autoReset=previous;effects.meshes.forEach((e,mesh)=>{e.source.removeEventListener('dispose',e.dispose);mesh.material=e.source;e.graph.material.dispose()});effects.velocity.dispose();effects.tails.dispose();effects.compute.dispose(renderer);effects.adaptMatter.dispose();effects.matter.dispose();effects.output.dispose();effects.final.dispose();effects.glow?.dispose();effects.depth.dispose();effects.color.dispose();effects.scratch.forEach(t=>t.dispose());effects.encoded.dispose()}
 },[effects,renderer])
 useEffect(()=>{
  if(new URLSearchParams(location.search).get('debug')!=='1')return
  const probeGPU=async()=>{
   const e=effects,slot=forest.tracers!.uniforms.historyIndex.value,count=32*16
   const head=new Float32Array(await renderer.getArrayBufferAsync(e.compute.histories,null,slot*8192*16,count) as ArrayBuffer),tail=new Float32Array(await renderer.getArrayBufferAsync(e.compute.histories,null,((slot+64-5)%64)*8192*16,count) as ArrayBuffer)
   let travel=0,valid=0,finite=true
   for(let i=0;i<head.length;i+=4){finite&&=Number.isFinite(head[i])&&Number.isFinite(head[i+1])&&Number.isFinite(head[i+2]);if(head[i+3]-tail[i+3]>.1&&head[i+3]-tail[i+3]<.5){travel+=Math.hypot(head[i]-tail[i],head[i+1]-tail[i+1],head[i+2]-tail[i+2]);valid++}}
   return {travel:travel/Math.max(1,valid),finite,valid}
  }
  Object.assign(forest.matterCamera,{probeGPU});return()=>{delete (forest.matterCamera as any).probeGPU}
 },[effects,forest,renderer])
 useFrame((_state,delta)=>{
  const e=effects;if(!e.compiled){if(!e.error)invalidate();return}
  renderer.info.reset();e.profiler?.begin();camera.updateMatrixWorld()
  const measured=<T,>(name:string,work:()=>T):T=>e.profiler?e.profiler.measure(name,work):work()
  const f=forest.filaments!,temporal=settings.temporal&&!matchMedia('(prefers-reduced-motion: reduce)').matches
  camera.getWorldDirection(e.direction)
  forest.streaming?.tick(camera.position,e.direction,performance.now())
  f.uniforms.activity.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;f.uniforms.baseVisibility.value=f.uniforms.activity.value>0?settings.baseFibers:1
  forest.tracers!.focus(camera.position,e.direction);forest.tracers!.mesh.visible=f.uniforms.activity.value>0&&forest.tracers!.stats.guides>0
  measured('simulation',()=>e.compute.update(renderer,forest.clock,settings.worldFlowSpeed,settings.worldMemory,settings.worldWave))
  measured('tailCull',()=>e.tails.update())
  for(const layer of forest.matterMeshes){
   layer.uniforms.bakedBloom.value=layer.material.userData.glowMode==='local'?settings.bloom/.38:0
   layer.uniforms.fiberFlowSpeed.value=settings.worldFlowSpeed
   layer.uniforms.fiberMemory.value=settings.worldMemory
   layer.uniforms.fiberWave.value=settings.worldWave
   layer.uniforms.activity.value=f!.uniforms.activity.value
   if(layer.uniforms.ground.value>0)layer.uniforms.baseVisibility.value=f!.uniforms.activity.value>0?Math.min(1,settings.baseFibers*4.4):1
  }
  const save=()=>{e.previousView.copy(camera.matrixWorldInverse);e.previousProjection.copy(camera.projectionMatrix);e.previousPosition.copy(camera.position);e.previousRotation.copy(camera.quaternion);e.pose={clock:f.uniforms.clock.value,dissolve:f.uniforms.dissolve.value,activity:f.uniforms.activity.value}}
  const cut=e.initialized&&cameraCut(camera.position.distanceTo(e.previousPosition),camera.quaternion.angleTo(e.previousRotation),delta,f.uniforms.clock.value-e.pose.clock)
  if(!e.initialized||cut||e.temporal!==temporal){e.matter.reset(!e.initialized?'initial':cut?'camera cut / resume':'mode change');save()}
  e.initialized=true;e.temporal=temporal;e.matter.settings={...settings,temporal};forest.matterCamera.mode=temporal?'TEMPORAL':'RAW'
  if(forest.dust){forest.dust.uniforms.previousView.value.copy(e.previousView);forest.dust.uniforms.previousProjection.value.copy(e.previousProjection);forest.dust.uniforms.previousClock.value=e.pose.clock;forest.dust.uniforms.particleStreak.value=temporal?settings.particleStreak:0}
  if(e.revision!==forest.matterRevision){e.refreshMaterials();e.velocity.syncSources(forestSources(forest));e.revision=forest.matterRevision}
  // Prepare preview uniforms before the single sync, including its later layer-2 draw.
  if(forest.preview){forest.preview.uniforms.gain.value=.16;forest.preview.uniforms.resolution.value.set(size.width,size.height)}
  measured('materials',()=>e.syncMaterials())
  const mask=camera.layers.mask,target=renderer.getRenderTarget(),background=scene.background,autoClear=renderer.autoClear
  try{
   camera.layers.set(1);scene.background=null;renderer.setRenderTarget(e.depth);renderer.clear();measured('depth',()=>renderer.render(scene,camera))
   camera.layers.mask=mask;scene.background=background
   if('near' in camera&&'far' in camera)f.uniforms.cameraRange.value.set(Number(camera.near),Number(camera.far))
   if(temporal){measured('velocity',()=>e.velocity.render(renderer,camera,e.previousView,e.previousProjection,e.pose));forest.matterCamera.velocityWork=e.velocity.stats}
   const u=e.matter.uniforms;u.velocity.value=e.velocity.target.texture;u.flow.value=e.velocity.flowTexture;u.body.value=e.depth.depthTexture;u.range.value.copy(f.uniforms.cameraRange.value);u.inverseVP.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).invert();u.previousVP.value.multiplyMatrices(e.previousProjection,e.previousView)
   renderer.setRenderTarget(e.color);measured('filaments',()=>renderer.render(scene,camera))
   measured('temporal',()=>e.matter.render(renderer as any,e.scratch[0] as any,e.color as any,delta))
   let read=e.scratch[0]
   if(forest.preview){camera.layers.set(2);scene.background=null;renderer.autoClear=false;renderer.setRenderTarget(read);measured('preview',()=>renderer.render(scene,camera));camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear}
   e.finalTexture.value=read.texture;if(e.glow)e.glow.strength.value=settings.bloom;renderer.setRenderTarget(e.encoded);measured('bloomOutput',()=>e.output.render())
   renderer.setRenderTarget(null);measured('AA',()=>e.final.render());save();e.profiler?.finish()
  }finally{camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;renderer.setRenderTarget(target)}
  if(!reportedReady.current){reportedReady.current=true;onReady()}
 },1)
 return null
}
