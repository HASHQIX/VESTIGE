import {seeded} from './forestLayout.ts'
export type UV=[number,number]
export type CellNode={uv:UV}
export type CellEdge={a:number;b:number;load:number;level:number;source?:'cell'|'growth'}
export type CellNetwork={nodes:CellNode[];edges:CellEdge[];length:number;period:number;cells:number}
const wrap=(v:number,p:number) => ((v%p)+p)%p
export const periodicDelta=(a:number,b:number,p:number) => {let d=b-a;d-=Math.round(d/p)*p;return d}

// Blue-noise rejection in a stretched surface metric, periodic across the atlas seam.
export function surfaceSites(length:number,period:number,count:number,stretch:number,seed:number):UV[] {
  const random=seeded(seed),sites:UV[]=[],spacing=Math.sqrt(length/stretch*period/count)*.56
  for(let attempt=0;attempt<count*100 && sites.length<count;attempt++) {
    const p:UV=[random()*length,random()*period]
    if(sites.every(q => Math.hypot((p[0]-q[0])/stretch,periodicDelta(p[1],q[1],period))>spacing))sites.push(p)
  }
  return sites
}
function clip(poly:UV[],nx:number,ny:number,c:number):UV[] {
  const result:UV[]=[]
  for(let i=0;i<poly.length;i++) {
    const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny-c,db=b[0]*nx+b[1]*ny-c
    if(da<=1e-9)result.push(a)
    if((da<0)!==(db<0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}
  }
  return result
}
export function cellNetwork(length:number,period:number,count:number,stretch:number,seed:number):CellNetwork {
  const random=seeded(seed+81),sites=surfaceSites(length,period,count,stretch,seed),nodes:CellNode[]=[],edges:CellEdge[]=[],keys=new Map<string,number>(),edgeKeys=new Set<string>()
  const node=(p:UV) => {
    const uv:UV=[p[0]*stretch,wrap(p[1],period)],key=`${Math.round(uv[0]*1e5)},${Math.round(uv[1]*1e5)%Math.round(period*1e5)}`
    const known=keys.get(key);if(known!==undefined)return known
    const id=nodes.length;nodes.push({uv});keys.set(key,id);return id
  }
  // Each periodic seed has three images; shared clipped vertices are welded before any warp.
  const metric=sites.map(([x,y]):UV => [x/stretch,y]),extent=length/stretch
  for(const s of metric) for(const image of [-1,0,1]) {
    const p:UV=[s[0],s[1]+image*period];let poly:UV[]=[[0,0],[extent,0],[extent,period],[0,period]]
    for(const q0 of metric) for(const shift of [-1,0,1]) {
      const q:UV=[q0[0],q0[1]+shift*period],nx=q[0]-p[0],ny=q[1]-p[1]
      if(Math.abs(nx)+Math.abs(ny)<1e-10)continue
      poly=clip(poly,nx,ny,(q[0]**2+q[1]**2-p[0]**2-p[1]**2)*.5)
      if(!poly.length)break
    }
    for(let i=0;i<poly.length;i++) {
      const a=poly[i],b=poly[(i+1)%poly.length]
      // Atlas boundaries are artificial; the periodic cell on the other side supplies the real edge.
      if((Math.abs(a[1])<1e-7 && Math.abs(b[1])<1e-7)||(Math.abs(a[1]-period)<1e-7 && Math.abs(b[1]-period)<1e-7))continue
      const ia=node(a),ib=node(b);if(ia===ib)continue
      const key=[ia,ib].sort((a,b) => a-b).join(',');if(edgeKeys.has(key))continue
      edgeKeys.add(key);edges.push({a:ia,b:ib,load:0,level:1,source:'cell'})
    }
  }
  // Remove shared separators to merge adjacent cells, while never creating dangling structural ends.
  const degree=nodes.map(() => 0);edges.forEach(e => {degree[e.a]++;degree[e.b]++})
  const adj=nodes.map(() => new Set<number>());edges.forEach(e => {adj[e.a].add(e.b);adj[e.b].add(e.a)})
  const kept=edges.filter(e => {
    if(degree[e.a]<=2 || degree[e.b]<=2 || random()>=.24)return true
    adj[e.a].delete(e.b);adj[e.b].delete(e.a)
    const seen=new Set([e.a]),stack=[e.a]
    while(stack.length && !seen.has(e.b))for(const next of adj[stack.pop()!])if(!seen.has(next)){seen.add(next);stack.push(next)}
    if(seen.has(e.b)){degree[e.a]--;degree[e.b]--;return false}
    adj[e.a].add(e.b);adj[e.b].add(e.a);return true
  })
  return {nodes,edges:kept,length,period,cells:sites.length}
}
// Promote routes inside the same cellular graph. Forks/joins share nodes rather than overlaying cables.
export function primaryRoutes(network:CellNetwork,count:number) {
  const {nodes,edges,length,period}=network,adj=nodes.map(() => [] as {node:number;edge:number;cost:number}[])
  edges.forEach((e,id) => {const a=nodes[e.a].uv,b=nodes[e.b].uv,cost=Math.hypot(b[0]-a[0],periodicDelta(a[1],b[1],period)*1.25)*(1+.25*Math.sin(id*1.731)**2);adj[e.a].push({node:e.b,edge:id,cost});adj[e.b].push({node:e.a,edge:id,cost})})
  const nearest=(x:number,y:number) => {let best=Infinity,id=0;nodes.forEach((n,i) => {const d=(n.uv[0]-x)**2+periodicDelta(y,n.uv[1],period)**2;if(d<best){best=d;id=i}});return id}
  for(let route=0;route<count;route++) {
    const source=nearest(0,(route+.3)/count*period),target=nearest(length,(route+.7)/count*period),distance=nodes.map(() => Infinity),parent=nodes.map(() => -1),via=nodes.map(() => -1),visited=new Set<number>()
    distance[source]=0
    for(let iteration=0;iteration<nodes.length;iteration++) {
      let current=-1,best=Infinity;distance.forEach((d,i) => {if(!visited.has(i)&&d<best){best=d;current=i}})
      if(current<0 || current===target)break
      visited.add(current)
      for(const e of adj[current])if(best+e.cost<distance[e.node]){distance[e.node]=best+e.cost;parent[e.node]=current;via[e.node]=e.edge}
    }
    for(let at=target;parent[at]>=0;at=parent[at]){edges[via[at]].load++;edges[via[at]].level=0}
  }
}
