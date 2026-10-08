import {forestGlowMode} from '../filaments/GlowProfile.ts'
import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {DataUtils,Matrix4,Quaternion,Vector2,Vector3,WebGLRenderTarget,DepthTexture,DepthFormat,UnsignedIntType,NearestFilter} from 'three'
import type {Forest} from '../forest'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js'
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js'
import {MatterCameraPass} from '../filaments/camera/MatterCameraPass'
import {MatterVelocity,type MatterSource} from '../filaments/camera/matterVelocity'
import {cameraCut,defaultMatterCamera,type MatterCameraSettings} from '../filaments/camera/matterCameraSettings'

export function forestSources(forest:Forest){
 const sp=forest.fragments,dust=forest.dust,sources:MatterSource[]=[]
  for(const f of forest.matterMeshes)sources.push({mesh:f.mesh,material:f.material,restPoint:'position',direction:'flow',previousPoint:'matterPosition(position,normalize(flow+vec3(.000001)))',centerClip:'mcCurrentClip=mcProjection*v;mcDepth=-v.z;'})
  if(sp)sources.push({mesh:sp.mesh,material:sp.material,restPoint:'anchor',direction:'direction',previousPoint:'matterPosition(anchor,normalize(direction+vec3(.000001)))+matterCurl(anchor*.51+clock*.09)*unravel(anchor)*unravel(anchor)*.35',centerClip:'mcCurrentClip=ca;mcDepth=-va.z;'})
  if(dust)sources.push({flow:false,mesh:dust.mesh,material:dust.material,restPoint:'anchor',direction:'direction',previousPoint:'dustPosition(anchor,direction,seed)',centerClip:'mcCurrentClip=ca;mcDepth=-va.z;'})
  const time=forest.tracers
  if(time)sources.push({mesh:time.mesh,material:time.material,restPoint:'trailPosition(position.x,historyIndex,historyTexture)',direction:'trailDirection(position.x)',previousPoint:'trailPosition(position.x,previousHistoryIndex,previousHistoryTexture)',centerClip:'mcCurrentClip=ca;mcDepth=-va.z;'})
 return sources
}

