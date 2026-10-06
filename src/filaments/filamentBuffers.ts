import {BufferAttribute,BufferGeometry} from 'three'
import type {FilamentPath} from './filamentTracer.ts'
export type PackedFilaments={position:Float32Array;previous:Float32Array;next:Float32Array;flow:Float32Array;data:Float32Array;meta:Float32Array;indices:Uint32Array;paths:number;counts:number[];depths:number[]}
export function packFilaments(paths:FilamentPath[]):PackedFilaments {
  const vertices=paths.reduce((n,p)=>n+p.points.length*2,0),indexCount=paths.reduce((n,p)=>n+Math.max(0,p.points.length-1)*6,0)
  const position=new Float32Array(vertices*3),previous=new Float32Array(vertices*3),next=new Float32Array(vertices*3),flow=new Float32Array(vertices*3),data=new Float32Array(vertices*4),meta=new Float32Array(vertices*4),indices=new Uint32Array(indexCount),counts=[0,0,0],depths=[0,0,0]
  let vertex=0,index=0
  for(const path of [...paths].sort((a,b)=>a.rank-b.rank)){
    const base=vertex,total=path.arcs.at(-1)!,width=path.rank===0?1.7+path.seed*1.1:path.rank===1? 0.72+path.seed*.5: 0.32+path.seed*.3
    counts[path.rank]++;depths[path.depth]++
    path.points.forEach((p,i)=>{
      const prev=path.points[Math.max(0,i-1)],after=path.points[Math.min(path.points.length-1,i+1)],t=path.arcs[i]/total,taper=Math.min(1,t*8,(1-t)*8),w=width*(.18+.82*taper)*(1+.12*Math.sin(path.arcs[i]*.6+path.seed*6))
      for(const side of [-1,1]){
        const a=vertex*3,b=vertex*4
        for(let k=0;k<3;k++){position[a+k]=p[k];previous[a+k]=prev[k];next[a+k]=after[k];flow[a+k]=after[k]-prev[k]}
        data[b]=side;data[b+1]=w;data[b+2]=path.arcs[i];data[b+3]=path.seed
        meta[b]=path.rank;meta[b+1]=path.depth;meta[b+2]=path.iso;meta[b+3]=total;vertex++
      }
      if(i<path.points.length-1){const v=base+i*2;indices[index++]=v;indices[index++]=v+2;indices[index++]=v+1;indices[index++]=v+2;indices[index++]=v+3;indices[index++]=v+1}
    })
  }
  return {position,previous,next,flow,data,meta,indices,paths:paths.length,counts,depths}
}
export type FilamentPacking='legacy'|'rank'|'tangent'|'instanced'
export function filamentGeometry(packed:PackedFilaments,packing:Exclude<FilamentPacking,'instanced'>='rank') {
  const geometry=new BufferGeometry()
  for(const name of ['position','previous','next'] as const)geometry.setAttribute(name,new BufferAttribute(packed[name],3))
  if(packing!=='tangent')geometry.setAttribute('flow',new BufferAttribute(packed.flow,3))
  geometry.setAttribute('data',new BufferAttribute(packed.data,4))
  // Only rank is consumed by the ribbon shader; depth/iso/path length stay in
  // the bake payload for CPU tooling, not in every GPU vertex attribute.
  const levels=new Float32Array(packed.meta.length/4)
  for(let i=0;i<levels.length;i++)levels[i]=packed.meta[i*4]
  if(packing==='legacy')geometry.setAttribute('meta',new BufferAttribute(packed.meta,4))
  else geometry.setAttribute('level',new BufferAttribute(levels,1))
  geometry.userData.filamentPacking=packing
  geometry.setIndex(new BufferAttribute(packed.indices,1));geometry.computeBoundingSphere();return geometry
}
export function filamentTransfers(packed:PackedFilaments):ArrayBuffer[]{return ['position','previous','next','flow','data','meta','indices'].map(name=>packed[name as 'position'].buffer as ArrayBuffer)}
