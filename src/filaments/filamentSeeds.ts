import {Vector3} from 'three'
import {seeded,type P} from '../forestLayout.ts'
import {forestFloor} from '../forestNavigation.ts'
import type {WorldSurface} from '../worldSurface.ts'
import type {FilamentField} from './filamentField.ts'
export type FilamentSeed={position:P;iso:number;rank:number;depth:number;seed:number}
export function filamentSeeds(surface:WorldSurface,field:FilamentField,budgets=[160,2400,8500],worldSeed=6006,maximumDensity=Infinity):FilamentSeed[] {
  const triangles:{a:P;b:P;c:P;area:number}[]=[],random=seeded(worldSeed);let area=0
  for(let i=0;i<surface.triangles.length;i+=3){const [a,b,c]=surface.triangles.slice(i,i+3).map(id=>surface.positions[id]),mid=new Vector3(...a).add(new Vector3(...b)).add(new Vector3(...c)).multiplyScalar(1/3)
    if(!field.inside(mid,.5)||mid.y<forestFloor(mid.x,mid.z)+.45)continue
    const weight=new Vector3(...b).sub(new Vector3(...a)).cross(new Vector3(...c).sub(new Vector3(...a))).length()*.5
    area+=weight;triangles.push({a,b,c,area})
  }
  if(!triangles.length)return []
  const seeds:FilamentSeed[]=[]
  const densityScale=Math.min(1,area*maximumDensity/budgets.reduce((sum,n)=>sum+n,0))
  budgets.forEach((budget,rank)=>{
    const count=Math.floor(budget*densityScale)
    const spacing=rank===0? 0.8:rank===1? 0.2: 0.075,bins=new Map<string,Vector3[]>(),cell=spacing
    for(let attempt=0,accepted=0;attempt<count*12&&accepted<count;attempt++){
      const pick=random()*area;let lo=0,hi=triangles.length-1
      while(lo<hi){const mid=(lo+hi)>>1;if(triangles[mid].area<pick)lo=mid+1;else hi=mid}
      const triangle=triangles[lo],u=Math.sqrt(random()),v=random(),p=new Vector3(...triangle.a).multiplyScalar(1-u).addScaledVector(new Vector3(...triangle.b),u*(1-v)).addScaledVector(new Vector3(...triangle.c),u*v)
      const coords=p.toArray().map(a=>Math.floor(a/cell));let close=false
      for(let z=-1;z<=1&&!close;z++)for(let y=-1;y<=1&&!close;y++)for(let x=-1;x<=1&&!close;x++)close=(bins.get(`${coords[0]+x},${coords[1]+y},${coords[2]+z}`)??[]).some(q=>q.distanceToSquared(p)<spacing*spacing)
      if(close)continue
      const key=coords.join(','),list=bins.get(key)??[];list.push(p);bins.set(key,list)
      const choice=random(),depth=choice<.55?0:choice<.85?1:2,iso=depth===0? 0.025:depth===1?-(.12+random()*.68): 0.12+random()*.50
      const position=field.project(p,iso)
      if(!field.inside(position)||Math.abs(field.distance(position)-iso)>.07)continue
      seeds.push({position:position.toArray() as P,iso,rank,depth,seed:random()});accepted++
    }
  })
  return seeds
}
