import {Vector3} from 'three'
import {capPoint,mushroomFrame,bridgePoint} from './implicitBody.ts'
import {seeded,type OrganShape,type P} from './forestLayout.ts'
import {forestFloor} from './forestNavigation.ts'
import {growGraph,type GrowthGraph} from './growthGraph.ts'
import {organicGrowth,type VascularNetwork} from './organicGrowth.ts'
export type FiberPath={points:P[];widths:number[];hue:number;rank:number;loose:boolean}
export function growOrgan(shape:OrganShape) {
  const random=seeded(shape.id*1907+341),seeds:P[]=[],attractors:P[]=[]
  const scale=shape.kind==='mushroom' ? shape.radius : shape.width
  if(shape.kind==='mushroom') {
    const frame=mushroomFrame(shape)
    for(let i=0;i<=18;i++) {const t=i/18;seeds.push([shape.x+frame.leanX*t,frame.base+shape.height*t,shape.z+frame.leanZ*t])}
    const count=scale>8 ? 650 : 180
    for(let i=0;i<count;i++) attractors.push(capPoint(shape,random()*Math.PI*2,Math.sqrt(random())*.98,i%3!==0).toArray() as P)
    for(let i=0;i<80;i++){const a=random()*Math.PI*2,r=scale*(.4+random()*.9),x=shape.x+Math.cos(a)*r,z=shape.z+Math.sin(a)*r;attractors.push([x,forestFloor(x,z)+.12,z])}
  } else {
    for(let i=0;i<=24;i++) seeds.push([...shape.points[Math.round(i/24*(shape.points.length-1))]])
    for(let i=0;i<440;i++) attractors.push(bridgePoint(shape,random(),random()*Math.PI*2).toArray() as P)
  }
  const graph=growGraph({seeds,attractors,seed:shape.id*9029+17,step:Math.max(.055,scale*.075),influence:scale*.85,kill:scale*.075,tropism:[0,shape.kind==='mushroom' ? .02 : 0,0],maxNodes:scale>8 ? 1800 : 1000,maxRadius:Math.min(.75,scale*.055)})
  return graph
}
export function flowFibers(shape:OrganShape,graph:GrowthGraph,vascular:VascularNetwork=organicGrowth(shape,graph)):FiberPath[] {
  const paths=[...vascular.paths],random=seeded(shape.id*6029+71),scale=shape.kind==='mushroom' ? shape.radius : shape.width
  const anchors=vascular.network.nodes.filter(n => shape.kind==='mushroom' ? n.uv[0]>vascular.flow.stemEnd+scale*.37 && n.uv[0]<vascular.flow.rim-scale*.12 : Math.abs(Math.sin(n.uv[1]/vascular.flow.period*Math.PI*2))<.65)
  const count=shape.kind==='mushroom' ? scale>8 ? 35 : 12 : 24
  for(let k=0;k<count;k++) {
    const a=random()*Math.PI*2
    const anchor=anchors[Math.floor(random()*anchors.length)] ?? vascular.network.nodes[0]
    const top=vascular.flow.point(vascular.flow.warp(anchor.uv))
    const length=shape.kind==='mushroom' ? 1.5+random()*Math.min(15,shape.height*.65) : 2+random()*11,points:P[]=[],widths:number[]=[]
    for(let i=0;i<=25;i++){const t=i/25;points.push([top.x+Math.sin(t*3+a)*.32*t,top.y-length*t,top.z+Math.sin(t*5+a)*.26*t]);widths.push(scale*.0018*(1-t)**.7)}
    paths.push({points,widths,hue:shape.hue,rank:2,loose:true})
  }
  return paths.sort((a,b) => a.rank-b.rank)
}
