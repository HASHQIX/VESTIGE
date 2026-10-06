import {groundFilaments} from './filaments/groundFilaments.ts'
import {heroRegion} from './filaments/filamentField.ts'
import {bakeHeroFilaments,bakeWorldFilaments,bakeFilamentRegion,type HeroFilaments} from './filaments/filamentBake.ts'
import {filamentTransfers} from './filaments/filamentBuffers.ts'
import {buildWalkingSurface,type WalkingSurfaceData} from './forestSurface.ts'
import {worldSkeleton} from './worldSkeleton.ts'
import {worldSDF,surfaceHeight} from './worldSDF.ts'
import {worldSurface} from './worldSurface.ts'
import {fiberNetwork} from './fiberNetwork.ts'
import {packVeins,type PackedVeins} from './veinGeometry.ts'
import type {FiberPath} from './fiberField.ts'
import {type PackedBody} from './implicitBody.ts'
import {packFibers,type PackedFibers} from './fiberRenderer.ts'
import {forestFloor} from './forestNavigation.ts'
import type {ForestLayout,P} from './forestLayout.ts'
export type OrganChunk={id:number;center:P;body:PackedBody;fibers:PackedFibers;veins:PackedVeins;loops:number;cells:number;nodes:number;edges:number;merges:number;forks:number;attractors:number;consumed:number}
export type ForestPayload={fullStudy?:boolean;studyCache?:{hit:boolean;stored:boolean};ground?:HeroFilaments;streamRegion?:import('./filaments/filamentField.ts').FilamentRegion;hero?:HeroFilaments;matter?:HeroFilaments;chunks:OrganChunk[];walking:WalkingSurfaceData;decks:P[][];lights:{position:P;phase:number}[];components:number;elevatedMushrooms:number;milliseconds:number}
export function generateForestPayload(layout:ForestLayout,filamentPreview=false,streamRegion?:import('./filaments/filamentField.ts').FilamentRegion,fullStudy=false,stage?:(message:string)=>void):ForestPayload {
  if(fullStudy&&!filamentPreview)throw new Error('Full study requires filament preview mode')
  stage?.('Extracting the complete organic surface…')
  const start=performance.now(),skeleton=worldSkeleton(layout),volume=worldSDF(layout,skeleton),surface=worldSurface(volume,.4,streamRegion??(filamentPreview&&!fullStudy?heroRegion(layout):undefined));stage?.('Tracing organic filaments…');const hero=filamentPreview?(fullStudy?bakeWorldFilaments(layout,skeleton,volume,surface):bakeHeroFilaments(layout,skeleton,volume,surface)):undefined,network=filamentPreview||streamRegion?{components:0,paths:[] as FiberPath[],nodes:[],edges:[],loops:0,witnesses:0}:fiberNetwork(surface,volume,layout)
  if(filamentPreview&&!hero)throw new Error('Filament preview needs a root bridge')
  if(!filamentPreview&&!streamRegion&&network.components!==1)throw new Error(`World tissue has ${network.components} disconnected components`)
  const bins=new Map<string,{triangles:number[];paths:FiberPath[]}>(),key=(p:P)=>`${Math.floor(p[0]/24)},${Math.floor(p[2]/28)}`
  const bin=(k:string)=>{let b=bins.get(k);if(!b){b={triangles:[],paths:[]};bins.set(k,b)}return b}
  for(let i=0;i<surface.triangles.length;i+=3){const a=surface.positions[surface.triangles[i]],b=surface.positions[surface.triangles[i+1]],c=surface.positions[surface.triangles[i+2]],center:P=[(a[0]+b[0]+c[0])/3,(a[1]+b[1]+c[1])/3,(a[2]+b[2]+c[2])/3];bin(key(center)).triangles.push(surface.triangles[i],surface.triangles[i+1],surface.triangles[i+2])}
  for(const path of network.paths)bin(key(path.points[Math.floor(path.points.length/2)])).paths.push(path)
  const lights:{position:P;phase:number}[]=[]
  const chunks:OrganChunk[]=Array.from(bins.entries()).map(([k,bin],id)=>{
    const positions:number[]=[],normals:number[]=[],flow:number[]=[],species:number[]=[],indices:number[]=[],map=new Map<number,number>()
    for(const vertex of bin.triangles){let local=map.get(vertex);if(local===undefined){local=positions.length/3;map.set(vertex,local);const p=surface.positions[vertex];positions.push(...p);normals.push(...surface.normals[vertex]);flow.push(...p);species.push(0,8,0,0)}indices.push(local)}
    const ribbonPaths=bin.paths.filter(p=>p.rank>0);ribbonPaths.forEach((path,id)=>{if(path.loose)lights.push({position:path.points.at(-1)!,phase:id*.731})})
    const [x,z]=k.split(',').map(Number),center:P=[x*24+12,18,z*28+14],first=id===0
    return {id,center,body:{positions:new Float32Array(positions),normals:new Float32Array(normals),surface:new Float32Array(flow),species:new Float32Array(species),indices:new Uint32Array(indices)},fibers:packFibers(ribbonPaths),veins:packVeins(bin.paths),loops:first?network.loops:0,cells:first?network.nodes.length:0,nodes:first?network.nodes.length:0,edges:first?network.edges.length:0,merges:first?network.loops:0,forks:first?network.nodes.length:0,attractors:first?network.witnesses:0,consumed:first?network.witnesses:0}
  })
  const decks=layout.bridges.map(b=>b.points.map(([x,y,z])=>[x,surfaceHeight(volume,x,z,y),z] as P))
  stage?.('Weaving the ground…')
  const groundRegion=fullStudy?{min:[layout.bounds.minX,-20,layout.bounds.minZ] as P,max:[layout.bounds.maxX,volume.bounds.max[1],layout.bounds.maxZ] as P,center:hero!.region.center}:streamRegion
  return {fullStudy,ground:groundRegion?groundFilaments(groundRegion):undefined,streamRegion,hero,matter:filamentPreview?undefined:streamRegion?bakeFilamentRegion(layout,skeleton,volume,surface,streamRegion):bakeWorldFilaments(layout,skeleton,volume,surface),chunks,walking:fullStudy?{cells:new Map(),triangles:0}:buildWalkingSurface(chunks.map(c=>c.body)),decks,lights:lights.slice(0,450),components:network.components,elevatedMushrooms:layout.mushrooms.filter(m=>m.host!==undefined).length,milliseconds:performance.now()-start}
}
export function payloadTransfers(payload:ForestPayload):ArrayBuffer[] {
  const buffers:ArrayBuffer[]=[...(payload.ground?filamentTransfers(payload.ground.buffers):[]),...(payload.hero?filamentTransfers(payload.hero.buffers):[]),...(payload.matter?filamentTransfers(payload.matter.buffers):[])]
  for(const body of payload.chunks.map(c => c.body)) for(const array of Object.values(body)) buffers.push(array.buffer as ArrayBuffer)
  for(const chunk of payload.chunks) for(const array of [chunk.fibers.start,chunk.fibers.end,chunk.fibers.data,chunk.fibers.motion]) buffers.push(array.buffer as ArrayBuffer)
  for(const chunk of payload.chunks)for(const array of Object.values(chunk.veins))buffers.push(array.buffer as ArrayBuffer)
  for(const array of payload.walking.cells.values())buffers.push(array.buffer as ArrayBuffer)
  return buffers
}
