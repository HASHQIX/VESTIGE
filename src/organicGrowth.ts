import {seeded,type OrganShape,type P} from './forestLayout.ts'
import {growGraph,type GrowthGraph} from './growthGraph.ts'
import {cellNetwork,periodicDelta,primaryRoutes,type CellNetwork,type UV} from './cellNetwork.ts'
import {surfaceFlow,type SurfaceFlow} from './surfaceFlow.ts'
import {attachTip,capillaryLoops} from './anastomosis.ts'
import type {FiberPath} from './fiberField.ts'
export type VascularNetwork={network:CellNetwork;flow:SurfaceFlow;paths:FiberPath[];loops:number;forks:number}
function addCapGrowth(net:CellNetwork,flow:SurfaceFlow,shape:Extract<OrganShape,{kind:'mushroom'}>) {
  const random=seeded(shape.id*421+193),r=shape.radius,attractors:P[]=[]
  for(let i=0;i<(r>8 ? 230 : 85);i++){const a=random()*Math.PI*2,d=r*Math.sqrt(random())*.94;attractors.push([Math.cos(a)*d,0,Math.sin(a)*d])}
  const graph=growGraph({seeds:[[0,0,0]],attractors,seed:shape.id+419,step:r*.07,influence:r*.65,kill:r*.065,maxNodes:650,tropism:[0,0,0],maxRadius:.2}),offset=net.nodes.length
  graph.nodes.forEach(n => {const radius=Math.min(.97,Math.hypot(n.position[0],n.position[2])/r),angle=Math.atan2(n.position[2],n.position[0]);net.nodes.push({uv:[flow.rim+r*(1-radius),angle/(Math.PI*2)*flow.period]})})
  graph.edges.forEach(e => net.edges.push({a:offset+e.a,b:offset+e.b,load:graph.nodes[e.b].flow/graph.nodes[0].flow*7,level:graph.nodes[e.b].flow>8 ? 0 : 2,source:'growth'}))
  // Only connect tips to the pre-existing cellular web, not back to the same just-grown tree.
  const tips=graph.nodes.map((n,i) => !n.children.length ? offset+i : -1).filter(i => i>=0)
  for(const tip of tips)attachTip(net,tip)
}
function addGills(net:CellNetwork,flow:SurfaceFlow,seed:number) {
  const random=seeded(seed),count=flow.scale>8 ? 32 : 14,rows:number[][]=[]
  for(let k=0;k<count;k++) {
    const angle=(k+random()*.85)/count*flow.period,end=.76+random()*.24,row:number[]=[]
    for(let i=0;i<8;i++) {
      const t=i/7,x=flow.stemEnd+(end-.23)*flow.scale*t,y=angle+flow.scale*.022*Math.sin(t*7+k)
      const id=net.nodes.length;net.nodes.push({uv:[x,y]});row.push(id)
      if(i)net.edges.push({a:row[i-1],b:id,load:0,level:1,source:'growth'})
    }
    rows.push(row)
  }
  rows.forEach((row,k) => {
    attachTip(net,row[0]);attachTip(net,row[7])
    const next=rows[(k+1)%rows.length]
    net.edges.push({a:row[2+Math.floor(random()*3)],b:next[5+Math.floor(random()*2)],load:0,level:2,source:'growth'})
  })
}
export function organicGrowth(shape:OrganShape,graph:GrowthGraph):VascularNetwork {
  const flow=surfaceFlow(shape,graph),big=flow.scale>8,network=cellNetwork(flow.length,flow.period,shape.kind==='bridge' ? Math.round(flow.length*2.5) : big ? 190 : 80,shape.kind==='bridge' ? 3.3 : 1.8,shape.id*781+102)
  primaryRoutes(network,shape.kind==='bridge' ? 7 : 6)
  if(shape.kind==='mushroom'){addCapGrowth(network,flow,shape);addGills(network,flow,shape.id*887+342)}
  capillaryLoops(network,shape.id*391+74)
  const random=seeded(shape.id*113+62),paths:FiberPath[]=[]
  const warped=network.nodes.map(n => flow.warp(n.uv)),positions=warped.map(flow.point),adj=network.nodes.map(() => [] as number[])
  network.edges.forEach(e => {adj[e.a].push(e.b);adj[e.b].push(e.a)})
  const tangent=(node:number,target:number):UV => {
    const a=warped[node],b=warped[target],dx=b[0]-a[0],dy=periodicDelta(a[1],b[1],flow.period),length=Math.hypot(dx,dy)||1
    let other:UV=[0,0],best=0
    for(const next of adj[node])if(next!==target){const p=warped[next],x=p[0]-a[0],y=periodicDelta(a[1],p[1],flow.period),l=Math.hypot(x,y)||1,score=-(x*dx+y*dy)/(l*length);if(score>best){best=score;other=[x/l,y/l]}}
    const x=dx/length-other[0],y=dy/length-other[1],l=Math.hypot(x,y)||1;return [x/l,y/l]
  }
  for(const edge of network.edges) {
    if(edge.a===edge.b)continue
    const a=warped[edge.a],b=warped[edge.b],dx=b[0]-a[0],dy=periodicDelta(a[1],b[1],flow.period),span=Math.hypot(dx,dy),steps=Math.max(8,Math.min(40,Math.ceil(span/.20))),bow=(random()-.5)*Math.min(flow.scale*.22,span*.23)
    const ta=tangent(edge.a,edge.b),tb=tangent(edge.b,edge.a),control=span*.28
    const points:P[]=[],widths:number[]=[],base=edge.level===0 ? flow.scale*(.0035+.0025*Math.sqrt(Math.max(.2,edge.load))) : flow.scale*(edge.level===1 ? .0016 : .00065),phase=random()*Math.PI*2
    for(let i=0;i<=steps;i++) {
      const t=i/steps,s=1-t,noise=Math.sin(Math.PI*t)**2*(bow+Math.sin(t*7+phase)*span*.025+Math.sin(t*23+phase)*flow.scale*.0015)
      const x=s*s*s*a[0]+3*s*s*t*(a[0]+ta[0]*control)+3*s*t*t*(a[0]+dx+tb[0]*control)+t*t*t*(a[0]+dx)
      const y=s*s*s*a[1]+3*s*s*t*(a[1]+ta[1]*control)+3*s*t*t*(a[1]+dy+tb[1]*control)+t*t*t*(a[1]+dy)
      const uv:UV=[Math.max(0,Math.min(flow.length,x-dy/Math.max(.001,span)*noise)),y+dx/Math.max(.001,span)*noise],p=i===0 ? positions[edge.a] : i===steps ? positions[edge.b] : flow.point(uv)
      points.push(p.toArray() as P);widths.push(base*(1+.24*Math.sin(t*3+phase)+.07*Math.sin(t*13+phase)))
    }
    paths.push({points,widths,hue:shape.hue,rank:edge.level,loose:false})
  }
  const degree=network.nodes.map(() => 0);network.edges.forEach(e => {degree[e.a]++;degree[e.b]++})
  return {network,flow,paths,loops:Math.max(0,network.edges.length-degree.filter(d => d>0).length+1),forks:degree.filter(d => d>=3).length}
}
