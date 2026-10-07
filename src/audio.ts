export type MushroomSound={id:number;track:number;position:[number,number,number];height:number;range:number}
type Point={x:number;y:number;z:number}
type TrackSource={source:AudioBufferSourceNode;gain:GainNode}
type Loop={input:GainNode;buffer?:AudioBuffer;nextAt:number;fade:number;enabled:boolean;sources:Set<TrackSource>}
type Voice=Loop&{panner:PannerNode;output:GainNode;id?:number;distance:number;level:number}
type Graph={context:AudioContext;space:ConvolverNode;master:GainNode;entrance:GainNode;entranceStarted:boolean;analyser:AnalyserNode;bed:Loop;voices:Voice[];timer:number}

const BACKGROUND_GAIN=.10
export const MUSHROOM_TRACKS=['/audio/mushroom-1.m4a','/audio/mushroom-2.m4a','/audio/mushroom-3.m4a','/audio/mushroom-4.m4a','/audio/mushroom-5.m4a','/audio/mushroom-6.m4a','/audio/mushroom-7.m4a','/audio/mushroom-8.m4a']

export class WorldAudio {
 private graph?:Graph
 private active=false
 private disposed=false
 private abort=new AbortController()
 private loaded=new Map<string,Promise<AudioBuffer>>()
 private mushrooms:MushroomSound[]=[]

 setMushrooms(mushrooms:MushroomSound[]){this.mushrooms=mushrooms}

