import type {WebGPURenderer} from 'three/webgpu'

type Metric={samples:number;mean:number;max:number}
const metric=():Metric=>({samples:0,mean:0,max:0})
function record(m:Metric,value:number){if(!Number.isFinite(value)||value<0)return;m.samples++;m.mean+=(value-m.mean)/m.samples;m.max=Math.max(m.max,value)}

// Opt-in diagnostics: CPU timings measure command submission, not GPU execution.
// Native timestamp queries measure aggregate render/compute work asynchronously.
// No timestamps or readbacks are enabled during an ordinary visit.
export class ForestProfiler {
 readonly stats={enabled:true,cpuSubmission: {} as Record<string,Metric>,gpuStages:{} as Record<string,Metric>,gpuRender:metric(),gpuCompute:metric(),gpuSupported:false,droppedAttributionBatches:0,frames:0,samples:0,drawCalls:metric(),triangles:metric(),errors:0}
 private pending=false
 private disposed=false
 private stages=new Map<string,string>()
 private renderer:WebGPURenderer
 constructor(renderer:WebGPURenderer){this.renderer=renderer;this.stats.gpuSupported=Boolean((renderer.backend as any).trackTimestamp)}
 begin(){this.stats.frames++;if(this.stages.size>2048){this.stages.clear();this.stats.droppedAttributionBatches++}}
 measure<T>(name:string,work:()=>T):T{
  const started=performance.now(),info=this.renderer.info,start=info.render.frameCalls,frame=info.frame
  try{return work()}finally{
   if(this.stats.frames>90)record(this.stats.cpuSubmission[name]??=metric(),performance.now()-started)
   if(this.stats.gpuSupported&&this.stats.frames>90){for(let i=start+1;i<=info.render.frameCalls;i++)this.stages.set(`${i}:f${frame}`,name)}
  }
 }
 finish(){
  const s=this.stats,r=this.renderer
  if(s.frames>90){s.samples++;record(s.drawCalls,r.info.render.drawCalls);record(s.triangles,r.info.render.triangles)}
  if(!s.gpuSupported||this.pending||s.frames%12!==0)return
  this.pending=true
  const stages=this.stages,collecting=s.frames>90;this.stages=new Map()
  Promise.all([r.resolveTimestampsAsync('render'),r.resolveTimestampsAsync('compute')]).then(([render,compute])=>{
   if(this.disposed||!collecting)return
   if(render!==undefined)record(s.gpuRender,render);if(compute!==undefined)record(s.gpuCompute,compute)
   // Read-only, pinned r186 diagnostic boundary: public resolution supplies the
   // durations; its query pool retains per-pass IDs. Never used to drive quality.
   const timings=(r.backend as any).timestampQueryPool?.render?.timestamps
   if(timings instanceof Map){const groups=new Map<string,{name:string;total:number}>()
    for(const [uid,value] of timings){const match=/^r:(\d+):.*:f(\d+)$/.exec(uid),name=match&&stages.get(`${match[1]}:f${match[2]}`);if(!name||!Number.isFinite(value))continue
     const key=`${match![2]}:${name}`,group=groups.get(key)??{name,total:0};group.total+=value;groups.set(key,group)
    }
    for(const {name,total} of groups.values())record(s.gpuStages[name]??=metric(),total)
   }
  }).catch(()=>{if(!this.disposed)s.errors++}).finally(()=>{this.pending=false})
 }
 dispose(){this.disposed=true}
}
