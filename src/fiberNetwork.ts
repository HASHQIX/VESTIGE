import {CatmullRomCurve3,CubicBezierCurve3,Vector3} from 'three'
import {seeded,crownOf,type ForestLayout,type P} from './forestLayout.ts'
import type {WorldSurface} from './worldSurface.ts'
import type {WorldVolume} from './worldSDF.ts'
import type {FiberPath} from './fiberField.ts'
export type FiberNode={position:P;normal:P;witness:number}
export type FiberEdge={a:number;b:number;route:number[];load:number}
export type WorldFibers={nodes:FiberNode[];edges:FiberEdge[];paths:FiberPath[];components:number;loops:number;witnesses:number}
class Heap {
  values:{id:number;cost:number}[]=[]
  push(id:number,cost:number){const item={id,cost},a=this.values;let i=a.length;a.push(item);while(i){const parent=(i-1)>>1;if(a[parent].cost<=cost)break;a[i]=a[parent];i=parent}a[i]=item}
  pop(){const a=this.values,top=a[0],tail=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let j=i*2+1;if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;if(a[j].cost>=tail.cost)break;a[i]=a[j];i=j}a[i]=tail}return top}
  get length(){return this.values.length}
}
// A global, irregular geodesic cell network. No UV atlas or pattern restarts at organ boundaries.
export function fiberNetwork(surface:WorldSurface,volume:WorldVolume,layout:ForestLayout):WorldFibers {
  const random=seeded(267813),witnesses:{position:Vector3;normal:Vector3;count:number;neighbors:Set<number>}[]=[],clusters=new Map<string,number>(),mapping=new Uint32Array(surface.positions.length)
  surface.positions.forEach((p,i)=>{
    const normal=new Vector3(...surface.normals[i]),axis=Math.abs(normal.x)>Math.abs(normal.y)?(Math.abs(normal.x)>Math.abs(normal.z)?0:2):(Math.abs(normal.y)>Math.abs(normal.z)?1:2),sign=surface.normals[i][axis]<0?0:1
    const key=`${Math.floor(p[0]/.58)},${Math.floor(p[1]/.58)},${Math.floor(p[2]/.58)},${axis*2+sign}`
    let id=clusters.get(key)
    if(id===undefined){id=witnesses.length;clusters.set(key,id);witnesses.push({position:new Vector3(),normal:new Vector3(),count:0,neighbors:new Set()})}
    const w=witnesses[id];w.position.add(new Vector3(...p));w.normal.add(normal);w.count++;mapping[i]=id
  })
  witnesses.forEach(w=>{w.position.divideScalar(w.count);w.normal.normalize()})
  for(let i=0;i<surface.triangles.length;i+=3){const a=mapping[surface.triangles[i]],b=mapping[surface.triangles[i+1]],c=mapping[surface.triangles[i+2]];for(const [x,y] of [[a,b],[b,c],[c,a]])if(x!==y){witnesses[x].neighbors.add(y);witnesses[y].neighbors.add(x)}}
  const order=witnesses.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  const nodes:FiberNode[]=[],siteGrid=new Map<string,number[]>(),spacing=1.2,keyOf=(p:Vector3)=>`${Math.floor(p.x/spacing)},${Math.floor(p.y/spacing)},${Math.floor(p.z/spacing)}`
  for(const id of order){const w=witnesses[id],p=w.position;let occupied=false;const x=Math.floor(p.x/spacing),y=Math.floor(p.y/spacing),z=Math.floor(p.z/spacing),radius=.65+random()*.6
    for(let dx=-1;dx<=1&&!occupied;dx++)for(let dy=-1;dy<=1&&!occupied;dy++)for(let dz=-1;dz<=1&&!occupied;dz++)for(const site of siteGrid.get(`${x+dx},${y+dy},${z+dz}`)??[]){const n=nodes[site];if(w.normal.dot(new Vector3(...n.normal))>-.15&&p.distanceToSquared(new Vector3(...n.position))<radius*radius){occupied=true;break}}
    if(occupied)continue
    const position=volume.project(p).toArray() as P,site=nodes.length;nodes.push({position,normal:w.normal.toArray() as P,witness:id});const key=keyOf(p),list=siteGrid.get(key)??[];list.push(site);siteGrid.set(key,list)
  }
  const owner=new Int32Array(witnesses.length).fill(-1),distance=new Float64Array(witnesses.length).fill(Infinity),parent=new Int32Array(witnesses.length).fill(-1),heap=new Heap(),directions=nodes.map(n=>volume.flow(new Vector3(...n.position)))
  nodes.forEach((n,id)=>{owner[n.witness]=id;distance[n.witness]=0;heap.push(n.witness,0)})
  while(heap.length){const {id,cost}=heap.pop();if(cost!==distance[id])continue;const w=witnesses[id],flow=directions[owner[id]]
    for(const neighbor of w.neighbors){const delta=witnesses[neighbor].position.clone().sub(w.position),length=delta.length(),alignment=Math.abs(delta.normalize().dot(flow)),next=cost+length*(1.25-.60*alignment)
      if(next<distance[neighbor]){distance[neighbor]=next;owner[neighbor]=owner[id];parent[neighbor]=id;heap.push(neighbor,next)}}
  }
  const edges:FiberEdge[]=[],boundaries=new Map<string,{a:number;b:number;x:number;y:number;cost:number}>()
  witnesses.forEach((w,x)=>{for(const y of w.neighbors){const a=owner[x],b=owner[y];if(a===b||a<0||b<0)continue;const key=a<b?`${a}:${b}`:`${b}:${a}`,cost=distance[x]+distance[y]+w.position.distanceTo(witnesses[y].position),old=boundaries.get(key);if(!old||cost<old.cost)boundaries.set(key,{a,b,x,y,cost})}})
  const trace=(id:number)=>{const result:number[]=[];for(let i=id;i>=0;i=parent[i])result.push(i);return result}
  for(const {a,b,x,y} of boundaries.values())edges.push({a,b,route:[...trace(x).reverse(),...trace(y)],load:0})
  const adjacency:number[][]=nodes.map(()=>[]);edges.forEach((e,id)=>{adjacency[e.a].push(id);adjacency[e.b].push(id)})
  let components=0;const seen=new Uint8Array(nodes.length)
  for(let i=0;i<nodes.length;i++)if(!seen[i]){components++;seen[i]=1;const queue=[i];for(let at=0;at<queue.length;at++)for(const edge of adjacency[queue[at]]){const e=edges[edge],to=e.a===queue[at]?e.b:e.a;if(!seen[to]){seen[to]=1;queue.push(to)}}}
  const nearest=(p:P)=>{let best=Infinity,id=0;nodes.forEach((n,i)=>{const d=new Vector3(...n.position).distanceToSquared(new Vector3(...p));if(d<best){best=d;id=i}});return id}
  // Shared routes across hubs, stems and crowns thicken into one primary vascular system.
  const source=nearest(layout.nodes[0]??(layout.mushrooms[0]?crownOf(layout.mushrooms[0]):[0,0,0])),costs=new Float64Array(nodes.length).fill(Infinity),previous=new Int32Array(nodes.length).fill(-1),routes=new Heap();costs[source]=0;routes.push(source,0)
  while(routes.length){const {id,cost}=routes.pop();if(cost!==costs[id])continue;for(const edge of adjacency[id]){const e=edges[edge],to=e.a===id?e.b:e.a,next=cost+new Vector3(...nodes[id].position).distanceTo(new Vector3(...nodes[to].position))*(.85+((edge*17)%13)/40);if(next<costs[to]){costs[to]=next;previous[to]=edge;routes.push(to,next)}}}
  for(const target of [...layout.nodes,...layout.mushrooms.map(crownOf)]){let id=nearest(target);const visited=new Set<number>();while(id!==source&&previous[id]>=0&&!visited.has(id)){visited.add(id);const e=edges[previous[id]];e.load++;id=e.a===id?e.b:e.a}}
  // Keep the shared transport tree, then thin redundant separators into unequal organic cells.
  // Keeping every tree edge proves connectivity; degree >= 2 prevents clipped structural tips.
  const tree=new Set(Array.from(previous).filter(id=>id>=0)),degree=adjacency.map(a=>a.length)
  const retained=edges.filter((e,id)=>{if(e.load||tree.has(id)||degree[e.a]<=2||degree[e.b]<=2||random()<.32)return true;degree[e.a]--;degree[e.b]--;return false})
  edges.length=0;for(const edge of retained)edges.push(edge)
  const paths:FiberPath[]=[],normals=nodes.map(n=>volume.normal(new Vector3(...n.position)))
  const makePath=(route:number[],a:number,b:number,rank:number,width:number,phase:number):FiberPath => {
    const control=route.map(id=>witnesses[id].position.clone());control[0]=new Vector3(...nodes[a].position);control[control.length-1]=new Vector3(...nodes[b].position)
    // Smooth the mesh witness path; projection keeps it on the single world surface.
    for(let pass=0;pass<4;pass++){const copy=control.map(p=>p.clone());for(let i=1;i<control.length-1;i++)control[i].copy(copy[i]).multiplyScalar(.5).addScaledVector(copy[i-1],.25).addScaledVector(copy[i+1],.25)}
    if(control.length<2)control.push(control[0].clone())
    const start=control[0],end=control.at(-1)!,chord=end.clone().sub(start),length=chord.length(),axis=(id:number)=>{const v=directions[id].clone();if(v.lengthSq()<.01)v.copy(chord).normalize();if(v.dot(chord)<0)v.negate();return v.multiplyScalar(Math.min(1.3,length*.38))}
    const curve=length<4.5 ? new CubicBezierCurve3(start,start.clone().add(axis(a)),end.clone().sub(axis(b)),end) : new CatmullRomCurve3(control),steps=Math.max(4,Math.ceil(curve.getLength()/.28)),points:P[]=[],widths:number[]=[]
    for(let i=0;i<=steps;i++){const t=i/steps,p=curve.getPoint(t),at=t*(route.length-1),left=Math.min(route.length-2,Math.floor(at)),normal=(i===0?normals[a].clone():i===steps?normals[b].clone():witnesses[route[Math.max(0,left)]].normal.clone().lerp(witnesses[route[Math.min(route.length-1,left+1)]].normal,at-left).normalize()),tangent=curve.getTangent(t),side=new Vector3().crossVectors(normal,tangent).normalize(),envelope=Math.sin(Math.PI*t)**2
      p.addScaledVector(side,envelope*(.10*Math.sin(t*5+phase)+.022*Math.sin(t*19+phase)))
      for(let pass=0;pass<3;pass++)p.addScaledVector(normal,-Math.max(-.3,Math.min(.3,volume.field(p))))
      if(Math.abs(volume.field(p))>.012){p.copy(volume.project(p));normal.copy(volume.normal(p))}
      // True shared endpoints. The lifted centreline is identical for every incident fibre.
      if(i===0)p.fromArray(nodes[a].position);if(i===steps)p.fromArray(nodes[b].position)
      p.addScaledVector(normal,.04);points.push(p.toArray() as P);widths.push(width*(.8+.20*Math.sin(t*Math.PI+phase)**2))
    }
    return {points,widths,hue:0,rank,loose:false}
  }
  const primaryAdj:number[][]=nodes.map(()=>[]);edges.forEach((e,id)=>{if(e.load){primaryAdj[e.a].push(id);primaryAdj[e.b].push(id)}})
  const used=new Set<number>()
  const follow=(start:number,first:number)=>{let node=start,edge=first;const route:number[]=[];let load=0
    while(!used.has(edge)){used.add(edge);const e=edges[edge],forward=e.a===node,part=forward?e.route:[...e.route].reverse();route.push(...(route.length?part.slice(1):part));load=Math.max(load,e.load);node=forward?e.b:e.a;if(primaryAdj[node].length!==2||degree[node]!==2)break;edge=primaryAdj[node].find(id=>!used.has(id))??edge}
    paths.push(makePath(route,start,node,0,.030+Math.min(.065,Math.sqrt(load)*.009),first*.91))
  }
  // A secondary vessel must join the exact primary endpoint, not a smoothed pass-through curve.
  primaryAdj.forEach((list,node)=>{if(list.length!==2||degree[node]!==2)for(const edge of list)if(!used.has(edge))follow(node,edge)})
  edges.forEach((e,id)=>{if(e.load&&!used.has(id))follow(e.a,id);else if(!e.load)paths.push(makePath(e.route,e.a,e.b,1,.012+.018*random(),id*.91))})
  // Fine split/rejoin loops use the SAME endpoints; they never stop at an object seam.
  edges.forEach((e,id)=>{if(id%4===0){const p=makePath(e.route,e.a,e.b,2,.006+random()*.009,id*.91+2.7);paths.push(p)}})
  // Hanging vines are intentionally open, attached to real junctions and tapered at their free tips.
  const anchors=nodes.map((n,id)=>({n,id})).filter(({n,id})=>normals[id].y<.3&&n.position[1]>5)
  for(let k=0;k<Math.min(900,anchors.length);k++){const {n,id}=anchors[Math.floor(random()*anchors.length)],top=new Vector3(...n.position).addScaledVector(normals[id],.04),length=1.3+random()*Math.min(12,n.position[1]-1),points:P[]=[],widths:number[]=[],phase=random()*6
    for(let i=0;i<=24;i++){const t=i/24;points.push([top.x+Math.sin(t*3+phase)*.35*t,top.y-length*t,top.z+Math.sin(t*5+phase)*.24*t]);widths.push(.013*(1-t)**.7)}
    paths.push({points,widths,hue:0,rank:2,loose:true})
  }
  paths.sort((a,b)=>a.rank-b.rank)
  return {nodes,edges,paths,components,loops:edges.length-nodes.length+components,witnesses:witnesses.length}
}
