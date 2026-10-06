import {Vector3} from 'three'
import {createForestLayout,type ForestLayout,type P} from './forestLayout.ts'
import {mushroomFrame} from './implicitBody.ts'
import {heroRegion,type FilamentRegion} from './filaments/filamentField.ts'
import {forestFloor} from './forestNavigation.ts'
import {ForestFocus} from './forestFocus.ts'
import {ForestReveal} from './forestReveal.ts'
import {tracerGuides} from './filaments/WorldTimeTracers.ts'
import type {ForestPayload} from './forestBuild.ts'
import type {Forest,ForestPatch} from './forest.ts'

const LIMIT=4,STEP:P=[18,12,28]
export function streamRegion(base:FilamentRegion,cell:P):FilamentRegion {
 const offset=cell.map((v,k)=>v*STEP[k])
 return {min:base.min.map((v,k)=>v+offset[k]) as P,max:base.max.map((v,k)=>v+offset[k]) as P,center:base.center.map((v,k)=>v+offset[k]) as P}
}
export function completeMushroomRegion(region:FilamentRegion,layout:ForestLayout):FilamentRegion {
 const min=[...region.min] as P,max=[...region.max] as P
 // Select against the original cell so expansion cannot cascade through the forest.
 for(const m of layout.mushrooms){
  const frame=mushroomFrame(m),r=m.radius*1.12,pad=2.2
  const nearX=Math.max(region.min[0],Math.min(region.max[0],m.x)),nearZ=Math.max(region.min[2],Math.min(region.max[2],m.z))
  if(Math.hypot(nearX-m.x,nearZ-m.z)>m.radius*.46+4||frame.base>region.max[1]||frame.crown.y+m.radius*.3<region.min[1])continue
  const low:P=[Math.min(m.x,frame.crown.x)-r-pad,frame.base-Math.max(.4,m.radius*.3)-pad,Math.min(m.z,frame.crown.z)-r-pad]
  const high:P=[Math.max(m.x,frame.crown.x)+r+pad,frame.crown.y+Math.max(.4,m.radius*.3)+pad,Math.max(m.z,frame.crown.z)+r+pad]
  for(let k=0;k<3;k++){min[k]=Math.min(min[k],low[k]);max[k]=Math.max(max[k],high[k])}
 }
 return {min,max,center:min.map((v,k)=>(v+max[k])*.5) as P}
}
export function nearbyMushroomReach(layout:ForestLayout,p:Vector3):number {
 let reach=0
 for(const m of layout.mushrooms){
  const {base,crown}=mushroomFrame(m),distance=Math.hypot(p.x-m.x,p.z-m.z),near=m.radius*.46+8,far=near+10
  if(distance>=far||p.y<base-4||p.y>crown.y+m.radius+4)continue
  const t=Math.max(0,Math.min(1,(far-distance)/(far-near))),weight=t*t*(3-2*t)
  const extent=Math.hypot(distance+m.radius*1.25+Math.abs(crown.x-m.x)+Math.abs(crown.z-m.z),Math.max(Math.abs(p.y-base),Math.abs(p.y-crown.y))+m.radius*.3)
  reach=Math.max(reach,extent*weight)
 }
 return reach
}
const contains=(region:FilamentRegion,p:Vector3,margin=0)=>p.toArray().every((v,k)=>v>=region.min[k]+margin&&v<=region.max[k]-margin)
export function createStreamedForest(signal:AbortSignal,assemble:(payload:ForestPayload,worker:boolean)=>Forest):Promise<Forest>{
 const layout=createForestLayout(),base=heroRegion(layout)!,worker=new Worker(new URL('./forestWorker.ts',import.meta.url),{type:'module'})
 return new Promise((resolve,reject)=>{
  let forest:Forest|undefined,focus:ForestFocus|undefined,dead=false,busy:string|undefined='0,0,0',failedAt=0,nextId=0,lastSelect=-Infinity,selectedPosition=new Vector3(Infinity,Infinity,Infinity),selectedDirection=new Vector3(),forecast:Vector3[]|undefined,groundActive=false
  const reveal=new ForestReveal('0,0,0');let previousTick=NaN,speed=3.5,buildEstimate=5000,motionUntil=0
  const previousPosition=new Vector3(Infinity,Infinity,Infinity),motion=new Vector3(),delta=new Vector3()
  const patches=new Map<string,ForestPatch>(),guideIds=new Map<string,{data:Float32Array;ids:Int32Array;groundData?:Float32Array;groundIds?:Int32Array}>(),wanted=new Map<string,FilamentRegion>(),position=new Vector3(...layout.nodes[0]),direction=new Vector3(0,0,-1)
  const stats={loaded:0,visible:0,limit:LIMIT,pending:1,builds:0,evictions:0,errors:0,lastBuildMilliseconds:0,ready:true,groundActive:false,groundPaths:0,focus:undefined as ForestFocus['stats']|undefined,planned:0,lookAhead:48,presented:[] as {key:string;weight:number;target:number}[]}
  const dispose=()=>{if(dead)return;dead=true;worker.terminate();signal.removeEventListener('abort',abort);patches.clear();guideIds.clear();wanted.clear()}
  const abort=()=>{dispose();if(!forest)reject(new DOMException('Cancelled','AbortError'))}
  if(signal.aborted){abort();return}
  signal.addEventListener('abort',abort,{once:true})
  const rankedPatches=()=>[...patches.entries()].sort((a,b)=>{
   const priority=(patch:ForestPatch)=>contains(patch.region,position,1.6)?2:contains(patch.region,position)?1:0
   const score=(patch:ForestPatch)=>{const v=new Vector3(...patch.region.center).sub(position),depth=v.dot(direction);return v.lengthSq()+Math.max(0,-depth)*18}
   return priority(b[1])-priority(a[1])||score(a[1])-score(b[1])
  })
  const visiblePatches=()=>{const ranked=rankedPatches(),primary=ranked[0];if(!primary)return [];const attention=focus?.stats.hit?ranked.find(([key,patch])=>key!==primary[0]&&contains(patch.region,focus!.point,1.6)):undefined;const secondary=attention??ranked[1];return secondary?[primary,secondary]:[primary]}
  const presented=()=>[...reveal.regions.keys()].flatMap(key=>patches.has(key)?[[key,patches.get(key)!] as const]:[])
  function selectPresentation(){
   const desired=visiblePatches(),primary=desired.find(([,patch])=>contains(patch.region,position))?.[0]
   reveal.select(desired.map(([key])=>key),primary)
  }
  function updateReveal(dt:number){
   const before=[...reveal.regions.keys()].join(',');reveal.advance(dt)
   if(before!==[...reveal.regions.keys()].join(','))refresh()
   const regions=presented().map(([key,patch])=>{const weight=reveal.weight(key);patch.filaments.uniforms.streamWeight.value=weight;return {...patch.region,weight}})
   forest?.preview?.regions(regions)
   const u=forest?.tracers?.uniforms
   if(u){u.streamRegionCount.value=regions.length;regions.forEach((r,i)=>{u.streamRegionMin.value[i].set(...r.min);u.streamRegionMax.value[i].set(...r.max);u.streamRegionWeights.value[i]=r.weight})}
   stats.presented=[...reveal.regions].map(([key,state])=>({key,weight:reveal.weight(key),target:state.target}))
   if(reveal.settling)forest?.requestFrame?.()
  }
  function saveGuides(key:string,patch:ForestPatch){
   const guides=tracerGuides({region:patch.region,buffers:patch.buffers},patch.buffers.paths),ids=Int32Array.from({length:guides.count},(_,i)=>nextId+i);nextId+=guides.count
   const ground=patch.groundBuffers?.paths?tracerGuides({region:patch.region,buffers:patch.groundBuffers},patch.groundBuffers.paths):undefined
   const groundIds=ground?Int32Array.from({length:ground.count},(_,i)=>nextId+i):undefined;nextId+=ground?.count??0
   guideIds.set(key,{data:guides.data,ids,groundData:ground?.data,groundIds})
  }
  function refresh(){
   if(!forest)return
   const visible=presented()
   const selected=new Set(visible.map(([key])=>key));for(const [key,patch] of patches){patch.group.visible=selected.has(key)}
   forest.matterMeshes.splice(0,forest.matterMeshes.length,...visible.flatMap(([,p])=>[p.filaments,...(groundActive&&p.ground?[p.ground]:[])]));forest.matterRevision++;forest.requestFrame?.()
   for(const patch of patches.values())if(patch.ground)patch.ground.mesh.visible=groundActive
   const sources=visible.flatMap(([key])=>{const source=guideIds.get(key)!;return [source,...(groundActive&&source.groundIds?[{data:source.groundData!,ids:source.groundIds}]:[])]}),count=sources.reduce((n,s)=>n+s.ids.length,0),data=new Float32Array(count*256),ids=new Int32Array(count)
   let offset=0;for(const source of sources){data.set(source.data,offset*256);ids.set(source.ids,offset);offset+=source.ids.length}
   forest.tracers?.replaceGuides(data,ids);stats.loaded=patches.size;stats.visible=visible.length
   forest.vertices=visible.reduce((n,[,p])=>n+p.buffers.position.length/3,0);forest.filaments!.paths=visible.reduce((n,[,p])=>n+p.buffers.paths,0)
   stats.groundActive=groundActive;stats.groundPaths=groundActive?visible.reduce((n,[,p])=>n+(p.groundBuffers?.paths??0),0):0
   forest.setWalkingPatches([...patches.values()]);forest.reseedDust(visible.map(([,p])=>p.buffers))
   forest.preview?.regions(visible.map(([key,p])=>({...p.region,weight:reveal.weight(key)})))
  }
  function request(){
   if(dead||busy||performance.now()<failedAt)return
   const next=[...wanted].find(([key])=>!patches.has(key));if(!next){stats.pending=0;return}
   busy=next[0];stats.pending=1;worker.postMessage({...layout,streamRegion:next[1],requestId:next[0]})
  }
  function tick(p:Vector3,d:Vector3,now=performance.now(),manual?:number){
   if(dead||!forest)return
   const dt=Number.isFinite(previousTick)?Math.max(0,(now-previousTick)/1000):0;previousTick=now
   delta.copy(p).sub(previousPosition);previousPosition.copy(p)
   if(dt>0&&delta.lengthSq()<64){const actual=Math.min(7,delta.length()/dt);speed+=(actual-speed)*(1-Math.exp(-dt*3))}
   stats.lookAhead=Math.max(24,Math.min(56,Math.max(3.5,speed)*Math.max(7,buildEstimate/500)+12))
   if(delta.x*delta.x+delta.z*delta.z>1e-8&&delta.lengthSq()<64){motion.copy(delta).normalize();motionUntil=now+450}
   else if(delta.lengthSq()>=64){motion.set(d.x,0,d.z).normalize();motionUntil=now+450}
   position.copy(p);direction.copy(d);forest.filaments!.uniforms.streamFade.value=1
   const reach=nearbyMushroomReach(layout,p)
   forest.filaments!.uniforms.streamFocusDepth.value=reach*.5
   forest.filaments!.uniforms.streamFocusRange.value=reach*.5
   stats.ready=[...patches.values()].some(patch=>contains(patch.region,p))
   forest.filaments!.uniforms.walkFocus.value.copy(p)
   const onGround=Math.abs(p.y-forestFloor(p.x,p.z)-1.7)<(groundActive?3.2:.8)
   if(onGround!==groundActive){groundActive=onGround;refresh()}
   const changed=selectedPosition.distanceToSquared(p)>16||selectedDirection.dot(d)<Math.cos(.2)
   const attention=focus?.update(p,d,now,manual);if(!changed&&now-lastSelect<250){updateReveal(dt);request();return}lastSelect=now;selectedPosition.copy(p);selectedDirection.copy(d)
   const heading=motion.lengthSq()&&now<motionUntil?motion:new Vector3(d.x,0,d.z).normalize()
   const ahead=forecast??[8,16,stats.lookAhead,stats.lookAhead+16].map(distance=>p.clone().addScaledVector(heading,distance))
   const gaze=attention&&focus?.stats.hit?[attention]:[]
   const demand=stats.ready?[...ahead.slice(0,2),...gaze,...ahead.slice(2),p]:[p,...ahead.slice(0,2),...gaze,...ahead.slice(2)]
   // Retain the current body, then the nearest travel segments, gaze, and farther reserve.
   // Bound demand as well as the cache: five wanted cells in a four-cell cache
   // would endlessly rebuild the one that was just evicted while standing still.
   wanted.clear();const current=visiblePatches().find(([,patch])=>contains(patch.region,p,.5));if(current)wanted.set(current[0],current[1].region)
   for(const point of demand){
    if([...wanted.values()].some(region=>contains(region,point,1.6)))continue
    const prepared=[...patches].find(([,patch])=>contains(patch.region,point,1.6))
    const cell=point.toArray().map((v,k)=>Math.round((v-base.center[k])/STEP[k])) as P,key=prepared?.[0]??cell.join(',')
    if(wanted.size<LIMIT||wanted.has(key))wanted.set(key,prepared?.[1].region??completeMushroomRegion(streamRegion(base,cell),layout))
   }
   stats.planned=wanted.size
   const active=forest.matterMeshes.map(f=>f.mesh.uuid).join(',')
   selectPresentation()
   const nearest=presented().flatMap(([,patch])=>[patch.filaments,...(groundActive&&patch.ground?[patch.ground]:[])]).map(f=>f.mesh.uuid).join(',')
   if(active!==nearest)refresh()
   stats.ready=[...patches.values()].some(patch=>contains(patch.region,p));updateReveal(dt);request()
  }
  function complete(payload:ForestPayload,key:string){
   const patch=forest!.addStreamPatch(payload,key);patch.filaments.uniforms.streamWeight.value=0;patches.set(key,patch);saveGuides(key,patch)
   if(patches.size>LIMIT){const protectedKey=visiblePatches().find(([,p])=>contains(p.region,position,.5))?.[0]
    const candidates=[...patches].filter(([id])=>id!==key&&id!==protectedKey).sort((a,b)=>Number(wanted.has(a[0]))-Number(wanted.has(b[0]))||new Vector3(...b[1].region.center).distanceToSquared(position)-new Vector3(...a[1].region.center).distanceToSquared(position))
    const old=candidates[0]??[...patches].filter(([id])=>id!==key).sort((a,b)=>new Vector3(...b[1].region.center).distanceToSquared(position)-new Vector3(...a[1].region.center).distanceToSquared(position))[0];if(old){patches.delete(old[0]);guideIds.delete(old[0]);reveal.forget(old[0]);forest!.removeStreamPatch(old[1]);stats.evictions++}
   }
   selectPresentation();refresh();updateReveal(0);stats.builds++;stats.lastBuildMilliseconds=payload.milliseconds;buildEstimate=buildEstimate*.7+payload.milliseconds*.3
  }
  worker.onmessage=(event:MessageEvent<{payload?:ForestPayload;error?:string;requestId?:string}>)=>{
   if(dead)return
   const key=event.data.requestId??busy!;busy=undefined;stats.pending=0
   if(event.data.error||!event.data.payload){stats.errors++;failedAt=performance.now()+3000;if(!forest){dispose();reject(new Error(event.data.error??'Empty forest'));return}request();return}
   if(!forest){
    try{forest=assemble(event.data.payload,true);focus=typeof forest.volumeField==='function'?new ForestFocus(forest.volumeField):undefined;stats.focus=focus?.stats;const patch=forest.initialStreamPatch!;patches.set(key,patch);saveGuides(key,patch)
     forest.streaming={stats,tick,dispose,forecast:(points)=>{forecast=points},covers:(p)=>[...patches.values()].some(patch=>contains(patch.region,p,.5))};forest.attachStreamDisposer(dispose);stats.loaded=1;stats.visible=1;stats.builds=1;stats.lastBuildMilliseconds=event.data.payload.milliseconds;buildEstimate=event.data.payload.milliseconds;updateReveal(0);resolve(forest)
    }catch(error){dispose();reject(error)}
   }else{complete(event.data.payload,key);request()}
  }
  worker.onerror=event=>{if(!forest){dispose();reject(new Error(event.message||'Forest worker failed'))}else{stats.errors++;busy=undefined;failedAt=Infinity;stats.pending=0}}
  worker.postMessage({...layout,streamRegion:completeMushroomRegion(base,layout),requestId:'0,0,0'})
 })
}
export type ForestStreaming={stats:{loaded:number;visible:number;limit:number;pending:number;builds:number;evictions:number;errors:number;lastBuildMilliseconds:number;ready:boolean;groundActive:boolean;groundPaths:number;focus?:ForestFocus['stats'];planned:number;lookAhead:number;presented:{key:string;weight:number;target:number}[]};tick:(p:Vector3,d:Vector3,now?:number,manual?:number)=>void;forecast:(points:Vector3[]|undefined)=>void;covers:(p:Vector3)=>boolean;dispose:()=>void}
