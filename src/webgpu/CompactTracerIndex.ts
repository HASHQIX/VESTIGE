import {BufferGeometry,StorageBufferAttribute,IndirectStorageBufferAttribute,type WebGPURenderer} from 'three/webgpu'
import {Fn,If,Loop,instanceIndex,localId,workgroupId,workgroupArray,workgroupBarrier,storage,uniform,float,uint,vec3,min,max,fract,sin,pow,vertexIndex} from 'three/tsl'
import type {Forest} from '../forest'

const COUNT=8192,SLOTS=64,BLOCK=256,GROUPS=COUNT/BLOCK
const INDEX_ATTRIBUTE=2 // AttributeType.INDEX in pinned Three r186.

/** Retain every segment touching a potentially visible endpoint. History times
 * are ordered newest-first; only the suffix expired by memory is omitted.
 * Birth, depth and distance rejection remain in the original vertex graph.
 * Prefix sums preserve the original particle/triangle blending order. */
export function compactTracerIndex(renderer:WebGPURenderer,source:NonNullable<Forest['tracers']>,histories:StorageBufferAttribute){
 const original=source.mesh.geometry,geometry=new BufferGeometry()
 const index=new StorageBufferAttribute(new Uint32Array(COUNT*(SLOTS-1)*6),1),indirect=new IndirectStorageBufferAttribute(new Uint32Array([0,1,0,0,0]),1)
 const offsets=new StorageBufferAttribute(new Uint32Array(COUNT*2),2),groups=new StorageBufferAttribute(new Uint32Array(GROUPS*2),2)
 const history=storage(histories,'vec4',COUNT*SLOTS).toReadOnly(),indices=storage(index,'uint',index.count),draw=storage(indirect,'uint',5),ranges=storage(offsets,'uvec2',COUNT),blocks=storage(groups,'uvec2',GROUPS)
 // r186 typings omit WorkgroupInfoNode.element; the runtime exposes it.
 const clock=uniform(0),memory=uniform(1.5),slot=uniform(0,'uint'),scan=workgroupArray('uint',BLOCK) as any
 const hash=Fn(([id]:[any])=>fract(sin(id.mul(12.9898).add(78.233)).mul(43758.5453)))
 const countAndScan=Fn(()=>{
  const id=instanceIndex,p=float(id),limit=max(.05,min(pow(hash(p.add(19)),1.4).mul(2.8).add(.2),memory.mul(hash(p.add(11)).mul(1.5).add(.3)))).add(.002).toVar()
  const lo=uint(0).toVar(),hi=uint(SLOTS).toVar()
  // Upper bound of the still-live vertices. The extra 2ms is conservative at
  // float rounding boundaries and does not change the fragment fade threshold.
  Loop(7,()=>{If(lo.lessThan(hi),()=>{
   const mid=lo.add(hi).div(2).toVar(),historySlot=slot.add(SLOTS).sub(mid).mod(SLOTS)
   If(clock.sub(history.element(historySlot.mul(COUNT).add(id)).w).lessThan(limit),()=>{lo.assign(mid.add(1))}).Else(()=>{hi.assign(mid)})
  })})
  const count=lo.lessThan(SLOTS-1).select(lo,uint(SLOTS-1)).toVar(),lane=localId.x
  scan.element(lane).assign(count);workgroupBarrier()
  for(let step=1;step<BLOCK;step*=2){
   const addend=uint(0).toVar();If(lane.greaterThanEqual(step),()=>{addend.assign(scan.element(lane.sub(step)))})
   workgroupBarrier();scan.element(lane).addAssign(addend);workgroupBarrier()
  }
  ranges.element(id).x.assign(count);ranges.element(id).y.assign(scan.element(lane).sub(count))
  If(lane.equal(BLOCK-1),()=>{blocks.element(workgroupId.x).x.assign(scan.element(lane))})
 })().compute(COUNT,[BLOCK])
 const scanGroups=Fn(()=>{
  const sum=uint(0).toVar()
  Loop(GROUPS,({i})=>{blocks.element(i).y.assign(sum);sum.addAssign(blocks.element(i).x)})
  draw.element(0).assign(sum.mul(6))
 })().compute(1)
 const scatter=Fn(()=>{
  const id=instanceIndex,range=ranges.element(id).toVar(),start=blocks.element(id.div(BLOCK)).y.add(range.y).mul(6).toVar()
  Loop({start:uint(0),end:range.x,type:'uint'},({i})=>{
   const vertex=id.mul(SLOTS*2).add(i.mul(2)).toVar(),at=start.add(i.mul(6)).toVar()
   indices.element(at).assign(vertex);indices.element(at.add(1)).assign(vertex.add(2));indices.element(at.add(2)).assign(vertex.add(1))
   indices.element(at.add(3)).assign(vertex.add(2));indices.element(at.add(4)).assign(vertex.add(3));indices.element(at.add(5)).assign(vertex.add(1))
  })
 })().compute(COUNT)
 // Create as INDEX first: a buffer first allocated as ordinary STORAGE would
 // lack INDEX usage in pinned r186. No frame-by-frame CPU readback/upload.
 ;(renderer as any)._attributes.update(index,INDEX_ATTRIBUTE)
 geometry.setAttribute('position',original.getAttribute('position'));geometry.setIndex(index);geometry.setIndirect(indirect)
 // The source is typed for its WebGL instanced layout. Native graphs instead
 // reconstruct the same inputs from the global indexed vertex ID.
 source.mesh.geometry=geometry as typeof original
 const local=vertexIndex.mod(SLOTS*2)
 const overrides={particleId:float(vertexIndex.div(SLOTS*2)),position:vec3(float(local.div(2)),float(local.mod(2)).mul(2).sub(1),0)}
 const passes=[countAndScan,scanGroups,scatter]
 const update=()=>{
  clock.value=source.uniforms.clock.value;memory.value=source.uniforms.trailMemory.value;slot.value=source.uniforms.historyIndex.value
  renderer.compute(passes)
 }
 const dispose=()=>{
  if(source.mesh.geometry===geometry)source.mesh.geometry=original
  geometry.deleteAttribute('position');geometry.dispose();passes.forEach(p=>p.dispose())
  for(const attribute of [index,indirect,offsets,groups])(renderer as any)._attributes.delete(attribute)
  for(const n of [history,indices,draw,ranges,blocks])n.dispose()
 }
 return {geometry,original,index,indirect,offsets,groups,overrides,passes,update,dispose}
}
