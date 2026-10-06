import {Vector3} from 'three'
const SAMPLES=64,STRIDE=SAMPLES*4
// Stable GPU slots: an old guide may only be replaced after every particle that
// could have been born on it has exhausted its maximum three-second lifetime.
export class WorldGuideAtlas {
 source:Float32Array
 count:number
 sourceIds:Int32Array
 readonly selectionLimit:number
 readonly capacity:number
 readonly data:Float32Array
 readonly indices=new Float32Array(2048*4)
 readonly owners:Int32Array
 readonly lastUsed:Float64Array
 readonly slots=new Map<number,number>()
 selected:number[]=[]
 readonly center=new Vector3(Infinity,Infinity,Infinity)
 readonly view=new Vector3()
 pending=false
 retryAt=0
 previousClock=0
 constructor(source:Float32Array,count:number,capacity=4096,selectionLimit=2048){
  this.source=source;this.count=count;this.sourceIds=Int32Array.from({length:count},(_,i)=>i);this.selectionLimit=selectionLimit
  this.capacity=Math.min(capacity,count);this.data=new Float32Array(this.capacity*STRIDE);this.owners=new Int32Array(this.capacity).fill(-1);this.lastUsed=new Float64Array(this.capacity).fill(-Infinity)
 }
 replaceSource(source:Float32Array,ids:Int32Array){
  this.source=source;this.count=ids.length;this.sourceIds=ids;this.center.set(Infinity,Infinity,Infinity);this.pending=true;this.retryAt=0
 }
 tick(clock:number){
  if(clock<this.previousClock){this.lastUsed.fill(-Infinity);this.center.set(Infinity,Infinity,Infinity);this.retryAt=clock}
  for(const slot of this.selected)this.lastUsed[slot]=clock
  this.previousClock=clock
 }
 select(position:Vector3,clock:number,direction?:Vector3){
  this.tick(clock)
  const turned=direction!==undefined&&this.view.dot(direction)<Math.cos(.2)
  if(!turned&&this.center.distanceToSquared(position)<16&&(!this.pending||clock<this.retryAt))return undefined
  this.center.copy(position);if(direction)this.view.copy(direction)
  const nearest=Array.from({length:this.count},(_,id)=>{
   let distance=Infinity,visible=Infinity
   for(const col of [0,16,32,48,63]){const at=id*STRIDE+col*4,dx=this.source[at]-position.x,dy=this.source[at+1]-position.y,dz=this.source[at+2]-position.z;const squared=dx*dx+dy*dy+dz*dz;distance=Math.min(distance,squared);if(!direction||squared<16||(dx*direction.x+dy*direction.y+dz*direction.z)/Math.max(.01,Math.sqrt(squared))>.5)visible=Math.min(visible,squared)}
   return {row:id,id:this.sourceIds[id],distance,visible}
  }).sort((a,b)=>(a.visible-b.visible)||a.distance-b.distance)
  const candidates=nearest.filter(p=>p.visible<(direction?65*65:32*32)).slice(0,Math.min(this.selectionLimit,this.capacity))
  if(!candidates.length&&nearest.length)candidates.push(nearest[0])
  const wanted=new Set(candidates.map(p=>p.id)),free:number[]=[]
  for(let slot=0;slot<this.capacity;slot++)if(this.owners[slot]<0||(!wanted.has(this.owners[slot])&&clock-this.lastUsed[slot]>3.1))free.push(slot)
  let changed=false
  for(const {id,row} of candidates){
   if(this.slots.has(id))continue
   const slot=free.pop();if(slot===undefined)break
   this.slots.delete(this.owners[slot]);this.owners[slot]=id;this.slots.set(id,slot);this.data.set(this.source.subarray(row*STRIDE,(row+1)*STRIDE),slot*STRIDE);changed=true
  }
  const selected=candidates.flatMap(p=>{const slot=this.slots.get(p.id);return slot===undefined?[]:[slot]})
  this.pending=selected.length<candidates.length;this.retryAt=clock+.2
  if(selected.length)this.selected=selected
  this.selected.forEach((slot,i)=>{this.indices[i*4]=slot;this.lastUsed[slot]=clock})
  return {changed,count:this.selected.length}
 }
}
