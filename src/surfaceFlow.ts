import {Vector3} from 'three'
import {bridgePoint,capPoint,mushroomFrame,mushroomField,projectToBody,fieldNormal} from './implicitBody.ts'
import type {GrowthGraph} from './growthGraph.ts'
import type {OrganShape} from './forestLayout.ts'
import type {UV} from './cellNetwork.ts'
export type SurfaceFlow={length:number;period:number;scale:number;stemEnd:number;rim:number;point:(uv:UV) => Vector3;warp:(uv:UV) => UV}
export function surfaceFlow(shape:OrganShape,graph:GrowthGraph):SurfaceFlow {
  const scale=shape.kind==='mushroom' ? shape.radius : shape.width,period=Math.PI*2*scale*.28
  const field=shape.kind==='mushroom' ? mushroomField(shape,graph) : undefined
  const frame=shape.kind==='mushroom' ? mushroomFrame(shape) : undefined
  const stemEnd=shape.kind==='mushroom' ? shape.height-scale*.185 : 0,rim=stemEnd+scale*.77
  let arc=0
  if(shape.kind==='bridge')for(let i=1;i<shape.points.length;i++)arc+=new Vector3(...shape.points[i]).distanceTo(new Vector3(...shape.points[i-1]))
  const length=shape.kind==='bridge' ? arc : rim+scale*.97
  const project=(p:Vector3) => {if(!field)return p;const q=projectToBody(field,p,scale);return q.addScaledVector(fieldNormal(field,q,scale*.003),scale*.012)}
  const point=([u,v]:UV) => {
    const a=v/period*Math.PI*2
    if(shape.kind==='bridge')return bridgePoint(shape,Math.max(0,Math.min(1,u/length)),a).add(new Vector3(0,.022,0))
    if(u>stemEnd){const under=u<rim,t=under ? .23+(u-stemEnd)/scale : 1-(u-rim)/scale;return project(capPoint(shape,a,Math.max(.03,Math.min(1,t)),under))}
    const t=Math.max(0,Math.min(1,u/stemEnd)),y=frame!.base+stemEnd*t,seed=new Vector3(shape.x+frame!.leanX*t+Math.cos(a)*scale*.18,y,shape.z+frame!.leanZ*t+Math.sin(a)*scale*.18)
    if(t>.8)seed.lerp(capPoint(shape,a,.23,true),(t-.8)/.2)
    return project(seed)
  }
  const warp=([u,v]:UV):UV => {
    const a=v/period*Math.PI*2,envelope=Math.sin(Math.PI*Math.max(0,Math.min(1,u/length))),phase=shape.id*.731
    const large=Math.sin(u*.37+Math.sin(a*3+phase)),medium=Math.sin(u*2.1+a*5+phase),fine=Math.sin(u*12+a*9)
    return [Math.max(0,Math.min(length,u+envelope*scale*(.045*large+.01*medium+.0015*fine))),v+scale*(.07*Math.sin(u*.22+a*2+phase)+.018*Math.sin(u*1.3+a*5)+.002*Math.sin(u*9+a*11))]
  }
  return {length,period,scale,stemEnd,rim,point,warp}
}
