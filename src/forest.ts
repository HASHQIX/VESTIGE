import {FootstepWaves} from './filaments/FootstepWaves.ts'
import {MUSHROOM_TRACKS} from './audio.ts'
import {createStreamedForest,type ForestStreaming} from './forestStreaming.ts'
import {createForestPreview} from './forestPreview.ts'
import type {FilamentRegion} from './filaments/filamentField.ts'
import type {PackedFilaments} from './filaments/filamentBuffers.ts'
import {createWorldTimeTracers} from './filaments/WorldTimeTracers.ts'
import {createAmbientMatterDust} from './filaments/camera/AmbientMatterDust.ts'
import type {CameraStats} from './filaments/camera/MatterCameraPass'
import {createFilamentSpores} from './filaments/SporeRenderer.ts'
import {createFilamentRenderer} from './filaments/FilamentRenderer.ts'
import {createWalkingSurface} from './forestSurface.ts'
import {forestAtmosphere} from './forestAtmosphere.ts'
import {veinGeometry} from './veinGeometry.ts'
import * as THREE from 'three'
import {createForestLayout,seeded,type P} from './forestLayout.ts'
import {generateForestPayload,type ForestPayload} from './forestBuild.ts'
import {bodyGeometry,ribbonGeometry,ribbonMesh} from './fiberRenderer.ts'
import {createOrganicMaterial,createRibbonMaterial,createVeinMaterial,type ForestUniforms,colourGLSL} from './organicMaterial.ts'
import {worldSkeleton} from './worldSkeleton.ts'
import {worldSDF,surfaceHeight,findSurfaceHeight} from './worldSDF.ts'
import {forestFloor,ForestRoute} from './forestNavigation.ts'
import type {Vector3} from 'three'
type Point=[number,number,number]
type FieldSample={point:Vector3;distance:number;arc:number;height:number;curvature:number;crossings:number;station:number}
export {forestFloor} from './forestNavigation.ts'
type Spring={x:number;t:number}
declare const HL:{spring:(x:number) => Spring;stepS:(s:Spring,dt:number) => boolean}
const point=(p:P) => new THREE.Vector3(...p)
export type ForestPatch={ground?:ReturnType<typeof createFilamentRenderer>;groundBuffers?:PackedFilaments;region:FilamentRegion;buffers:PackedFilaments;group:THREE.Group;filaments:ReturnType<typeof createFilamentRenderer>;walking:ReturnType<typeof createWalkingSurface>;owned:(THREE.BufferGeometry|THREE.Material)[]}
function assembleForest(payload:ForestPayload,worker:boolean) {
  const matter=payload.hero??payload.matter
  const layout=createForestLayout(),group=new THREE.Group(),resources:(THREE.BufferGeometry|THREE.Material)[]=[]
  const uniforms:ForestUniforms={clock:{value:0},sway:{value:0},resolution:{value:new THREE.Vector2(1440,900)}}
  const material=createRibbonMaterial(uniforms),rootMaterial=createOrganicMaterial(uniforms),depthMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:true})
  const veinMaterial=createVeinMaterial(uniforms);resources.push(material,rootMaterial,depthMaterial,veinMaterial)
  const atmosphere=forestAtmosphere(uniforms,Boolean(matter));group.add(atmosphere.mesh);resources.push(atmosphere.geometry,atmosphere.material)
  const chunks=payload.chunks.map(chunk => {
    const body=bodyGeometry(chunk.body),geometry=ribbonGeometry(chunk.fibers),organ=new THREE.Group(),depth=new THREE.Mesh(body,depthMaterial),surface=new THREE.Mesh(body,rootMaterial)
    depth.layers.enable(1);if(payload.fullStudy)depth.layers.set(1);depth.renderOrder=-2;depth.name='implicit-depth-body';surface.renderOrder=1;surface.name='surface-microfibers'
    const veins=veinGeometry(chunk.veins),arteries=new THREE.Mesh(veins,veinMaterial);arteries.name='primary-vascular-tissue';arteries.renderOrder=2
    organ.add(depth,surface,arteries,ribbonMesh(geometry,material));if(matter)for(const layer of organ.children.slice(1))layer.visible=false;group.add(organ);resources.push(body,geometry,veins)
    return {...chunk,body,geometry,veins,organ,fullCount:geometry.instanceCount}
  })

  const filaments=matter?createFilamentRenderer(matter,uniforms):undefined
  function groundRenderer(data:ForestPayload['ground']){
   if(!data?.buffers.paths||!filaments)return undefined
   const f=createFilamentRenderer(data,uniforms,undefined,11);f.mesh.name='walking-ground-filaments';f.mesh.visible=false;f.uniforms.ground.value=1;f.uniforms.baseVisibility.value=.55
   Object.assign(f.uniforms,{streamFocusDepth:filaments.uniforms.streamFocusDepth,streamFocusRange:filaments.uniforms.streamFocusRange,activity:filaments.uniforms.activity,bodyDepth:filaments.uniforms.bodyDepth,cameraRange:filaments.uniforms.cameraRange,streamFade:filaments.uniforms.streamFade,walkFocus:filaments.uniforms.walkFocus,footPulses:filaments.uniforms.footPulses})
   return f
  }
  const ground=groundRenderer(payload.ground)
  if(ground){ground.mesh.visible=!!payload.fullStudy;ground.uniforms.streamWeight=filaments!.uniforms.streamWeight;group.add(ground.mesh);resources.push(ground.geometry,ground.material)}
  const preview=payload.streamRegion&&filaments?createForestPreview(layout,worldSkeleton(layout),filaments):undefined
  if(preview){group.add(preview.mesh,preview.floorMesh);resources.push(preview.geometry,preview.material,preview.floorGeometry,preview.floorMaterial);preview.regions([payload.streamRegion!])}
  const fragments=payload.hero&&filaments?createFilamentSpores(payload.hero,filaments):undefined
  const tracers=matter&&filaments?createWorldTimeTracers(matter,filaments,!payload.hero,payload.fullStudy&&payload.ground?[payload.ground]:[]):undefined
  if(tracers)group.add(tracers.mesh)
  const dust=matter&&filaments?createAmbientMatterDust(matter,filaments):undefined
  const matterCamera:CameraStats={mode:'TEMPORAL',frames:0,resets:0,lastReset:'initial',width:0,height:0,particles:dust?.count??0}
  if(dust){group.add(dust.mesh);resources.push(dust.geometry,dust.material)}
  if(filaments){group.add(filaments.mesh);resources.push(filaments.geometry,filaments.material)}
  if(fragments){group.add(fragments.mesh);resources.push(fragments.geometry,fragments.material)}

  // Representative graph/fibre positions remain CPU-side for attention-driven audio; the GPU expands ribbons.
  const samples:number[]=[],colors:number[]=[]
  for(const chunk of payload.chunks) for(let i=0;i<chunk.fibers.start.length;i+=72) {samples.push(chunk.fibers.start[i],chunk.fibers.start[i+1],chunk.fibers.start[i+2]);colors.push(.2,.8,1)}
  if(matter)for(let i=0;i<matter.buffers.position.length;i+=96){samples.push(...matter.buffers.position.slice(i,i+3));colors.push(1,.5,.1)}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(samples,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));resources.push(geometry)
  const random=seeded(24107),spores:number[]=[],phases:number[]=[],anchors:number[]=[]
  for(let i=0;i<850;i++){if(i<payload.lights.length){spores.push(...payload.lights[i].position);phases.push(payload.lights[i].phase);anchors.push(1);continue}const x=(random()-.5)*96,z=28-random()*197;spores.push(x,forestFloor(x,z)+random()*38,z);phases.push(random()*Math.PI*2);anchors.push(0)}
  const sporeGeometry=new THREE.BufferGeometry();sporeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(spores,3));sporeGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1))
  sporeGeometry.setAttribute('anchor',new THREE.Float32BufferAttribute(anchors,1))
  const sporeMaterial=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
    vertexShader:`attribute float phase;attribute float anchor;uniform float clock;uniform float sway;varying float hue;varying float depth;void main(){vec3 p=position;if(anchor>.5){p.x+=sway*.16*sin(clock*.5+position.y*.2+phase);p.z+=sway*.10*cos(clock*.4+position.y*.2);}else{p.y+=.35*sway*sin(clock*.3+phase);p.x+=.2*sway*sin(clock*.2+phase*2.);}vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(150./max(1.,-v.z),1.2,5.);hue=phase;depth=-v.z;}`,
    fragmentShader:`varying float hue;varying float depth;${colourGLSL}void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(tissueColour(hue)*3.2*exp(-max(0.,depth-25.)*.01),pow(1.-d,2.));}`})
  const points=new THREE.Points(sporeGeometry,sporeMaterial);points.name='floating-spores';points.renderOrder=3;if(!matter)group.add(points);resources.push(sporeGeometry,sporeMaterial)
  const colliders=layout.mushrooms.map(m => {const r=Math.max(.34,m.radius*.13),base=m.base??forestFloor(m.x,m.z);return new THREE.Box3(point([m.x-r,base,m.z-r]),point([m.x+r,base+m.height*.75,m.z+r]))})
  const volume=worldSDF(layout,worldSkeleton(layout)),walking=createWalkingSurface(payload.chunks.map(c=>c.body),payload.walking)
  let walkers=[walking]
  const supportHeight=(x:number,z:number,min:number,max:number)=>{let height:number|undefined;for(const w of walkers){const h=w.heightAt(x,z,min,max);if(h!==undefined&&(height===undefined||h>height))height=h}if(height===undefined&&payload.streamRegion){const h=findSurfaceHeight(volume,x,z,max);if(h!==undefined&&h>=min&&h<=max)height=h}return height}
  const decks=layout.bridges.map((b,i) => ({walkable:b.walkable!==false,id:`root-bridge-${b.id-32}`,points:payload.decks[i].map(point),width:b.width})).filter(d=>d.walkable)
  const names=['The first living bridge','Above the luminous roots','The woven crossroads','In the upper canopy','The returning roots'],views:Point[]=[[-12,13,-15],[-17,34,-8],[-3,32,-65],[31,32,-84],[-23,38,-124]]
  const stops=layout.nodes.slice(0,5).map((v,i) => ({name:names[i],view:[v[0],surfaceHeight(volume,v[0],v[2],v[1])+1.7,v[2]] as Point,target:views[i]}))
  if(payload.hero&&!payload.fullStudy){const c=payload.hero.region.center;stops[0]={name:'Filament matter · first bridge',view:[c[0]+13,c[1]+9,c[2]+16],target:[c[0],c[1]-1,c[2]-6]};stops[1]={name:'Across the layered bridge',view:[c[0]+9,c[1]+2,c[2]+3],target:[c[0],c[1]-1,c[2]-7]};stops[2]={name:'Inside the filament layers',view:[c[0]+5,c[1]+3,c[2]+4],target:[c[0]-2,c[1]-1,c[2]-7]}}
  // Walk every skeletal branch continuously, returning through its shared organic node.
  const guide:typeof decks=[] ,visited=new Set<number>()
  const visit=(node:number)=>{for(let i=0;i<layout.bridges.length;i++){if(visited.has(i))continue;const b=layout.bridges[i],start=b.points[0],end=b.points.at(-1)!,p=layout.nodes[node],from=point(start).distanceTo(point(p))<.01,to=point(end).distanceTo(point(p))<.01;if(!from&&!to)continue
    visited.add(i);const forward=from?decks[i]:{...decks[i],points:[...decks[i].points].reverse()};guide.push(forward)
    const target=from?end:start,next=layout.nodes.findIndex(p=>point(p).distanceTo(point(target))<.01);if(next>=0)visit(next)
    guide.push({...forward,points:[...forward.points].reverse()})
  }}
  visit(0);const heroDeck=payload.hero?{...decks[0],points:decks[0].points.slice(Math.floor(decks[0].points.length*.12),Math.ceil(decks[0].points.length*.96))}:undefined;const route=new ForestRoute(heroDeck?[heroDeck,{...heroDeck,points:[...heroDeck.points].reverse()}]:guide)
  const matterMeshes=filaments?[filaments,...(payload.fullStudy&&ground?[ground]:[])]:[],interaction=filaments?new FootstepWaves(filaments.uniforms.footPulses.value):undefined
  if(interaction)Object.assign(matterCamera,{footsteps:interaction.stats})
  let initialStreamPatch:ForestPatch|undefined
  if(payload.fullStudy&&filaments){filaments.uniforms.overview.value=1;if(ground)ground.uniforms.overview.value=1}
  if(payload.streamRegion&&matter&&filaments){const patchGroup=new THREE.Group();patchGroup.add(...chunks.map(c=>c.organ),filaments.mesh);if(ground)patchGroup.add(ground.mesh);group.add(patchGroup);initialStreamPatch={ground,groundBuffers:payload.ground?.buffers,region:payload.streamRegion,buffers:matter.buffers,group:patchGroup,filaments,walking,owned:[...chunks.flatMap(c=>[c.body,c.geometry,c.veins]),filaments.geometry,filaments.material,...(ground?[ground.geometry,ground.material]:[])]}}
  function addStreamPatch(next:ForestPayload,key:string):ForestPatch{
   const patchGroup=new THREE.Group();patchGroup.name=`forest-patch-${key}`;const owned:(THREE.BufferGeometry|THREE.Material)[]=[]
   for(const chunk of next.chunks){const body=bodyGeometry(chunk.body),depth=new THREE.Mesh(body,depthMaterial);depth.layers.enable(1);depth.renderOrder=-2;depth.name='implicit-depth-body';patchGroup.add(depth);owned.push(body)}
   const f=createFilamentRenderer(next.matter!,uniforms)
   Object.assign(f.uniforms,{footPulses:filaments!.uniforms.footPulses,baseVisibility:filaments!.uniforms.baseVisibility,streamFocusDepth:filaments!.uniforms.streamFocusDepth,streamFocusRange:filaments!.uniforms.streamFocusRange,activity:filaments!.uniforms.activity,dissolve:filaments!.uniforms.dissolve,dissolveCenter:filaments!.uniforms.dissolveCenter,bodyDepth:filaments!.uniforms.bodyDepth,cameraRange:filaments!.uniforms.cameraRange,streamFade:filaments!.uniforms.streamFade})
   patchGroup.add(f.mesh);group.add(patchGroup);owned.push(f.geometry,f.material);resources.push(...owned)
   const ground=groundRenderer(next.ground);if(ground){ground.mesh.visible=!!payload.fullStudy;ground.uniforms.streamWeight=f.uniforms.streamWeight;patchGroup.add(ground.mesh);owned.push(ground.geometry,ground.material);resources.push(ground.geometry,ground.material)}
   return {ground,groundBuffers:next.ground?.buffers,region:next.streamRegion!,buffers:next.matter!.buffers,group:patchGroup,filaments:f,walking:createWalkingSurface(next.chunks.map(c=>c.body),next.walking),owned}
  }
  function removeStreamPatch(patch:ForestPatch){group.remove(patch.group);patch.walking.dispose();for(const item of patch.owned){item.dispose();if(item instanceof THREE.BufferGeometry){for(const name of Object.keys(item.attributes))item.deleteAttribute(name);item.setIndex(null)}const index=resources.indexOf(item);if(index>=0)resources.splice(index,1)}}
  function reseedDust(buffers:PackedFilaments[]){
   if(!dust||!buffers.length)return
   const anchor=dust.geometry.getAttribute('anchor'),direction=dust.geometry.getAttribute('direction'),random=seeded(18371)
   for(let i=0;i<dust.count;i++){const b=buffers[i%buffers.length];if(!b.position.length)continue;const at=Math.floor(random()*(b.position.length/6))*6;anchor.setXYZ(i,b.position[at],b.position[at+1],b.position[at+2]);direction.setXYZ(i,b.flow[at],b.flow[at+1],b.flow[at+2])}anchor.needsUpdate=true;direction.needsUpdate=true
  }
  const start=stops[0].view
  const firstMushroom=layout.mushrooms.reduce((closest,m)=>Math.hypot(m.x-start[0],m.z-start[2])<Math.hypot(closest.x-start[0],closest.z-start[2])?m:closest)
  const soundRandom=seeded(83071),soundTracks:number[]=[]
  const nextSoundTrack=()=>{
   // Shuffle a complete set so every old and new recording appears in the world.
   // Jiangpu Road 9 stays reserved for the mushroom at the starting point.
   if(!soundTracks.length){
    for(let track=0;track<MUSHROOM_TRACKS.length;track++)if(track!==5)soundTracks.push(track)
    for(let i=soundTracks.length-1;i>0;i--){const j=Math.floor(soundRandom()*(i+1));[soundTracks[i],soundTracks[j]]=[soundTracks[j],soundTracks[i]]}
   }
   return soundTracks.pop()!
  }
  const mushroomSounds=layout.mushrooms.map(m=>{
   const isFirst=m.id===firstMushroom.id
   return {id:m.id,track:isFirst?5:nextSoundTrack(),position:[m.x,(m.base??forestFloor(m.x,m.z))+1.2,m.z] as Point,height:m.height,range:isFirst?22:9+Math.min(8,m.radius)}
  })
  let streamDispose=()=>{}
  return {mushroomSounds,study:payload.fullStudy?{complete:true,groundPaths:payload.ground?.buffers.paths??0,organicPaths:matter?.buffers.paths??0,cache:payload.studyCache}:undefined,fullStudy:!!payload.fullStudy,interaction,preview,attachStreamDisposer:(dispose:()=>void)=>{streamDispose=dispose},streaming:undefined as ForestStreaming|undefined,requestFrame:undefined as (()=>void)|undefined,matterMeshes,matterRevision:0,initialStreamPatch,addStreamPatch,removeStreamPatch,reseedDust,setWalkingPatches:(patches:ForestPatch[])=>{walkers=patches.map(p=>p.walking)},group,chunks,resources,filaments,fragments,dust,tracers,matterCamera,geometry,material,rootGeometry:chunks[0].body,rootMaterial,sporeGeometry,sporeMaterial,uniforms,colliders,decks,stops,route,bounds:layout.bounds,supportHeight,surfaceHeight:(x:number,z:number,near:number)=>findSurfaceHeight(volume,x,z,near),volumeField:(x:number,y:number,z:number)=>volume.field(new THREE.Vector3(x,y,z)),components:payload.components,elevatedMushrooms:payload.elevatedMushrooms,arches:layout.bridges.filter(b=>b.arch).length,mushrooms:layout.mushrooms.length,clock:0,sway:HL.spring(0),
    vertices:filaments?filaments.geometry.getAttribute('position').count:chunks.reduce((n,c) => n+c.fullCount*4,0),organicVertices:chunks.reduce((n,c) => n+c.body.getAttribute('position').count,0),branches:chunks.reduce((n,c) => n+c.edges,0),junctions:chunks.reduce((n,c) => n+c.forks+c.merges,0),connections:chunks.reduce((n,c) => n+c.merges,0),vines:chunks.reduce((n,c) => n+c.fibers.vines,0),attractors:chunks.reduce((n,c) => n+c.attractors,0),consumed:chunks.reduce((n,c) => n+c.consumed,0),worker,buildMilliseconds:payload.milliseconds,pipeline:payload.fullStudy?'filament-matter-full':payload.hero?'filament-matter-hero':payload.streamRegion?'streamed-filament-world':'world-organism',topology:payload.hero||payload.streamRegion?'global-flow-streamlines':'global-surface-network',loops:chunks.reduce((n,c) => n+c.loops,0),cells:chunks.reduce((n,c) => n+c.cells,0),primaryVertices:chunks.reduce((n,c) => n+c.veins.getAttribute('position').count,0),activeChunks:chunks.length,
    dispose:() => {streamDispose();tracers?.dispose();walkers.forEach(w=>w.dispose());walking.dispose();resources.forEach(resource => resource.dispose())}}
}
export function createForest(payload=generateForestPayload(createForestLayout())){return assembleForest(payload,false)}
export type Forest=ReturnType<typeof createForest>
export function createForestAsync(signal:AbortSignal):Promise<Forest> {
  if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'))
  if(typeof Worker==='undefined')return Promise.reject(new Error('Web Workers are required for Forest'))
  return createStreamedForest(signal,assembleForest)
}
export function animateForest(forest:Forest,dt:number,reduced:boolean,position?:THREE.Vector3) {
  if(position) {
    let active=0
    for(const chunk of forest.chunks){const distance=position.distanceTo(point(chunk.center));chunk.organ.visible=distance<230;if(chunk.organ.visible)active++;chunk.geometry.instanceCount=distance<85 ? chunk.fullCount : distance<145 ? chunk.fibers.primary+chunk.fibers.secondary : chunk.fibers.primary}
    forest.activeChunks=active
  }
  if(reduced)return
  forest.clock+=dt;forest.sway.t=.8+Math.sin(forest.clock*.4)*.2;HL.stepS(forest.sway,dt);forest.uniforms.clock.value=forest.clock;forest.uniforms.sway.value=forest.sway.x
}
export function sampleForest(forest:Forest,position:THREE.Vector3,forward:THREE.Vector3):FieldSample {
  const p=forest.geometry.getAttribute('position').array;let score=Infinity,chosen=-1
  for(let i=0;i<p.length;i+=3){const dx=p[i]-position.x,dy=p[i+1]-position.y,dz=p[i+2]-position.z,depth=dx*forward.x+dy*forward.y+dz*forward.z;if(depth<.5||depth>65)continue;const lateral=Math.sqrt(Math.max(0,dx*dx+dy*dy+dz*dz-depth*depth))/depth;if(lateral>.09)continue;const value=lateral*12+depth*.006;if(value<score){score=value;chosen=i}}
  const pnt=chosen<0 ? position.clone().setY(forestFloor(position.x,position.z)) : new THREE.Vector3().fromArray(p,chosen)
  return {point:pnt,distance:pnt.distanceTo(position),height:Math.max(0,pnt.y)/4,arc:position.z+position.x*.4,curvature:.35,crossings:.35,station:0}
}
