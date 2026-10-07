import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
// Run against npm run dev; this exercises the actual TSL shaders on native GPU.
const origin=process.env.VESTIGE_TEST_URL??'http://127.0.0.1:5177';
const b=await chromium.launch({headless:true,args:['--enable-unsafe-webgpu',...(process.platform==='darwin'?['--use-angle=metal']:[])]});
try {
 const page=await b.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/__tracer_culling_test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Tracer GPU regression</title>'}));
 await page.goto(origin+'/__tracer_culling_test');
 const result=await page.evaluate(async()=>{
  const code=await (await fetch('/src/webgpu/NodeMaterials.ts')).text();
  const gpu=code.match(/from "([^"]*three_webgpu.js[^"]*)"/)[1],tsl=code.match(/from "([^"]*three_tsl.js[^"]*)"/)[1];
  const {WebGPURenderer,InstancedBufferGeometry,Float32BufferAttribute,Mesh,StorageBufferAttribute}=await import(gpu);
  const {Fn,Loop,If,storage,instanceIndex,float,uint,uniform,min,max,pow,step,add,mul}=await import(tsl);
  const {compactTracerIndex}=await import('/src/webgpu/CompactTracerIndex.ts'),{tracerVertex}=await import('/src/webgpu/generated/tracerVertex.js');
  const renderer=new WebGPURenderer({canvas:document.createElement('canvas'),trackTimestamp:false});await renderer.init();
  const count=8192,slots=64,original=new InstancedBufferGeometry();original.setAttribute('position',new Float32BufferAttribute(Array.from({length:128},(_,i)=>[Math.floor(i/2),i%2?1:-1,0]).flat(),3));original.instanceCount=count;
  const times=new Float32Array(count*slots*4),histories=new StorageBufferAttribute(times,4),clock=uniform(0),memory=uniform(1.5),slot=uniform(0,'uint');
  const source={mesh:new Mesh(original),uniforms:{clock:{value:0},trailMemory:{value:1.5},historyIndex:{value:0}}};
  const cull=compactTracerIndex(renderer,source,histories),out=new StorageBufferAttribute(new Uint32Array(count),1),required=storage(out,'uint',count),history=storage(histories,'vec4',count*slots).toReadOnly();
  const factory=tracerVertex({clock});
  const oracle=Fn(()=>{
   const id=instanceIndex,p=float(id),life=factory.tracerLife(p).toVar(),age=factory.tracerAge(p).toVar();
   const weighted=memory.mul(add(.3,mul(1.5,factory.tracerHash(p.add(11)))));
   const limit=max(.05,min(life,weighted)).toVar(),needed=uint(0).toVar();
   Loop(64,({i})=>{
    const time=history.element(slot.add(slots).sub(uint(i)).mod(slots).mul(count).add(id)).w.toVar(),older=history.element(slot.add(slots).sub(uint(min(i.add(1),63))).mod(slots).mul(count).add(id)).w.toVar(),elapsed=clock.sub(time).toVar();
    const fade=pow(max(0,float(1).sub(elapsed.div(limit))),1.6).mul(step(-.001,older.sub(clock.sub(age)))).mul(step(-.001,time.sub(clock.sub(age)))).mul(step(-.001,elapsed));
    If(fade.greaterThan(0),()=>{needed.assign(uint(min(i.add(1),63)))})
   });required.element(id).assign(needed)
  })().compute(count);
  await renderer.compileComputeAsync([...cull.passes,oracle]);
  const cases=[];
  for(const slotId of [0,1,31,63])for(const mem of [.01,.05,1.5,10])cases.push({name:`regular-${slotId}-${mem}`,clock:17.231,memory:mem,slot:slotId,mode:'regular'});
  cases.push({name:'all-live-initialization',clock:-1.5,memory:10,slot:0,mode:'live'},{name:'all-expired',clock:0,memory:10,slot:63,mode:'dead'},{name:'before-20hz-record',clock:21.018,memory:1.5,slot:31,mode:'regular'},{name:'after-history-wrap',clock:21.066,memory:1.5,slot:0,mode:'regular'},{name:'paused-memory-change',clock:21.066,memory:.05,slot:0,mode:'regular'},{name:'time-reset',clock:-.85,memory:1.5,slot:0,mode:'regular'},{name:'float-large-clock',clock:65536.125,memory:1.5,slot:63,mode:'regular'},{name:'endpoint-boundaries',clock:1.13,memory:1.5,slot:1,mode:'boundary'});
  const results=[];
  for(const test of cases){
   const t=Math.fround(test.clock);clock.value=source.uniforms.clock.value=t;memory.value=source.uniforms.trailMemory.value=test.memory;slot.value=source.uniforms.historyIndex.value=test.slot;
   for(let node=0;node<slots;node++)for(let id=0;id<count;id++){
    const at=(((test.slot-node+slots)%slots)*count+id)*4;
    times[at]=node*.05;times[at+1]=0;times[at+2]=-5;
    times[at+3]=test.mode==='dead'?t-4:test.mode==='live'?t:t-node*(test.mode==='boundary'?.003:.049)-(id%6)*.006;
   }
   histories.needsUpdate=true;cull.update();renderer.compute(oracle);await renderer.backend.device.queue.onSubmittedWorkDone();
   const ranges=new Uint32Array(await renderer.getArrayBufferAsync(cull.offsets)),blocks=new Uint32Array(await renderer.getArrayBufferAsync(cull.groups)),draw=new Uint32Array(await renderer.getArrayBufferAsync(cull.indirect)),need=new Uint32Array(await renderer.getArrayBufferAsync(out));
   let cursor=0,requiredSegments=0;
   for(let id=0;id<count;id++){const n=ranges[id*2],offset=blocks[Math.floor(id/256)*2+1]+ranges[id*2+1];if(n>63||offset!==cursor||n<need[id])throw Error(`${test.name} invalid range ${id}: ${n} need ${need[id]} at ${offset} vs ${cursor}`);cursor+=n;requiredSegments+=need[id]}
   if(draw[0]!==cursor*6||draw[1]!==1||draw[2]!==0||draw[3]!==0||draw[4]!==0)throw Error('indirect args');
   if(test.mode==='dead'&&cursor!==0)throw Error('dead retained');if(test.mode==='live'&&cursor!==count*63)throw Error('live omitted');
   const idx=new Uint32Array(await renderer.getArrayBufferAsync(cull.index));
   for(let id=0;id<count;id++){const n=ranges[id*2],start=(blocks[Math.floor(id/256)*2+1]+ranges[id*2+1])*6;for(let j=0;j<n;j++){const v=id*128+j*2,a=[v,v+2,v+1,v+2,v+3,v+1];for(let k=0;k<6;k++)if(idx[start+j*6+k]!==a[k])throw Error(`index order ${test.name} ${id} ${j} ${k}`)}}
   results.push({...test,segments:cursor,requiredSegments});
  }
  // Dispose before any geometry render as well as after repeated computes.
  cull.dispose();if(source.mesh.geometry!==original)throw Error('source not restored');
  for(const attr of [cull.index,cull.indirect,cull.offsets,cull.groups])if(renderer._attributes.has(attr))throw Error('owned buffer retained');
  oracle.dispose();renderer._attributes.delete(histories);renderer._attributes.delete(out);history.dispose();required.dispose();original.dispose();renderer.dispose();
  return {cases:results,originalGeometryRestored:true,ownedBuffersReleased:true};
 });
 assert.deepEqual(errors,[]);
 console.log(`Tracer culling: ${result.cases.length} native GPU boundary cases; all live endpoints retained, ordered indices/indirect counts correct, disposal restores source and releases buffers.`);
}finally{await b.close()}