export function ForestGlow({forest,settings=defaultMatterCamera,previewBrightness=1,onReady}:{forest:Forest;settings?:MatterCameraSettings;previewBrightness?:number;onReady:()=>void}) {
 const {gl,scene,camera,size,invalidate}=useThree()
 const reportedReady=useRef(false)
 // Controls remain live in the paused demand loop as well as during movement.
 useEffect(()=>{invalidate()},[settings,previewBrightness,invalidate])
 const effects=useMemo(()=>{
  const composer=new EffectComposer(gl),render=new RenderPass(scene,camera)
  const bloom=new UnrealBloomPass(new Vector2(1,1),forest.filaments ? .22 : .68,forest.filaments ? .25 : .45,forest.filaments ? 1.05 : .82),output=new OutputPass(),aa=new ShaderPass(FXAAShader)
  const f=forest.filaments,sources=forestSources(forest)
  const matter=f?new MatterCameraPass(forest.matterCamera):undefined,velocity=f?new MatterVelocity(sources):undefined
  composer.setPixelRatio(1);composer.addPass(render);if(matter)composer.addPass(matter);if(forestGlowMode()!=='local')composer.addPass(bloom);composer.addPass(output);composer.addPass(aa)
  Object.assign(forest.matterCamera,{renderBudget:{bloomMode:forestGlowMode()==='local'?'local-profile':'screen'}})
  return {composer,render,bloom,output,aa,matter,velocity,previousView:new Matrix4(),previousProjection:new Matrix4(),focusDirection:new Vector3(),previousPosition:new Vector3(),previousRotation:new Quaternion(),pose:{clock:0,dissolve:0,activity:1},revision:forest.matterRevision,initialized:false,temporal:false}
 },[gl,scene,camera,forest])
 const depth=useMemo(()=>{
  if(!forest.filaments)return undefined
  const target=new WebGLRenderTarget(1,1,{minFilter:NearestFilter,magFilter:NearestFilter});target.depthTexture=new DepthTexture(1,1,UnsignedIntType);target.depthTexture.format=DepthFormat;forest.filaments.uniforms.bodyDepth.value=target.depthTexture;return target
 },[forest])
 useEffect(()=>{forest.requestFrame=invalidate;return()=>{forest.requestFrame=undefined}},[forest,invalidate])
 useEffect(()=>()=>{depth?.dispose()},[depth])
 useEffect(()=>{depth?.setSize(size.width,size.height);effects.composer.setSize(size.width,size.height);effects.velocity?.setSize(size.width,size.height);forest.uniforms.resolution.value.set(size.width,size.height);effects.aa.uniforms.resolution.value.set(1/size.width,1/size.height);invalidate()},[depth,effects,forest,size.width,size.height,invalidate])
 useEffect(()=>{const previous=gl.info.autoReset;gl.info.autoReset=false;return()=>{gl.info.autoReset=previous;effects.render.dispose();effects.bloom.dispose();effects.output.dispose();effects.aa.dispose();effects.matter?.dispose();effects.velocity?.dispose();effects.composer.dispose()}},[effects,gl])
 useEffect(()=>{
  if(!effects.matter||!effects.velocity||new URLSearchParams(location.search).get('debug')!=='1')return
  const matter=effects.matter,velocity=effects.velocity

  let previousFlowPixels:Uint16Array|undefined
  forest.matterCamera.probe=()=>{
   const target=velocity.target,data=new Uint16Array(target.width*target.height*4);gl.readRenderTargetPixels(target,0,0,target.width,target.height,data)
   let maxVelocity=0,litPixels=0
   for(let i=0;i<data.length;i+=4){if(DataUtils.fromHalfFloat(data[i+2])>.05){litPixels++;maxVelocity=Math.max(maxVelocity,Math.hypot(DataUtils.fromHalfFloat(data[i]),DataUtils.fromHalfFloat(data[i+1])))}}
   const history=matter.histories[matter.index],pixels=new Uint16Array(history.width*history.height*4);gl.readRenderTargetPixels(history,0,0,history.width,history.height,pixels)
   let historyEnergy=0,unattachedHistoryPixels=0;for(let i=0;i<pixels.length;i+=4){historyEnergy+=DataUtils.fromHalfFloat(pixels[i]);}
   const flowImage=matter.flowTarget,flowColors=new Uint16Array(flowImage.width*flowImage.height*4);gl.readRenderTargetPixels(flowImage,0,0,flowImage.width,flowImage.height,flowColors);let flowEnergy=0,flowImageChange=0;for(let i=0;i<flowColors.length;i+=4){flowEnergy+=DataUtils.fromHalfFloat(flowColors[i]);if(previousFlowPixels?.length===flowColors.length)flowImageChange+=Math.abs(DataUtils.fromHalfFloat(flowColors[i])-DataUtils.fromHalfFloat(previousFlowPixels[i]));if(DataUtils.fromHalfFloat(pixels[i+3])<.001&&DataUtils.fromHalfFloat(pixels[i])>DataUtils.fromHalfFloat(flowColors[i])+.05)unattachedHistoryPixels++}previousFlowPixels=flowColors;flowImageChange/=flowColors.length/4;const flow=velocity.target,field=new Uint16Array(flow.width*flow.height*4);gl.readRenderTargetPixels(flow,0,0,flow.width,flow.height,field,undefined,1);let flowPixels=0,sumX=0,sumY=0;for(let i=0;i<field.length;i+=4){if(DataUtils.fromHalfFloat(field[i+2])>.05){flowPixels++;sumX+=DataUtils.fromHalfFloat(field[i]);sumY+=DataUtils.fromHalfFloat(field[i+1])}}let worldTrailTravel=0;const tracers=forest.tracers;if(tracers){const target=tracers.currentHistory(),index=tracers.uniforms.historyIndex.value,rows=tracers.stats.particles/256,head=new Float32Array(128),tail=new Float32Array(128);gl.readRenderTargetPixels(target,0,index*rows,32,1,head);gl.readRenderTargetPixels(target,0,((index+64-5)%64)*rows,32,1,tail);let valid=0;for(let i=0;i<head.length;i+=4){if(head[i+3]>=tail[i+3]&&head[i+3]-tail[i+3]>.1){worldTrailTravel+=Math.hypot(head[i]-tail[i],head[i+1]-tail[i+1],head[i+2]-tail[i+2]);valid++}}worldTrailTravel/=Math.max(1,valid)}return {worldTrailTravel,flowImageChange,maxVelocity,litPixels,historyEnergy,flowEnergy,unattachedHistoryPixels,flowPixels,flowDirectionSpread:1-Math.hypot(sumX,sumY)/Math.max(1,flowPixels)}
  }
  forest.matterCamera.compareVelocity=()=>{
   const buffer=velocity.target,read=()=>[0,1].map(attachment=>{const data=new Uint16Array(buffer.width*buffer.height*4);gl.readRenderTargetPixels(buffer,0,0,buffer.width,buffer.height,data,undefined,attachment);return data})
   velocity.render(gl,camera,effects.previousView,effects.previousProjection,effects.pose,true);const combined={...velocity.stats},first=read()
   velocity.render(gl,camera,effects.previousView,effects.previousProjection,effects.pose,false);const reference={...velocity.stats},second=read()
   let differentValues=0;for(let attachment=0;attachment<2;attachment++)for(let i=0;i<first[attachment].length;i++)if(first[attachment][i]!==second[attachment][i])differentValues++
   return {differentValues,combined,reference}
  }
  return()=>{delete forest.matterCamera.probe;delete forest.matterCamera.compareVelocity}
 },[effects,forest,gl])
 useFrame((_state,delta)=>{
  gl.info.reset();camera.updateMatrixWorld()
  const f=forest.filaments,m=effects.matter,temporal=settings.temporal&&!matchMedia('(prefers-reduced-motion: reduce)').matches
  const save=()=>{effects.previousView.copy(camera.matrixWorldInverse);effects.previousProjection.copy(camera.projectionMatrix);effects.previousPosition.copy(camera.position);effects.previousRotation.copy(camera.quaternion);if(f)effects.pose={clock:f.uniforms.clock.value,dissolve:f.uniforms.dissolve.value,activity:f.uniforms.activity.value}}
  const now=performance.now()
  camera.getWorldDirection(effects.focusDirection)
  forest.streaming?.tick(camera.position,effects.focusDirection,now)
  if(effects.revision!==forest.matterRevision){effects.velocity?.syncSources(forestSources(forest));effects.revision=forest.matterRevision}
  if(f&&forest.tracers){f.uniforms.activity.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1;forest.tracers.focus(camera.position,camera.getWorldDirection(effects.focusDirection));forest.tracers.mesh.visible=f.uniforms.activity.value>0&&forest.tracers.stats.guides>0;f.uniforms.baseVisibility.value=f.uniforms.activity.value>0?settings.baseFibers:1;forest.tracers.update(gl,forest.clock,settings.worldFlowSpeed,settings.worldMemory,settings.worldWave)}
  for(const layer of forest.matterMeshes){
   layer.uniforms.bakedBloom.value=layer.material.userData.glowMode==='local'?settings.bloom/.38:0
   layer.uniforms.fiberFlowSpeed.value=settings.worldFlowSpeed
   layer.uniforms.fiberMemory.value=settings.worldMemory
   layer.uniforms.fiberWave.value=settings.worldWave
   layer.uniforms.activity.value=f!.uniforms.activity.value
   if(layer.uniforms.ground.value>0)layer.uniforms.baseVisibility.value=f!.uniforms.activity.value>0?Math.min(1,settings.baseFibers*4.4):1
  }
  if(m&&f){
   const cut=effects.initialized&&cameraCut(camera.position.distanceTo(effects.previousPosition),camera.quaternion.angleTo(effects.previousRotation),delta,f.uniforms.clock.value-effects.pose.clock)
   if(!effects.initialized||cut||temporal!==effects.temporal||m.dirty){if(!m.dirty||!effects.initialized||cut||temporal!==effects.temporal)m.reset(!effects.initialized?'initial':cut?'camera cut / resume':'mode change');save()}
   effects.initialized=true;effects.temporal=temporal;m.settings={...settings,temporal};forest.matterCamera.mode=temporal?'TEMPORAL':'RAW';effects.bloom.strength=settings.bloom
   if(forest.dust){forest.dust.uniforms.previousView.value.copy(effects.previousView);forest.dust.uniforms.previousProjection.value.copy(effects.previousProjection);forest.dust.uniforms.previousClock.value=effects.pose.clock;forest.dust.uniforms.particleStreak.value=temporal?settings.particleStreak:0}
  }
  if(depth&&f){const mask=camera.layers.mask,target=gl.getRenderTarget(),background=scene.background
   try{camera.layers.set(1);scene.background=null;gl.setRenderTarget(depth);gl.clear();gl.render(scene,camera)}finally{camera.layers.mask=mask;scene.background=background;gl.setRenderTarget(target)}
   if('near' in camera&&'far' in camera)f.uniforms.cameraRange.value.set(Number(camera.near),Number(camera.far))
   if(m&&effects.velocity&&temporal){effects.velocity.render(gl,camera,effects.previousView,effects.previousProjection,effects.pose);forest.matterCamera.velocityWork=effects.velocity.stats;m.uniforms.velocity.value=effects.velocity.target.texture;m.uniforms.flow.value=effects.velocity.flowTexture;m.uniforms.body.value=depth.depthTexture;m.uniforms.range.value.copy(f.uniforms.cameraRange.value);m.uniforms.inverseVP.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).invert();m.uniforms.previousVP.value.multiplyMatrices(effects.previousProjection,effects.previousView)}
  }
  effects.composer.render(delta)
  if(forest.preview){forest.preview.uniforms.gain.value=previewBrightness;const mask=camera.layers.mask,background=scene.background,autoClear=gl.autoClear
   try{gl.getDrawingBufferSize(forest.preview.uniforms.resolution.value);camera.layers.set(2);scene.background=null;gl.autoClear=false;gl.render(scene,camera)}
   finally{camera.layers.mask=mask;scene.background=background;gl.autoClear=autoClear}
  }
  save()
  if(!reportedReady.current){reportedReady.current=true;onReady()}
 },1)
 return null
}
