import {footWaveGLSL} from './FootstepWaves.ts'
import {Color,DataTexture,DoubleSide,Float32BufferAttribute,FloatType,InstancedBufferAttribute,InstancedBufferGeometry,Mesh,NearestFilter,RGBAFormat,ShaderMaterial,WebGLRenderTarget,Vector3,type WebGLRenderer} from 'three'
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js'
import type {HeroFilaments} from './filamentBake.ts'
import type {createFilamentRenderer} from './FilamentRenderer.ts'
import {WorldGuideAtlas} from './WorldGuideAtlas.ts'
import {matterMotionGLSL} from './dissolveField.ts'
const WIDTH=256,SLOTS=64,GUIDE_SAMPLES=64
// Resample existing paths for GPU lookup. This does not change their topology.
export function tracerGuides(hero:HeroFilaments,maximum=2048){
 const b=hero.buffers,ranges:number[]=[];for(let v=0;v<b.position.length/3;v+=2)if(b.data[v*4+2]===0)ranges.push(v);ranges.push(b.position.length/3)
 const count=Math.min(maximum,ranges.length-1),data=new Float32Array(count*GUIDE_SAMPLES*4)
 for(let row=0;row<count;row++){
  const path=Math.min(ranges.length-2,Math.floor(row*(ranges.length-1)/count)),start=ranges[path],end=ranges[path+1]-2,length=b.data[end*4+2];let cursor=start
  for(let col=0;col<GUIDE_SAMPLES;col++){const arc=length*col/(GUIDE_SAMPLES-1);while(cursor+2<end&&b.data[(cursor+2)*4+2]<arc)cursor+=2;const next=Math.min(end,cursor+2),a=b.data[cursor*4+2],z=b.data[next*4+2],t=z>a?(arc-a)/(z-a):0,offset=(row*GUIDE_SAMPLES+col)*4
   for(let k=0;k<3;k++)data[offset+k]=b.position[cursor*3+k]*(1-t)+b.position[next*3+k]*t;data[offset+3]=length
  }
 }
 return {data,count}
}
const simulationCommon=`uniform sampler2D state;uniform sampler2D guides;uniform sampler2D nearbyGuides;uniform float nearbyCount;uniform float focused;uniform float guideCount;uniform float tracerRows;uniform float clock;uniform float dt;uniform float initialize;uniform float flowSpeed;uniform float waveStrength;uniform float dissolve;uniform vec3 dissolveCenter;${footWaveGLSL}
float hash(float p){return fract(sin(p*12.9898+78.233)*43758.5453);}
float life(float id){return .2+pow(hash(id+19.),1.4)*2.8;}
float age(float id){float duration=life(id);return mod(clock+hash(id+7.)*duration,duration);}
vec4 guide(float id,float progress){float row=mod(id,guideCount),x=clamp(progress,0.,1.)*63.;float a=floor(x),b=min(63.,a+1.);return mix(texture2D(guides,vec2((a+.5)/64.,(row+.5)/guideCount)),texture2D(guides,vec2((b+.5)/64.,(row+.5)/guideCount)),fract(x));}
vec3 curl(vec3 p){return vec3(.8*cos(p.x+.8*p.y+1.3)-cos(p.z+.6*p.x+.4),.7*cos(p.y+.7*p.z+2.1)-cos(p.x+.8*p.y+1.3),.6*cos(p.z+.6*p.x+.4)-cos(p.y+.7*p.z+2.1));}
float wave(vec3 p){float phase=fract(clock*.065-((p.y-dissolveCenter.y)*.045+(p.z-dissolveCenter.z)*.012+(p.x-dissolveCenter.x)*.008)+.5);return exp(-pow((phase-.5)*13.,2.))*waveStrength;}
`
const vertex=`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
export const trailLookup=`
attribute float particleId;uniform sampler2D historyTexture;uniform sampler2D previousHistoryTexture;uniform float historyIndex;uniform float previousHistoryIndex;uniform float trailMemory;uniform float waveStrength;uniform float tracerRows;uniform float trailStride;
float tracerHash(float p){return fract(sin(p*12.9898+78.233)*43758.5453);}
float tracerLife(float id){return .2+pow(tracerHash(id+19.),1.4)*2.8;}
float tracerAge(float id){float life=tracerLife(id);return mod(clock+tracerHash(id+7.)*life,life);}
vec4 trailSample(float node,float index,sampler2D history){float slot=mod(index-clamp(node,0.,63.)+64.,64.);return texture2D(history,vec2((mod(particleId,256.)+.5)/256.,(floor(particleId/256.)+slot*tracerRows+.5)/(tracerRows*64.)));}
vec3 trailPosition(float node,float index,sampler2D history){return trailSample(node,index,history).xyz;}
vec3 trailDirection(float node){return trailPosition(max(0.,node-trailStride),historyIndex,historyTexture)-trailPosition(min(63.,node+trailStride),historyIndex,historyTexture);}
`
export function createWorldTimeTracers(hero:HeroFilaments,filaments:ReturnType<typeof createFilamentRenderer>,focused=false,additional:HeroFilaments[]=[]){
 const count=8192,rows=count/WIDTH,renderNodes=SLOTS,nodeStride=SLOTS/renderNodes
 const sources=[tracerGuides(hero,focused?hero.buffers.paths:additional.length?1536:2048),...additional.map(source=>tracerGuides(source,Math.floor(512/additional.length)))]
 const guideData={count:sources.reduce((n,s)=>n+s.count,0),data:new Float32Array(sources.reduce((n,s)=>n+s.data.length,0))}
 let offset=0;for(const source of sources){guideData.data.set(source.data,offset);offset+=source.data.length}
 const atlas=focused?new WorldGuideAtlas(guideData.data,guideData.count):undefined,guideCount=atlas?.capacity??guideData.count
 const guides=new DataTexture(atlas?.data??guideData.data,GUIDE_SAMPLES,guideCount,RGBAFormat,FloatType);guides.minFilter=guides.magFilter=NearestFilter;guides.needsUpdate=true
 const nearbyData=atlas?.indices??new Float32Array(2048*4),nearbyGuides=new DataTexture(nearbyData,2048,1,RGBAFormat,FloatType);nearbyGuides.minFilter=nearbyGuides.magFilter=NearestFilter
 function focus(position:Vector3,direction?:Vector3){
  const result=atlas?.select(position,filaments.uniforms.clock.value,direction);if(!result)return
  if(result.changed)guides.needsUpdate=true
  nearbyGuides.needsUpdate=true;simUniforms.nearbyCount.value=result.count;stats.focusGuides=result.count;stats.focusCenter=position.toArray();stats.focusUpdates++
 }
 const states=[0,1].map(()=>new WebGLRenderTarget(WIDTH,rows*2,{type:FloatType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false})),histories=[0,1].map(()=>new WebGLRenderTarget(WIDTH,rows*SLOTS,{type:FloatType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false}))
 const simUniforms={tracerRows:{value:rows},state:{value:states[0].texture},nearbyGuides:{value:nearbyGuides},nearbyCount:{value:1},focused:{value:focused?1:0},guides:{value:guides},guideCount:{value:guideCount},clock:filaments.uniforms.clock,dt:{value:0},initialize:{value:1},flowSpeed:{value:1},dissolve:filaments.uniforms.dissolve,dissolveCenter:filaments.uniforms.dissolveCenter,waveStrength:{value:.7},footPulses:filaments.uniforms.footPulses,oldHistory:{value:histories[0].texture},writeSlot:{value:0}}
 const advance=new ShaderMaterial({uniforms:simUniforms,vertexShader:vertex,depthTest:false,depthWrite:false,fragmentShader:`varying vec2 uv0;${simulationCommon}
 void main(){float row=floor(uv0.y*tracerRows*2.),particleRow=mod(row,tracerRows),id=floor(uv0.x*256.)+particleRow*256.;vec2 stateUV=vec2(uv0.x,(particleRow+.5)/(tracerRows*2.));vec4 old=texture2D(state,stateUV);float start=.05+hash(id+3.)*.82;float guideId=focused>.5?texture2D(state,stateUV+vec2(0.,.5)).r:id;float progress=old.w;vec4 g=guide(guideId,progress);float speed=(.35+1.45*hash(id+11.))*flowSpeed*(1.+wave(g.xyz)*2.+footWave(g.xyz)*.8);
 float step=speed*dt/max(g.w,.1);float next=progress+step;bool born=initialize>.5||age(id)<dt||next>.98;
 if(born&&focused>.5)guideId=texture2D(nearbyGuides,vec2((floor(hash(id+floor(clock/life(id))*13.)*nearbyCount)+.5)/2048.,.5)).r;
 if(row>=tracerRows){gl_FragColor=vec4(guideId,0.,0.,1.);return;}
 if(born){progress=start;g=guide(guideId,progress);gl_FragColor=vec4(g.xyz+curl(g.xyz*.37+vec3(hash(id)*21.))*.04,progress);return;}
 vec3 tangent=normalize(guide(guideId,progress+step*.5+.001).xyz-guide(guideId,progress+step*.5-.001).xyz+vec3(.000001));vec3 target=guide(guideId,next).xyz;
 float detached=dissolve*(1.-smoothstep(3.,9.,length(old.xyz-dissolveCenter)));vec3 localCurl=curl(old.xyz*.32+vec3(clock*.12+hash(id)*4.));vec3 velocity=tangent*speed+localCurl*(.10+wave(old.xyz)*.22+detached*1.6)*flowSpeed+(g.xyz-old.xyz)*6.*(1.-detached);
 vec3 predicted=old.xyz+velocity*dt;vec3 offset=predicted-target;float limit=.25+wave(target)*.55+detached*3.;offset*=min(1.,limit/max(.0001,length(offset)));
 gl_FragColor=vec4(target+offset,next);
 }`})
 const record=new ShaderMaterial({uniforms:simUniforms,vertexShader:vertex,depthTest:false,depthWrite:false,fragmentShader:`varying vec2 uv0;uniform sampler2D oldHistory;uniform float writeSlot;${simulationCommon}
 void main(){float row=floor(uv0.y*tracerRows*64.),slot=floor(row/tracerRows),particleRow=mod(row,tracerRows),id=floor(uv0.x*256.)+particleRow*256.;
 if(initialize>.5||abs(slot-writeSlot)<.5){vec3 p=texture2D(state,vec2(uv0.x,(particleRow+.5)/(tracerRows*2.))).xyz;gl_FragColor=vec4(p,clock);}else gl_FragColor=texture2D(oldHistory,uv0);
 }`})
 const quad=new FullScreenQuad(advance),geometry=new InstancedBufferGeometry(),nodes:number[]=[],indices:number[]=[]
 for(let node=0;node<renderNodes;node++){nodes.push(node*nodeStride,-1,0,node*nodeStride,1,0);if(node<renderNodes-1){const v=node*2;indices.push(v,v+2,v+1,v+2,v+3,v+1)}}
 geometry.setAttribute('position',new Float32BufferAttribute(nodes,3));geometry.setIndex(indices);geometry.setAttribute('particleId',new InstancedBufferAttribute(Float32Array.from({length:count},(_,i)=>i),1));geometry.instanceCount=count
 const uniforms={...filaments.uniforms,tracerRows:{value:rows},trailStride:{value:nodeStride},historyTexture:{value:histories[0].texture},previousHistoryTexture:{value:histories[0].texture},historyIndex:{value:0},previousHistoryIndex:{value:0},streamRegionCount:{value:0},streamRegionMin:{value:[new Vector3(),new Vector3()]},streamRegionMax:{value:[new Vector3(),new Vector3()]},streamRegionWeights:{value:[1,1]},trailMemory:{value:1.3},waveStrength:{value:.7}}
 const material=new ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,side:DoubleSide,forceSinglePass:true,toneMapped:false,
 vertexShader:`varying vec3 trailWorld;uniform vec2 resolution;varying float across;varying float fade;varying float viewDepth;varying float head;varying float waveLight;${matterMotionGLSL}${footWaveGLSL}${trailLookup}
 void main(){vec4 historyPoint=trailSample(position.x,historyIndex,historyTexture);vec4 older=trailSample(min(63.,position.x+trailStride),historyIndex,historyTexture);vec3 p=historyPoint.xyz,a=trailPosition(max(0.,position.x-trailStride),historyIndex,historyTexture),b=older.xyz;
 trailWorld=p;float currentAge=tracerAge(particleId),elapsed=clock-historyPoint.w;float memory=min(tracerLife(particleId),trailMemory*(.3+1.5*tracerHash(particleId+11.)));
 fade=pow(max(0.,1.-elapsed/max(.05,memory)),1.6)*step(-.001,older.w-(clock-currentAge))*step(-.001,historyPoint.w-(clock-currentAge))*step(-.001,elapsed)*step(length(b-a),1.8);
 float phase=fract(clock*.065-((p.y-dissolveCenter.y)*.045+(p.z-dissolveCenter.z)*.012+(p.x-dissolveCenter.x)*.008)+.5);waveLight=exp(-pow((phase-.5)*13.,2.))*waveStrength+footWave(p)*.9*activity;head=1.-smoothstep(0.,3.,position.x);
 vec4 va=modelViewMatrix*vec4(p,1.),ca=projectionMatrix*va,pa=projectionMatrix*modelViewMatrix*vec4(a,1.),pb=projectionMatrix*modelViewMatrix*vec4(b,1.);
 vec2 delta=(pb.xy/max(.001,pb.w)-pa.xy/max(.001,pa.w))*resolution;vec2 side=length(delta)>.001?normalize(vec2(-delta.y,delta.x)):vec2(1.,0.);vec4 clip=ca;
 clip.xy+=side*position.y*(.8+head*.6+waveLight*.4)/resolution*clip.w;gl_Position=clip;across=position.y;viewDepth=-va.z;fade*=step(.055,viewDepth);
 }`,
 fragmentShader:`uniform float streamFocusDepth;uniform float streamFocusRange;varying vec3 trailWorld;uniform int streamRegionCount;uniform vec3 streamRegionMin[2];uniform vec3 streamRegionMax[2];uniform float streamRegionWeights[2];uniform float streamFade;uniform sampler2D bodyDepth;uniform vec2 resolution;uniform vec2 cameraRange;varying float across;varying float fade;varying float viewDepth;varying float head;varying float waveLight;
 float linearDepth(float z){return 2.*cameraRange.x*cameraRange.y/(cameraRange.y+cameraRange.x-(z*2.-1.)*(cameraRange.y-cameraRange.x));}
 void main(){float reveal=streamRegionCount==0?1.:0.;for(int i=0;i<2;i++){if(i>=streamRegionCount)break;vec3 edge=min(trailWorld-streamRegionMin[i],streamRegionMax[i]-trailWorld);reveal=max(reveal,smoothstep(-.8,.8,min(edge.x,min(edge.y,edge.z)))*streamRegionWeights[i]);}float surface=linearDepth(texture2D(bodyDepth,gl_FragCoord.xy/resolution).r);float penetration=exp(-max(0.,viewDepth-surface-.1)*3.);float fadeDepth=streamFocusRange>0.?min(viewDepth,max(0.,abs(viewDepth-streamFocusDepth)-streamFocusRange)):viewDepth;float alpha=exp(-across*across*7.)*fade*penetration*reveal*(.58+head*.45+waveLight*.45)*mix(1.,1.-smoothstep(32.,48.,fadeDepth),streamFade);if(alpha<.01)discard;
 vec3 color=mix(vec3(.85,.075,.008),vec3(1.,.58,.16),head*.7+fade*.3);gl_FragColor=vec4(color*(3.2+head*4.+waveLight*3.),alpha);
 }`})
 const mesh=new Mesh(geometry,material);mesh.name='world-time-tracer-histories';mesh.frustumCulled=false;mesh.renderOrder=5
 let stateIndex=0,historyBuffer=0,slot=0,initialized=false,previousClock=0,recordClock=0
 const stats={particles:count,historySamples:SLOTS,renderSamples:renderNodes,updates:0,records:0,clock:0,guides:guideData.count,atlasGuides:guideCount,focusGuides:guideData.count,focusCenter:[] as number[],focusUpdates:0}
 function step(renderer:WebGLRenderer,clock:number,flowSpeed:number,memory:number,waveStrength:number){
  uniforms.previousHistoryTexture.value=uniforms.historyTexture.value;uniforms.previousHistoryIndex.value=slot
  uniforms.trailMemory.value=memory;uniforms.waveStrength.value=waveStrength
  if(clock<previousClock){initialized=false;slot=0;recordClock=clock}
  const delta=Math.max(0,Math.min(.05,clock-previousClock));if(initialized&&delta===0)return
  simUniforms.dt.value=delta;simUniforms.initialize.value=initialized?0:1;simUniforms.flowSpeed.value=flowSpeed;simUniforms.waveStrength.value=waveStrength
  const target=renderer.getRenderTarget(),color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha()
  try{simUniforms.state.value=states[stateIndex].texture;quad.material=advance;renderer.setRenderTarget(states[1-stateIndex]);quad.render(renderer);stateIndex=1-stateIndex;stats.updates++
   if(!initialized||clock-recordClock>=.049){if(initialized)slot=(slot+1)%SLOTS;simUniforms.state.value=states[stateIndex].texture;simUniforms.oldHistory.value=histories[historyBuffer].texture;simUniforms.writeSlot.value=slot;quad.material=record;renderer.setRenderTarget(histories[1-historyBuffer]);quad.render(renderer);historyBuffer=1-historyBuffer;uniforms.historyTexture.value=histories[historyBuffer].texture;uniforms.historyIndex.value=slot;recordClock=clock;stats.records++}
  }finally{renderer.setClearColor(color,alpha);renderer.setRenderTarget(target)}
  if(!initialized){uniforms.previousHistoryTexture.value=uniforms.historyTexture.value;uniforms.previousHistoryIndex.value=slot}initialized=true;previousClock=clock;stats.clock=clock
 }
 // Warm actual world-space histories before the first visible frame, including a paused start.
 function update(renderer:WebGLRenderer,clock:number,flowSpeed:number,memory:number,waveStrength:number){
  const sceneClock=simUniforms.clock.value
  try{
   if((!initialized||clock<previousClock)&&filaments.uniforms.activity.value>0){
    initialized=false;slot=0;previousClock=clock-1.5;recordClock=previousClock
    for(let i=0;i<=30;i++){const t=clock-1.5+i*.05;simUniforms.clock.value=t;step(renderer,t,flowSpeed,memory,waveStrength)}
    uniforms.previousHistoryTexture.value=uniforms.historyTexture.value;uniforms.previousHistoryIndex.value=slot
   }else{simUniforms.clock.value=clock;step(renderer,clock,flowSpeed,memory,waveStrength)}
  }finally{simUniforms.clock.value=sceneClock}
 }
 function replaceGuides(source:Float32Array,ids:Int32Array){atlas?.replaceSource(source,ids);stats.guides=ids.length}
 function dispose(){geometry.dispose();material.dispose();advance.dispose();record.dispose();guides.dispose();nearbyGuides.dispose();states.forEach(t=>t.dispose());histories.forEach(t=>t.dispose());quad.dispose()}
 return {mesh,material,uniforms,guides,nearbyGuides,simUniforms,states,histories,stats,focus,replaceGuides,update,dispose,currentHistory:()=>histories[historyBuffer]}
}
