import {Vector3} from 'three'
import {mushroomFrame} from '../implicitBody.ts'
import type {ForestLayout,P} from '../forestLayout.ts'
import type {WorldSkeleton} from '../worldSkeleton.ts'
import type {WorldVolume} from '../worldSDF.ts'

export type FilamentRegion={min:P;max:P;center:P}
export function heroRegion(layout:ForestLayout):FilamentRegion|undefined {
  const bridge=layout.bridges[0]
  if(!bridge)return undefined
  const points=bridge.points.slice(Math.floor(bridge.points.length*.12),Math.ceil(bridge.points.length*.96))
  const min:P=[Infinity,Infinity,Infinity],max:P=[-Infinity,-Infinity,-Infinity]
  for(const p of points)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a])}
  const pad=[bridge.width*.8,6,5]
  for(let a=0;a<3;a++){min[a]-=pad[a];max[a]+=pad[a]}
  return {min,max,center:min.map((v,a)=>(v+max[a])*.5) as P}
}
// Analytic curl of three smooth vector potentials. No per-point random displacement.
export function curlNoise(p:Vector3):Vector3 {
  const result=new Vector3()
  for(const [k,amplitude] of [[.09,.26],[.31,.14],[1.1,.035]]) {
    const x=p.x*k,y=p.y*k,z=p.z*k
    result.x+=amplitude*(.8*Math.cos(x+.8*y+1.3)-Math.cos(z+.6*x+.4))
    result.y+=amplitude*(.7*Math.cos(y+.7*z+2.1)-Math.cos(x+.8*y+1.3))
    result.z+=amplitude*(.6*Math.cos(z+.6*x+.4)-Math.cos(y+.7*z+2.1))
  }
  return result
}
export function skeletonFlow(layout:ForestLayout,skeleton:WorldSkeleton) {
  const segments=skeleton.limbs.flatMap(l=>l.points.slice(1).map((b,i)=>({a:new Vector3(...l.points[i]),b:new Vector3(...b),id:l.id})))
  const cells=new Map<string,typeof segments>(),cell=16
  for(const s of segments)for(let z=Math.floor((Math.min(s.a.z,s.b.z)-18)/cell);z<=Math.floor((Math.max(s.a.z,s.b.z)+18)/cell);z++)for(let y=Math.floor((Math.min(s.a.y,s.b.y)-18)/cell);y<=Math.floor((Math.max(s.a.y,s.b.y)+18)/cell);y++)for(let x=Math.floor((Math.min(s.a.x,s.b.x)-18)/cell);x<=Math.floor((Math.max(s.a.x,s.b.x)+18)/cell);x++){
    const key=`${x},${y},${z}`,list=cells.get(key)??[];list.push(s);cells.set(key,list)
  }
  const fungi=layout.mushrooms.map(m=>({m,frame:mushroomFrame(m)}))
  return (p:Vector3) => {
    const nearest=new Map<number,{d:number;v:Vector3}>()
    for(const s of cells.get(`${Math.floor(p.x/cell)},${Math.floor(p.y/cell)},${Math.floor(p.z/cell)}`)??[]){const v=s.b.clone().sub(s.a),t=Math.max(0,Math.min(1,p.clone().sub(s.a).dot(v)/(v.lengthSq()||1))),d=p.distanceToSquared(s.a.clone().addScaledVector(v,t)),old=nearest.get(s.id);if(!old||d<old.d)nearest.set(s.id,{d,v:v.normalize()})}
    const candidates=Array.from(nearest.values()).sort((a,b)=>a.d-b.d).slice(0,4)
    const dominant=candidates[0]?.v??new Vector3(0,0,-1),flow=new Vector3()
    for(const c of candidates){if(c.v.dot(dominant)<0)c.v.negate();flow.addScaledVector(c.v,1/(1+c.d))}
    flow.normalize()
    for(const {m,frame} of fungi){
      const t=Math.max(0,Math.min(1,(p.y-frame.base)/m.height)),axis=new Vector3(m.x+frame.leanX*t,p.y,m.z+frame.leanZ*t),radial=p.clone().sub(axis).setY(0),r=radial.length()
      if(r>m.radius*1.15||p.y<frame.base-1||p.y>frame.crown.y+m.radius*.4)continue
      const cap=Math.max(0,Math.min(1,(t-.72)/.26)),v=new Vector3(frame.leanX/m.height,1,frame.leanZ/m.height).multiplyScalar(1-cap).addScaledVector(radial.clone().normalize(),cap)
      v.addScaledVector(new Vector3(-radial.z,0,radial.x).normalize(),.12*(1-cap))
      const weight=Math.exp(-r*r/Math.max(1,m.radius*m.radius*.3))*t
      flow.lerp(v.normalize(),weight)
    }
    return flow.normalize().add(curlNoise(p)).normalize()
  }
}
// Bake once in the worker. Tracing samples one global field, never a per-bridge unwrap.
export function bakeFilamentField(volume:WorldVolume,layout:ForestLayout,skeleton:WorldSkeleton,region:FilamentRegion,spacing=.65,sparse=false) {
  const origin=region.min.map(v=>v-spacing*2) as P,dims=region.max.map((v,a)=>Math.ceil((v-origin[a])/spacing)+3),count=dims[0]*dims[1]*dims[2]
  const distances=new Float32Array(count),directions=new Float32Array(count*3),direction=skeletonFlow(layout,skeleton),index=(x:number,y:number,z:number)=>x+dims[0]*(y+dims[1]*z)
  const ready=sparse?new Uint8Array(count):undefined
  const fill=(x:number,y:number,z:number)=>{
    const p=new Vector3(origin[0]+x*spacing,origin[1]+y*spacing,origin[2]+z*spacing),i=index(x,y,z)
    distances[i]=volume.field(p);direction(p).toArray(directions,i*3);if(ready)ready[i]=1
  }
  if(!sparse)for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)fill(x,y,z)
  const inside=(p:Vector3,margin=0)=>p.x>=region.min[0]+margin&&p.x<=region.max[0]-margin&&p.y>=region.min[1]+margin&&p.y<=region.max[1]-margin&&p.z>=region.min[2]+margin&&p.z<=region.max[2]-margin
  const sample=(array:Float32Array,p:Vector3,stride:number,component:number)=>{
    const qx=Math.max(0,Math.min(dims[0]-1.001,(p.x-origin[0])/spacing)),qy=Math.max(0,Math.min(dims[1]-1.001,(p.y-origin[1])/spacing)),qz=Math.max(0,Math.min(dims[2]-1.001,(p.z-origin[2])/spacing))
    const bx=Math.floor(qx),by=Math.floor(qy),bz=Math.floor(qz),fx=qx-bx,fy=qy-by,fz=qz-bz;let value=0
    for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const i=index(bx+x,by+y,bz+z);if(ready&&!ready[i])fill(bx+x,by+y,bz+z);value+=array[i*stride+component]*(x?fx:1-fx)*(y?fy:1-fy)*(z?fz:1-fz)}
    return value
  }
  const distance=(p:Vector3)=>sample(distances,p,1,0)
  const samplePoint=new Vector3(),e=spacing*.4
  const gradient=(p:Vector3)=>{
    const x=p.x,y=p.y,z=p.z
    const gx=(distance(samplePoint.set(x+e,y+0,z+0))-distance(samplePoint.set(x-e,y-0,z-0)))/(2*e)
    const gy=(distance(samplePoint.set(x+0,y+e,z+0))-distance(samplePoint.set(x-0,y-e,z-0)))/(2*e)
    const gz=(distance(samplePoint.set(x+0,y+0,z+e))-distance(samplePoint.set(x-0,y-0,z-e)))/(2*e)
    return new Vector3(gx,gy,gz)
  }
  const project=(input:Vector3,iso:number)=>{const p=input.clone();for(let i=0;i<4;i++){const d=distance(p)-iso;if(Math.abs(d)<.006)break;const g=gradient(p),length=g.lengthSq();if(length<.01)break;p.addScaledVector(g,-Math.max(-.45,Math.min(.45,d))/length)}return p}
  const flow=(p:Vector3)=>{const v=new Vector3(sample(directions,p,3,0),sample(directions,p,3,1),sample(directions,p,3,2)),n=gradient(p).normalize();return v.addScaledVector(n,-v.dot(n)).normalize()}
  return {region,inside,distance,gradient,project,flow}
}
export type FilamentField=ReturnType<typeof bakeFilamentField>
