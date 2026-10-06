import {Vector3} from 'three'
import type {P} from '../forestLayout.ts'
import type {FilamentField} from './filamentField.ts'
import type {FilamentSeed} from './filamentSeeds.ts'
export type FilamentPath=FilamentSeed&{points:P[];arcs:number[]}
export function traceFilament(field:FilamentField,seed:FilamentSeed):FilamentPath|undefined {
  const step=seed.rank===2? 0.46: 0.36,length=(seed.rank===0?28:seed.rank===1?14:7)*(1+seed.seed),origin=new Vector3(...seed.position)
  const trace=(sign:number)=>{
    const points:Vector3[]=[origin.clone()];let p=origin.clone(),previous:Vector3|undefined,travel=0
    for(let i=0;i<160&&travel<length*.5;i++){
      const a=field.flow(p).multiplyScalar(sign);if(a.lengthSq()<.2)break
      if(previous&&a.dot(previous)<0)a.negate()
      const mid=p.clone().addScaledVector(a,step*.5),b=field.flow(mid).multiplyScalar(sign);if(b.dot(a)<0)b.negate()
      if(b.lengthSq()<.2||b.dot(a)<.35)break
      const next=field.project(p.clone().addScaledVector(b,step),seed.iso),distance=next.distanceTo(p)
      if(!field.inside(next,.1)||Math.abs(field.distance(next)-seed.iso)>.09||distance<step*.25||distance>step*1.8)break
      if(points.some((q,j)=>j<points.length-6&&q.distanceToSquared(next)<step*step*.6))break
      points.push(next);travel+=distance;previous=b;p=next
    }
    return points
  }
  const backward=trace(-1),forward=trace(1),points=[...backward.reverse().slice(0,-1),...forward]
  if(points.length<6)return undefined
  const arcs=[0];for(let i=1;i<points.length;i++)arcs.push(arcs[i-1]+points[i].distanceTo(points[i-1]))
  return {...seed,points:points.map(p=>p.toArray() as P),arcs}
}
