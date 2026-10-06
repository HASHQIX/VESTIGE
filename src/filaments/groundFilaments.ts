import {Vector3} from 'three'
import {forestFloor} from '../forestNavigation.ts'
import type {P} from '../forestLayout.ts'
import type {FilamentRegion} from './filamentField.ts'
import type {FilamentPath} from './filamentTracer.ts'
import {packFilaments} from './filamentBuffers.ts'

// World-anchored half-metre cells: consistent dense ground coverage in every region.
export function groundFilaments(region:FilamentRegion){
 const paths:FilamentPath[]=[]
 const hash=(x:number,z:number)=>{const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v)}
 for(let x=Math.ceil(region.min[0]*2);x<=Math.floor(region.max[0]*2);x++)for(let z=Math.ceil(region.min[2]*2);z<=Math.floor(region.max[2]*2);z++){
  const seed=hash(x,z),cx=x*.5+(hash(x+9,z)-.5)*.35,cz=z*.5+(hash(x,z+13)-.5)*.35,y=forestFloor(cx,cz)+.06
  if(y<region.min[1]+.15||y>region.max[1]-.15)continue
  const angle=seed*Math.PI*2,length=2+hash(x-3,z+4)*4,points:P[]=[],arcs:number[]=[]
  for(let i=0;i<=10;i++){
   const t=(i/10-.5)*length,wave=.28*Math.sin(t*1.1+seed*31),px=cx+Math.cos(angle)*t-Math.sin(angle)*wave,pz=cz+Math.sin(angle)*t+Math.cos(angle)*wave
   if(px<region.min[0]||px>region.max[0]||pz<region.min[2]||pz>region.max[2])continue
   const p:P=[px,forestFloor(px,pz)+.06,pz];arcs.push(points.length?arcs.at(-1)!+new Vector3(...points.at(-1)!).distanceTo(new Vector3(...p)):0);points.push(p)
  }
  if(points.length>3)paths.push({position:points[0],points,arcs,seed,rank:seed>.98?0:seed>.72?1:2,depth:2,iso:.06})
 }
 return {region,buffers:packFilaments(paths)}
}