 private create(unlockedContext?:AudioContext){
  if(this.graph)return this.graph
  const context=unlockedContext??new AudioContext(),space=context.createConvolver(),master=context.createGain(),entrance=context.createGain(),analyser=context.createAnalyser()
  master.gain.value=0;entrance.gain.value=0;analyser.fftSize=256
  const impulse=context.createBuffer(2,Math.floor(context.sampleRate*1.8),context.sampleRate)
  for(let channel=0;channel<2;channel++){const data=impulse.getChannelData(channel);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3)*.18}
  space.buffer=impulse;space.normalize=true
  const wet=context.createGain();wet.gain.value=.10
  space.connect(wet).connect(master);master.connect(entrance).connect(analyser).connect(context.destination)
  const input=context.createGain();input.gain.value=.72*BACKGROUND_GAIN;input.connect(master);input.connect(space)
  const bed:Loop={input,nextAt:0,fade:10,enabled:true,sources:new Set()}
  const voices:Voice[]=MUSHROOM_TRACKS.map(()=>{
   const input=context.createGain(),panner=context.createPanner(),output=context.createGain()
   panner.panningModel='HRTF';panner.rolloffFactor=0;output.gain.value=0
   input.connect(panner).connect(output);output.connect(master);output.connect(space)
   return {input,panner,output,nextAt:0,fade:5,enabled:false,sources:new Set<TrackSource>(),distance:Infinity,level:0}
  })
  const graph:Graph={context,space,master,entrance,entranceStarted:false,analyser,bed,voices,timer:0}
  graph.timer=window.setInterval(()=>{
   if(context.state!=='running')return
   for(const loop of [bed,...voices]){
    if(loop.enabled&&loop.buffer&&(loop.sources.size===0||context.currentTime+.5>=loop.nextAt))this.schedule(graph,loop,loop.nextAt)
    if(!loop.enabled&&'output' in loop&&(loop as Voice).output.gain.value<.001)this.stopLoop(loop)
   }
  },100)
  this.graph=graph;return graph
 }

 private load(url:string,g:Graph){
  const cached=this.loaded.get(url);if(cached)return cached
  const promise=fetch(url,{signal:this.abort.signal}).then(response=>{if(!response.ok)throw new Error(`${url}: ${response.status}`);return response.arrayBuffer()}).then(data=>g.context.decodeAudioData(data))
  this.loaded.set(url,promise);return promise
 }

 private schedule(g:Graph,loop:Loop,at:number){
  if(!loop.buffer)return
  const now=Math.max(at,g.context.currentTime+.05),fade=Math.min(loop.fade,loop.buffer.duration*.45)
  const source=g.context.createBufferSource(),gain=g.context.createGain();source.buffer=loop.buffer
  source.connect(gain).connect(loop.input);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(1,now+fade)
  gain.gain.setValueAtTime(1,now+loop.buffer.duration-fade);gain.gain.linearRampToValueAtTime(0,now+loop.buffer.duration)
  const item={source,gain};loop.sources.add(item)
  source.onended=()=>{loop.sources.delete(item);gain.disconnect();source.disconnect()};source.start(now)
  loop.nextAt=now+loop.buffer.duration-fade
 }

 private stopLoop(loop:Loop){
  for(const item of loop.sources){item.source.onended=null;try{item.source.stop()}catch{}item.source.disconnect();item.gain.disconnect()}
  loop.sources.clear();loop.nextAt=0
 }

 async prepare(unlockedContext?:AudioContext){
  if(this.disposed)return
  const g=this.create(unlockedContext);await g.context.resume();if(this.graph!==g)return
  MUSHROOM_TRACKS.forEach((url,index)=>{
   const voice=g.voices[index];if(voice.buffer)return
   void this.load(url,g).then(buffer=>{
    if(this.graph!==g||voice.buffer)return
    voice.buffer=buffer
    let peak=0;for(let channel=0;channel<buffer.numberOfChannels;channel++){const data=buffer.getChannelData(channel);for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]))}
    voice.input.gain.value=peak>0?Math.min(8,.7/peak):1
   }).catch(()=>undefined)
  })
  if(!g.bed.buffer){const buffer=await this.load('/sound.mp3',g);if(this.graph!==g||g.bed.buffer)return;g.bed.buffer=buffer}
 }

 async start(fadeIn=0){
  if(this.disposed)return
  this.active=true;await this.prepare();const g=this.graph;if(!g||!this.active)return
  if(g.bed.sources.size===0)this.schedule(g,g.bed,g.context.currentTime+.05)
  if(!g.entranceStarted){
   g.entranceStarted=true;g.entrance.gain.setValueAtTime(0,g.context.currentTime);
   g.entrance.gain.linearRampToValueAtTime(1,g.context.currentTime+Math.max(0,fadeIn));
  }
  g.master.gain.setTargetAtTime(1,g.context.currentTime,.3)
 }

 setActive(active:boolean){
  this.active=active;const g=this.graph;if(!g)return
  if(active)void g.context.resume().catch(()=>undefined)
  else {g.master.gain.setTargetAtTime(0,g.context.currentTime,.12);void g.context.suspend().catch(()=>undefined)}
 }

 update(position:Point,forward:Point){
  const g=this.graph;if(!g||!this.active||g.context.state!=='running')return
  const now=g.context.currentTime,listener=g.context.listener
  if(listener.positionX){
   listener.positionX.setValueAtTime(position.x,now);listener.positionY.setValueAtTime(position.y,now);listener.positionZ.setValueAtTime(position.z,now)
   listener.forwardX.setValueAtTime(forward.x,now);listener.forwardY.setValueAtTime(forward.y,now);listener.forwardZ.setValueAtTime(forward.z,now)
   listener.upX.setValueAtTime(0,now);listener.upY.setValueAtTime(1,now);listener.upZ.setValueAtTime(0,now)
  }else{listener.setPosition(position.x,position.y,position.z);listener.setOrientation(forward.x,forward.y,forward.z,0,1,0)}
  const closest=MUSHROOM_TRACKS.map((_,track)=>{
   let best:{mushroom:MushroomSound;y:number;distance:number;weight:number}|undefined
   for(const mushroom of this.mushrooms){
    if(mushroom.track!==track)continue
    const [x,base,z]=mushroom.position,y=Math.max(base,Math.min(base+mushroom.height,position.y))
    const distance=Math.hypot(x-position.x,y-position.y,z-position.z),t=Math.max(0,1-distance/mushroom.range),weight=t*t*(3-2*t)
    if(weight>(best?.weight??0))best={mushroom,y,distance,weight}
   }
   return {track,best}
  })
  const audible=new Set(closest.filter(item=>item.best).sort((a,b)=>b.best!.weight-a.best!.weight).slice(0,2).map(item=>item.track))
  for(const {track,best} of closest){
   const voice=g.voices[track],level=audible.has(track)&&best?best.weight*.45:0
   voice.enabled=level>.002;voice.level=level;voice.id=best?.mushroom.id;voice.distance=best?.distance??Infinity
   voice.output.gain.setTargetAtTime(level,now,.35)
   if(best){const p=voice.panner,[x,,z]=best.mushroom.position;if(p.positionX){p.positionX.setTargetAtTime(x,now,.2);p.positionY.setTargetAtTime(best.y,now,.2);p.positionZ.setTargetAtTime(z,now,.2)}else p.setPosition(x,best.y,z)}
  }
  g.master.gain.setTargetAtTime(1,now,.3)
 }

 info(){
  const g=this.graph;let rms=0
  if(g&&g.context.state==='running'){const data=new Float32Array(256);g.analyser.getFloatTimeDomainData(data);rms=Math.sqrt(data.reduce((sum,v)=>sum+v*v,0)/data.length)}
  return {state:g?.context.state??'uninitialized',active:this.active,entranceGain:g?.entrance.gain.value??0,rms,mushrooms:this.mushrooms.length,voices:g?.voices.map((voice,track)=>({track:track+1,mushroom:voice.id,distance:voice.distance,level:voice.level,loaded:!!voice.buffer,playing:voice.sources.size>0}))??[]}
 }

 dispose(){
  this.disposed=true;this.abort.abort();const g=this.graph;this.graph=undefined;this.active=false;this.loaded.clear();if(!g)return
  window.clearInterval(g.timer);for(const loop of [g.bed,...g.voices])this.stopLoop(loop)
  for(const voice of g.voices){voice.input.disconnect();voice.panner.disconnect();voice.output.disconnect()}
  g.bed.input.disconnect();g.space.disconnect();g.master.disconnect();g.entrance.disconnect();g.analyser.disconnect();void g.context.close().catch(()=>undefined)
 }
}
