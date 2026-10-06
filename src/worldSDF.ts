import {Vector3} from 'three'
import {forestFloor} from './forestNavigation.ts'
import {mushroomField,mushroomFrame,smoothUnion} from './implicitBody.ts'
import type {ForestLayout,P} from './forestLayout.ts'
import {limbRadii,type WorldSkeleton} from './worldSkeleton.ts'
export type VolumePrimitive={group:number;blend?:number;min:P;max:P;value:(x:number,y:number,z:number)=>number;direction:P}
export type WorldVolume={field:(p:Vector3)=>number;normal:(p:Vector3)=>Vector3;project:(p:Vector3)=>Vector3;flow:(p:Vector3)=>Vector3;primitives:VolumePrimitive[];candidates:(x:number,y:number,z:number)=>VolumePrimitive[];bounds:{min:P;max:P}}
export function worldSDF(layout:ForestLayout,skeleton:WorldSkeleton):WorldVolume {
  const primitives:VolumePrimitive[]=[],padding=4.01,cell=7,grid=new Map<string,VolumePrimitive[]>(),temp=new Vector3()
  const add=(p:VolumePrimitive) => {
    // Ellipsoid distance is approximate, especially far from a flattened root.
    // Bound its exterior distance so the entire smooth-union influence fits the hash padding.
    const value=p.value
    p.value=(x,y,z)=>{const exterior=Math.hypot(Math.max(p.min[0]-x,0,x-p.max[0]),Math.max(p.min[1]-y,0,y-p.max[1]),Math.max(p.min[2]-z,0,z-p.max[2]));return exterior>0?Math.max(exterior,value(x,y,z)):value(x,y,z)}
    primitives.push(p)
    for(let x=Math.floor((p.min[0]-padding)/cell);x<=Math.floor((p.max[0]+padding)/cell);x++)for(let y=Math.floor((p.min[1]-padding)/cell);y<=Math.floor((p.max[1]+padding)/cell);y++)for(let z=Math.floor((p.min[2]-padding)/cell);z<=Math.floor((p.max[2]+padding)/cell);z++){const key=`${x},${y},${z}`,list=grid.get(key)??[];list.push(p);grid.set(key,list)}
  }
  let group=0
  const bounds=layout.bounds,margin=5,bottom=-4
  add({group:group++,min:[bounds.minX-margin,bottom,bounds.minZ-margin],max:[bounds.maxX+margin,5,bounds.maxZ+margin],direction:[0,0,-1],value:(x,y,z)=>Math.max(y-forestFloor(x,z),bottom-y,bounds.minX-margin-x,x-bounds.maxX-margin,bounds.minZ-margin-z,z-bounds.maxZ-margin)})
  for(const limb of skeleton.limbs) {
    const current=group++
    for(let i=1;i<limb.points.length;i++) {
      const a=limb.points[i-1],b=limb.points[i],ra=limbRadii(limb,(i-1)/(limb.points.length-1)),rb=limbRadii(limb,i/(limb.points.length-1)),rx=Math.max(ra.rx,rb.rx),ry=Math.max(ra.ry,rb.ry)
      const ay=a[1]+(limb.kind!=='root'?-ra.ry+.01:0),by=b[1]+(limb.kind!=='root'?-rb.ry+.01:0),dx=b[0]-a[0],dy=by-ay,dz=b[2]-a[2]
      add({group:current,blend:limb.kind==='root'?1.0:4.0,min:[Math.min(a[0],b[0])-rx,Math.min(ay,by)-ry*(limb.kind==='root'?1:2.1)-rx*.03,Math.min(a[2],b[2])-rx],max:[Math.max(a[0],b[0])+rx,Math.max(ay,by)+ry+rx*.03,Math.max(a[2],b[2])+rx],direction:[dx,dy,dz],value:(x,y,z) => {const t=Math.max(0,Math.min(1,((x-a[0])*dx/(rx*rx)+(y-ay)*dy/(ry*ry)+(z-a[2])*dz/(rx*rx))/(dx*dx/(rx*rx)+dy*dy/(ry*ry)+dz*dz/(rx*rx)||1))),xr=ra.rx+(rb.rx-ra.rx)*t,yr=ra.ry+(rb.ry-ra.ry)*t;const twist=limb.kind==='root'?0:.025*Math.sin(t*7+limb.id*.3)*Math.sin(Math.PI*t),lateral=(-(x-a[0]-dx*t)*dz+(z-a[2]-dz*t)*dx)/(Math.hypot(dx,dz)||1),vertical=y-ay-dy*t-twist*lateral,section=vertical<0&&limb.kind!=='root'?yr*2.1:yr;const qx=(x-a[0]-dx*t)/xr,qy=vertical/section,qz=(z-a[2]-dz*t)/xr,k0=Math.hypot(qx,qy,qz),k1=Math.hypot(qx/xr,qy/section,qz/xr);return k1<1e-8?-Math.min(xr,yr):k0*(k0-1)/k1}})

    }
  }
  for(const node of skeleton.hubs) {
    const c=node.position,r=10.5+Math.min(5.0,node.degree*.8),h=1.5
    add({group:group++,blend:3.0,min:[c[0]-r,c[1]-1.5-h*2.1,c[2]-r],max:[c[0]+r,c[1]-1.5+h,c[2]+r],direction:[0,.1,0],value:(x,y,z) => {const depth=y<c[1]-1.5?h*2.1:h;const qx=(x-c[0])/r,qy=(y-c[1]+1.5)/depth,qz=(z-c[2])/r,k0=Math.hypot(qx,qy,qz),k1=Math.hypot(qx/r,qy/depth,qz/r);return k1<1e-8?-h:k0*(k0-1)/k1}})
  }
  for(const m of layout.mushrooms) {
    const frame=mushroomFrame(m),r=m.radius,field=mushroomField(m),capHeight=Math.max(.4,r*.3)
    add({group:group++,min:[Math.min(m.x,frame.crown.x)-r*1.12,frame.base-capHeight,Math.min(m.z,frame.crown.z)-r*1.12],max:[Math.max(m.x,frame.crown.x)+r*1.12,frame.crown.y+capHeight,Math.max(m.z,frame.crown.z)+r*1.12],direction:[0,1,0],value:(x,y,z) => field(temp.set(x,y,z))})
  }
  const candidates=(x:number,y:number,z:number) => grid.get(`${Math.floor(x/cell)},${Math.floor(y/cell)},${Math.floor(z/cell)}`)??[]
  const field=(p:Vector3) => {
    let value=8,last=-1,part=8,blend=.75
    for(const primitive of candidates(p.x,p.y,p.z)){if(primitive.group!==last){if(last>=0)value=smoothUnion(value,part,blend);last=primitive.group;part=8;blend=primitive.blend??.75}part=Math.min(part,primitive.value(p.x,p.y,p.z))}
    return last<0?value:smoothUnion(value,part,blend)
  }
  const gradient=(p:Vector3) => {const e=.045;return new Vector3(field(new Vector3(p.x+e,p.y,p.z))-field(new Vector3(p.x-e,p.y,p.z)),field(new Vector3(p.x,p.y+e,p.z))-field(new Vector3(p.x,p.y-e,p.z)),field(new Vector3(p.x,p.y,p.z+e))-field(new Vector3(p.x,p.y,p.z-e))).multiplyScalar(1/(2*e))}
  const normal=(p:Vector3)=>gradient(p).normalize()
  const project=(input:Vector3) => {const p=input.clone();for(let i=0;i<10;i++){const d=field(p);if(Math.abs(d)<.004)break;const g=gradient(p),length=g.length();if(length<1e-6)break;p.addScaledVector(g,-Math.max(-.65,Math.min(.65,d/length))/length)}return p}
  const flow=(p:Vector3) => {const direction=new Vector3();for(const primitive of candidates(p.x,p.y,p.z)){const d=Math.abs(primitive.value(p.x,p.y,p.z)),v=new Vector3(...primitive.direction).normalize();direction.addScaledVector(v,1/(.3+d*d))}const n=normal(p);direction.addScaledVector(n,-direction.dot(n));return direction.normalize()}
  const min:P=[Infinity,Infinity,Infinity],max:P=[-Infinity,-Infinity,-Infinity];primitives.forEach(p => {for(let a=0;a<3;a++){min[a]=Math.min(min[a],p.min[a]-padding);max[a]=Math.max(max[a],p.max[a]+padding)}})
  return {field,normal,project,flow,primitives,candidates,bounds:{min,max}}
}
export function findSurfaceHeight(volume:WorldVolume,x:number,z:number,near:number) {
  const p=new Vector3(x,near,z),value=(y:number)=>volume.field(p.setY(y))
  let low=near,found=value(low)<0
  if(!found)for(let i=1;i<=10;i++){low=near-i*.2;if(value(low)<0){found=true;break}}
  if(!found)return undefined
  let high=low,inside=value(low),travel=0
  for(let i=0;i<1200&&inside<0&&high<volume.bounds.max[1]+1;i++){const step=Math.max(.008,Math.min(.15,-inside*.65));low=high;high+=step;travel+=step;inside=value(high)}
  if(inside<0)return undefined
  for(let i=0;i<15;i++){const mid=(low+high)*.5;if(value(mid)<0)low=mid;else high=mid}
  return (low+high)*.5
}

export const surfaceHeight=(volume:WorldVolume,x:number,z:number,near:number)=>findSurfaceHeight(volume,x,z,near)??near
