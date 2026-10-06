import {StorageBufferAttribute,Vector3,type WebGPURenderer} from 'three/webgpu'
import {Fn,If,Loop,instanceIndex,storage,texture,uniform,uniformArray,float,uint,vec3,vec4,fract,sin,cos,pow,mod,mix,floor,min,max,clamp,normalize,length,smoothstep,exp} from 'three/tsl'
import type {Forest} from '../forest'
const COUNT=8192,SLOTS=64
// One invocation owns one particle and its 64 history locations. Ordinary
// records touch only one slot, instead of copying the entire history texture.
export function computeTracers(source:NonNullable<Forest['tracers']>){
 const states=new StorageBufferAttribute(COUNT,4),ids=new StorageBufferAttribute(COUNT,1),histories=new StorageBufferAttribute(COUNT*SLOTS,4),shadow=new StorageBufferAttribute(COUNT,4)
 const state=storage(states,'vec4',COUNT),guideIds=storage(ids,'float',COUNT),history=storage(histories,'vec4',COUNT*SLOTS),previousSlot=storage(shadow,'vec4',COUNT)
 const pulses=uniformArray<'vec4'>(source.uniforms.footPulses.value,'vec4')
 const footWave=Fn(([p]:[any])=>{const energy=float(0).toVar();Loop(4,({i})=>{const pulse=pulses.element(i),age=clock.sub(pulse.w),delta=p.sub(pulse.xyz);If(age.greaterThanEqual(0).and(age.lessThan(2.4)).and(delta.y.abs().lessThan(1.6)).and(delta.xz.dot(delta.xz).lessThan(64)),()=>{const band=length(delta.xz).sub(age.mul(3.2)).div(.65);energy.addAssign(exp(band.mul(band).negate().sub(delta.y.mul(delta.y).mul(2)).sub(age.mul(1.25))))})});return min(1,energy)})
 const guides=texture(source.guides),nearby=texture(source.nearbyGuides)
 const clock=uniform(0),dt=uniform(0),initialize=uniform(true),record=uniform(true),writeSlot=uniform(0,'uint'),flowSpeed=uniform(1),waveStrength=uniform(.75),dissolve=uniform(0),center=uniform(new Vector3()),guideCount=uniform(source.simUniforms.guideCount.value),nearbyCount=uniform(1),focused=source.simUniforms.focused.value>0
 const hash=Fn(([p]:[any])=>fract(sin(p.mul(12.9898).add(78.233)).mul(43758.5453)))
 const life=Fn(([id]:[any])=>pow(hash(id.add(19)),1.4).mul(2.8).add(.2))
 const age=Fn(([id]:[any])=>mod(clock.add(hash(id.add(7)).mul(life(id))),life(id)))
 const curl=Fn(([p]:[any])=>vec3(cos(p.x.add(p.y.mul(.8)).add(1.3)).mul(.8).sub(cos(p.z.add(p.x.mul(.6)).add(.4))),cos(p.y.add(p.z.mul(.7)).add(2.1)).mul(.7).sub(cos(p.x.add(p.y.mul(.8)).add(1.3))),cos(p.z.add(p.x.mul(.6)).add(.4)).mul(.6).sub(cos(p.y.add(p.z.mul(.7)).add(2.1)))))
 const wave=Fn(([p]:[any])=>{
  const phase=fract(clock.mul(.065).sub(p.y.sub(center.y).mul(.045).add(p.z.sub(center.z).mul(.012)).add(p.x.sub(center.x).mul(.008))).add(.5))
  return exp(pow(phase.sub(.5).mul(13),2).negate()).mul(waveStrength)
 })
 const guide=Fn(([id,progress]:[any,any])=>{
  const row=mod(id,guideCount),x=clamp(progress,0,1).mul(63),a=floor(x),b=min(63,a.add(1))
  return mix(guides.sample(vec3(a.add(.5).div(64),row.add(.5).div(guideCount),0).xy).level(float(0)),guides.sample(vec3(b.add(.5).div(64),row.add(.5).div(guideCount),0).xy).level(float(0)),fract(x))
 })
 const simulation=Fn(()=>{
  const id=float(instanceIndex),old=state.element(instanceIndex).toVar(),guideId=guideIds.element(instanceIndex).toVar(),progress=old.w.toVar()
  if(!focused)guideId.assign(id)
  const g=guide(guideId,progress).toVar(),speed=hash(id.add(11)).mul(1.45).add(.35).mul(flowSpeed).mul(wave(g.xyz).mul(2).add(footWave(g.xyz).mul(.8)).add(1)).toVar()
  const step=speed.mul(dt).div(max(g.w,.1)),next=progress.add(step)
  const born=initialize.or(age(id).lessThan(dt)).or(next.greaterThan(.98))
  If(born,()=>{
   if(focused){const choice=floor(hash(id.add(floor(clock.div(life(id))).mul(13))).mul(nearbyCount));guideId.assign(nearby.sample(vec3(choice.add(.5).div(2048),.5,0).xy).level(float(0)).r)}
   progress.assign(hash(id.add(3)).mul(.82).add(.05));g.assign(guide(guideId,progress))
   state.element(instanceIndex).assign(vec4(g.xyz.add(curl(g.xyz.mul(.37).add(vec3(hash(id).mul(21)))).mul(.04)),progress))
  }).Else(()=>{
   const tangent=normalize(guide(guideId,progress.add(step.mul(.5)).add(.001)).xyz.sub(guide(guideId,progress.add(step.mul(.5)).sub(.001)).xyz).add(vec3(.000001))),target=guide(guideId,next).xyz
   const detached=dissolve.mul(float(1).sub(smoothstep(3,9,length(old.xyz.sub(center))))),localCurl=curl(old.xyz.mul(.32).add(vec3(clock.mul(.12).add(hash(id).mul(4)))))
   const velocity=tangent.mul(speed).add(localCurl.mul(wave(old.xyz).mul(.22).add(.10).add(detached.mul(1.6))).mul(flowSpeed)).add(g.xyz.sub(old.xyz).mul(6).mul(float(1).sub(detached)))
   const predicted=old.xyz.add(velocity.mul(dt)),offset=predicted.sub(target),limit=wave(target).mul(.55).add(.25).add(detached.mul(3))
   state.element(instanceIndex).assign(vec4(target.add(offset.mul(min(1,limit.div(max(.0001,length(offset)))))),next))
  })
  guideIds.element(instanceIndex).assign(guideId)
  If(record,()=>{
   const index=writeSlot.mul(COUNT).add(instanceIndex),point=vec4(state.element(instanceIndex).xyz,clock)
   previousSlot.element(instanceIndex).assign(history.element(index))
   If(initialize,()=>{Loop(SLOTS,({i})=>{history.element(uint(i).mul(COUNT).add(instanceIndex)).assign(point)})}).Else(()=>{history.element(index).assign(point)})
  })
 })().compute(COUNT)
 let initialized=false,slot=0,previousClock=0,recordClock=0,recorded=false
 const recordChanged=uniform(false),currentSlot=uniform(0,'uint')
 const historyRead=storage(histories,'vec4',COUNT*SLOTS).toReadOnly(),shadowRead=storage(shadow,'vec4',COUNT).toReadOnly()
 const sample=(p:any,previous=false)=>{
  const index=uint(floor(p.y.mul(SLOTS*32))).mul(256).add(uint(floor(p.x.mul(256))))
  const value=historyRead.element(index)
  // Keep the overwritten slot for exact previous-frame lookup during recording.
  return previous?recordChanged.and(index.div(COUNT).equal(currentSlot)).select(shadowRead.element(index.mod(COUNT)),value):value
 }
 function step(renderer:WebGPURenderer,time:number,speed:number,memory:number,waveAmount:number){
  source.uniforms.previousHistoryIndex.value=slot;recorded=false
  const delta=maxDelta(time-previousClock);if(initialized&&delta===0){recordChanged.value=false;return}
  clock.value=time;dt.value=delta;initialize.value=!initialized;flowSpeed.value=speed;waveStrength.value=waveAmount;dissolve.value=source.uniforms.dissolve.value;center.value.copy(source.uniforms.dissolveCenter.value);nearbyCount.value=source.simUniforms.nearbyCount.value
  recorded=!initialized||time-recordClock>=.049
  record.value=recorded;if(recorded&&initialized)slot=(slot+1)%SLOTS;writeSlot.value=slot
  renderer.compute(simulation);source.stats.updates++
  if(recorded){source.stats.records++;source.uniforms.historyIndex.value=slot;recordClock=time}
  currentSlot.value=slot;recordChanged.value=recorded&&initialized
  source.uniforms.trailMemory.value=memory;source.uniforms.waveStrength.value=waveAmount
  initialized=true;previousClock=time;source.stats.clock=time
 }
 function update(renderer:WebGPURenderer,time:number,speed:number,memory:number,waveAmount:number){
  if((!initialized||time<previousClock)&&source.uniforms.activity.value>0){
   initialized=false;slot=0;previousClock=time-1.5;recordClock=previousClock
   for(let i=0;i<=30;i++)step(renderer,time-1.5+i*.05,speed,memory,waveAmount)
   source.uniforms.previousHistoryIndex.value=slot;recordChanged.value=false
  }else step(renderer,time,speed,memory,waveAmount)
 }
 const overrides={historyTexture:{sample:(p:any)=>sample(p)},previousHistoryTexture:{sample:(p:any)=>sample(p,true)}}
 return {simulation,update,overrides,states,histories,shadow,stats:{backend:'webgpu-compute',historySlots:SLOTS,recordWrites:COUNT},dispose:(renderer:WebGPURenderer)=>{simulation.dispose();
 // r186 has no BufferAttribute.dispose(). Release these independently owned
 // compute buffers through the renderer's attribute manager and its accounting.
 for(const attribute of [states,ids,histories,shadow])(renderer as any)._attributes.delete(attribute);
 for(const n of [state,guideIds,history,previousSlot,historyRead,shadowRead])n.dispose()}}
}
function maxDelta(value:number){return Math.max(0,Math.min(.05,value))}
