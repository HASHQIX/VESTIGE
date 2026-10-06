import {MarchingCubes} from 'three/addons/objects/MarchingCubes.js'
import {MeshBasicMaterial,Vector3} from 'three'
import {forestFloor} from './forestNavigation.ts'
import type {MushroomShape,BridgeShape,P} from './forestLayout.ts'
import type {GrowthGraph} from './growthGraph.ts'
export type PackedBody={positions:Float32Array;normals:Float32Array;surface:Float32Array;species:Float32Array;indices?:Uint32Array}
const vec=(p:P) => new Vector3(...p)
export const smoothUnion=(a:number,b:number,k:number) => {const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25}
export function mushroomFrame(m:MushroomShape) {
  const base=m.base??forestFloor(m.x,m.z),leanX=Math.sin(m.z*.13)*m.height*.10,leanZ=Math.cos(m.x*.14)*m.height*.06
  return {base,leanX,leanZ,crown:new Vector3(m.x+leanX,base+m.height,m.z+leanZ)}
}
export function capPoint(m:MushroomShape,a:number,t:number,under=true) {
  const {crown}=mushroomFrame(m),r=m.radius*(1+.055*Math.sin(a*3+m.id)+.04*Math.sin(a*7))
  return crown.add(new Vector3(Math.cos(a)*r*t,m.radius*(.03+(under ? -1 : 1)*(m.radius<3 ? .27 : .19)*Math.sqrt(Math.max(0,1-t*t))),Math.sin(a)*r*t))
}
export function mushroomField(m:MushroomShape,graph?:GrowthGraph) {
  const frame=mushroomFrame(m),r=m.radius,h=m.height
  const macro=graph?.edges.filter(e => !e.merge && graph.nodes[e.b].flow>8).slice(0,24).map(e => {const a=graph.nodes[e.a].position,b=graph.nodes[e.b].position,dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];return {a,dx,dy,dz,length:dx*dx+dy*dy+dz*dz,r:Math.max(r*.015,graph.nodes[e.b].radius)}}) ?? []
  return (p:Vector3) => {
    const t=Math.max(0,Math.min(1,(p.y-frame.base)/h)),x=m.x+frame.leanX*t+Math.sin(t*5+m.id)*r*.022,z=m.z+frame.leanZ*t
    const radius=Math.max(.30,r*((r>10 ? .18 : .095)+(r>10 ? .22 : .15)*(1-t)**5+(r>10 ? .25 : .18)*t**8)*(1+.09*Math.sin(t*7+m.id)))
    const stem=Math.max(Math.hypot(p.x-x,p.z-z)-radius,frame.base-p.y,p.y-frame.base-h)
    const dx=p.x-frame.crown.x,dz=p.z-frame.crown.z,a=Math.atan2(dz,dx),wr=r*(1+.055*Math.sin(a*3+m.id)+.04*Math.sin(a*7))
    const qx=dx/wr,qy=(p.y-frame.crown.y-r*.03)/Math.max(.32,r*(r<3 ? .27 : .19)),qz=dz/wr,k0=Math.hypot(qx,qy,qz),k1=Math.hypot(qx/wr,qy/Math.max(.32,r*(r<3 ? .27 : .19)),qz/wr)
    const cap=k1<1e-8 ? -Math.max(.32,r*(r<3 ? .27 : .19)) : k0*(k0-1)/k1
    let d=smoothUnion(stem,cap,r*.19)
    for(const branch of macro) {
      const dx=p.x-branch.a[0],dy=p.y-branch.a[1],dz=p.z-branch.a[2],t=Math.max(0,Math.min(1,(dx*branch.dx+dy*branch.dy+dz*branch.dz)/(branch.length || 1)))
      d=smoothUnion(d,Math.hypot(dx-branch.dx*t,dy-branch.dy*t,dz-branch.dz*t)-branch.r,r*.04)
    }
    return d
  }
}
export function fieldNormal(field:(p:Vector3) => number,p:Vector3,epsilon=.025) {
  return new Vector3(field(p.clone().add(new Vector3(epsilon,0,0)))-field(p.clone().add(new Vector3(-epsilon,0,0))),
    field(p.clone().add(new Vector3(0,epsilon,0)))-field(p.clone().add(new Vector3(0,-epsilon,0))),
    field(p.clone().add(new Vector3(0,0,epsilon)))-field(p.clone().add(new Vector3(0,0,-epsilon)))).normalize()
}
export function projectToBody(field:(p:Vector3) => number,input:Vector3,scale:number) {
  const p=input.clone()
  for(let i=0;i<7;i++) {const d=field(p);if(Math.abs(d)<.002) break;p.addScaledVector(fieldNormal(field,p,scale*.003),-Math.max(-scale*.4,Math.min(scale*.4,d)))}
  return p
}
export function buildMushroomBody(m:MushroomShape,graph:GrowthGraph):PackedBody {
  const frame=mushroomFrame(m),r=m.radius,resolution=r>8 ? 42 : 30
  const center=new Vector3(m.x+frame.leanX*.5,frame.base+m.height*.5+r*.08,m.z+frame.leanZ*.5)
  const half=new Vector3(r*1.26+Math.abs(frame.leanX)*.55,m.height*.55+r*.30,r*1.26+Math.abs(frame.leanZ)*.55)
  const temporary=new MeshBasicMaterial(),mc=new MarchingCubes(resolution,temporary,false,false,24_000),field=mushroomField(m,graph)
  mc.isolation=0
  for(let z=0;z<resolution;z++) for(let y=0;y<resolution;y++) for(let x=0;x<resolution;x++) {
    const p=new Vector3(center.x+(x/resolution*2-1)*half.x,center.y+(y/resolution*2-1)*half.y,center.z+(z/resolution*2-1)*half.z)
    mc.field[x+y*resolution+z*resolution*resolution]=-field(p)
  }
  mc.update()
  const source=mc.geometry.getAttribute('position'),normal=mc.geometry.getAttribute('normal'),positions=new Float32Array(mc.count*3),normals=new Float32Array(mc.count*3),surface=new Float32Array(mc.count*3),species=new Float32Array(mc.count*4)
  for(let i=0;i<mc.count;i++) {
    const p=new Vector3().fromBufferAttribute(source,i).multiply(half).add(center),n=new Vector3().fromBufferAttribute(normal,i).divide(half).normalize()
    const t=(p.y-frame.base)/m.height,cx=m.x+frame.leanX*Math.min(1,t),cz=m.z+frame.leanZ*Math.min(1,t)
    const dx=p.x-(t>.83 ? frame.crown.x : cx),dz=p.z-(t>.83 ? frame.crown.z : cz)
    positions.set(p.toArray(),i*3);normals.set(n.toArray(),i*3);const angle=Math.atan2(dz,dx);surface.set([Math.cos(angle),Math.sin(angle),t],i*3);species.set([m.hue,r,0,m.id*.73],i*4)
  }
  mc.geometry.dispose();temporary.dispose()
  return {positions,normals,surface,species}
}
export function bridgePoint(m:BridgeShape,t:number,a:number) {
  const at=Math.max(0,Math.min(1,t))*(m.points.length-1),i=Math.min(m.points.length-2,Math.floor(at)),fraction=at-i
  const p=vec(m.points[i]).lerp(vec(m.points[i+1]),fraction),tangent=vec(m.points[i+1]).sub(vec(m.points[i])).setY(0).normalize(),side=new Vector3(-tangent.z,0,tangent.x)
  return p.addScaledVector(side,Math.cos(a)*m.width*.49).add(new Vector3(0,-1.04+Math.sin(a)*1.05,0))
}
export function buildBridgeBody(m:BridgeShape):PackedBody {
  const positions:number[]=[],normals:number[]=[],surface:number[]=[],species:number[]=[],rings=96,sides=32
  const emit=(t:number,a:number) => {const p=bridgePoint(m,t,a),along=bridgePoint(m,Math.min(1,t+.001),a).sub(bridgePoint(m,Math.max(0,t-.001),a)),around=bridgePoint(m,t,a+.001).sub(p),n=new Vector3().crossVectors(along,around).normalize();positions.push(...p.toArray());normals.push(...n.toArray());surface.push(Math.cos(a),Math.sin(a),t);species.push(m.hue,m.width,1,m.id*.73)}
  for(let i=0;i<rings;i++) for(let j=0;j<sides;j++) {
    const t=i/rings,next=(i+1)/rings,a=j/sides*Math.PI*2,b=(j+1)/sides*Math.PI*2
    emit(t,a);emit(next,a);emit(t,b);emit(next,a);emit(next,b);emit(t,b)
  }
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),surface:new Float32Array(surface),species:new Float32Array(species)}
}
