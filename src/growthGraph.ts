import {Vector3} from 'three'
import {seeded,type P} from './forestLayout.ts'
export type GrowthNode={position:P;parent:number;children:number[];flow:number;radius:number}
export type GrowthEdge={a:number;b:number;merge:boolean}
export type GrowthGraph={nodes:GrowthNode[];edges:GrowthEdge[];attractors:number;consumed:number;merges:number}
export type GrowthOptions={seeds:P[];attractors:P[];step:number;influence:number;kill:number;seed:number;maxNodes?:number;tropism?:P;maxRadius?:number}
const v=(p:P) => new Vector3(...p)

// Runions-style nearest-node attraction and kill distance, with tip splitting and anastomosis.
export function growGraph(options:GrowthOptions):GrowthGraph {
  const {step,influence,kill}=options,random=seeded(options.seed),nodes:GrowthNode[]=[],edges:GrowthEdge[]=[]
  const add=(p:P,parent:number) => {const id=nodes.length;nodes.push({position:p,parent,children:[],flow:1,radius:0});if(parent>=0){nodes[parent].children.push(id);edges.push({a:parent,b:id,merge:false})}return id}
  options.seeds.forEach((p,i) => add([...p],i-1))
  let remaining=options.attractors.map(v),consumed=0,merges=0
  const tropism=v(options.tropism ?? [0,.035,0]),limit=options.maxNodes ?? 1600
  const spatial=new Map<string,number[]>(),cell=step*1.6
  const key=(p:Vector3) => `${Math.floor(p.x/cell)},${Math.floor(p.y/cell)},${Math.floor(p.z/cell)}`
  const index=(id:number) => {const k=key(v(nodes[id].position)),bucket=spatial.get(k) ?? [];bucket.push(id);spatial.set(k,bucket)}
  nodes.forEach((_,i) => index(i))
  for(let iteration=0;iteration<110 && remaining.length && nodes.length<limit;iteration++) {
    const assignments=new Map<number,Vector3[]>(),next:Vector3[]=[]
    for(const attractor of remaining) {
      let nearest=-1,distance=influence*influence
      for(let i=0;i<nodes.length;i++) {
        const p=nodes[i].position,dx=p[0]-attractor.x,dy=p[1]-attractor.y,dz=p[2]-attractor.z,d=dx*dx+dy*dy+dz*dz
        if(d<distance){nearest=i;distance=d}
      }
      if(distance<kill*kill){consumed++;continue}
      next.push(attractor)
      if(nearest>=0 && nodes[nearest].children.length<4) {const bucket=assignments.get(nearest) ?? [];bucket.push(attractor);assignments.set(nearest,bucket)}
    }
    remaining=next
    let added=0
    for(const [parent,targets] of assignments) {
      if(nodes.length>=limit) break
      const origin=v(nodes[parent].position),mean=new Vector3()
      targets.forEach(p => mean.add(p.clone().sub(origin).normalize()));mean.normalize()
      const side=new Vector3().crossVectors(mean,new Vector3(0,1,.13)).normalize()
      const groups=targets.length>8 ? [targets.filter(p => p.clone().sub(origin).dot(side)>=0),targets.filter(p => p.clone().sub(origin).dot(side)<0)] : [targets]
      for(const group of groups) {
        if(!group.length || nodes.length>=limit || nodes[parent].children.length>=4) continue
        const direction=new Vector3();group.forEach(p => direction.add(p.clone().sub(origin).normalize()))
        direction.normalize().add(tropism)
        // A correlated spatial curl changes direction gently; no independent vertex jitter.
        direction.add(new Vector3(Math.sin(origin.z*.29+origin.y*.17),Math.sin(origin.x*.23)*.3,Math.cos(origin.x*.31+origin.y*.13)).multiplyScalar(.07)).normalize()
        if(nodes[parent].children.some(i => v(nodes[i].position).sub(origin).normalize().dot(direction)>.94)) continue
        const point=origin.clone().addScaledVector(direction,step*(.85+random()*.25))
        const cx=Math.floor(point.x/cell),cy=Math.floor(point.y/cell),cz=Math.floor(point.z/cell)
        let fusion=-1,best=step*step*.49
        const ancestors=new Set<number>();let ancestor=parent
        for(let j=0;j<4 && ancestor>=0;j++){ancestors.add(ancestor);ancestor=nodes[ancestor].parent}
        for(let x=-1;x<=1;x++) for(let y=-1;y<=1;y++) for(let z=-1;z<=1;z++) for(const id of spatial.get(`${cx+x},${cy+y},${cz+z}`) ?? []) {
          if(ancestors.has(id) || nodes[id].parent===parent || edges.some(e => e.merge && ((e.a===parent && e.b===id)||(e.b===parent && e.a===id)))) continue
          const d=point.distanceToSquared(v(nodes[id].position));if(d<best){best=d;fusion=id}
        }
        if(fusion>=0){edges.push({a:parent,b:fusion,merge:true});merges++;added++;continue}
        const id=add(point.toArray() as P,parent);index(id);added++
      }
    }
    if(!added) break
  }
  // Tree edges determine transported area; merge edges do not introduce recursion through cycles.
  for(let i=nodes.length-1;i>=0;i--) {const node=nodes[i];node.flow=node.children.length ? node.children.reduce((n,j) => n+nodes[j].flow,0) : 1}
  const rootFlow=nodes[0]?.flow ?? 1,maxRadius=options.maxRadius ?? .7
  for(const node of nodes) node.radius=maxRadius*Math.sqrt(node.flow/rootFlow)
  return {nodes,edges,attractors:options.attractors.length,consumed,merges}
}
