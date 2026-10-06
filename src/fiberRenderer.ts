import {BufferGeometry,Float32BufferAttribute,InstancedBufferAttribute,InstancedBufferGeometry,Mesh,ShaderMaterial,Sphere,Vector3,Uint32BufferAttribute} from 'three'
import type {PackedBody} from './implicitBody.ts'
import type {FiberPath} from './fiberField.ts'
export type PackedFibers={start:Float32Array;end:Float32Array;data:Float32Array;motion:Float32Array;primary:number;secondary:number;vines:number}
export function packFibers(paths:FiberPath[]):PackedFibers {
  const start:number[]=[],end:number[]=[],data:number[]=[],motion:number[]=[];let primary=0,secondary=0,vines=0
  paths.forEach((path,id) => {
    if(path.loose)vines++
    for(let i=1;i<path.points.length;i++) {
      start.push(...path.points[i-1]);end.push(...path.points[i]);data.push(path.widths[i-1],path.widths[i],path.hue,id*.731)
      const a=(i-1)/(path.points.length-1),b=i/(path.points.length-1);motion.push(a,b,path.loose ? a*a : 0,path.loose ? b*b : 0)
      if(path.rank===0) primary++
      if(path.rank===1) secondary++
    }
  })
  return {start:new Float32Array(start),end:new Float32Array(end),data:new Float32Array(data),motion:new Float32Array(motion),primary,secondary,vines}
}
export function bodyGeometry(body:PackedBody) {
  const geometry=new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(body.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(body.normals,3));geometry.setAttribute('surface',new Float32BufferAttribute(body.surface,3));geometry.setAttribute('species',new Float32BufferAttribute(body.species,4));if(body.indices)geometry.setIndex(new Uint32BufferAttribute(body.indices,1));geometry.computeBoundingSphere()
  return geometry
}
export function ribbonGeometry(fibers:PackedFibers) {
  const geometry=new InstancedBufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute([0,-1,0,0,1,0,1,-1,0,1,1,0],3));geometry.setIndex([0,2,1,2,3,1])
  for(const [name,array,size] of [['start',fibers.start,3],['end',fibers.end,3],['data',fibers.data,4],['motion',fibers.motion,4]] as const) geometry.setAttribute(name,new InstancedBufferAttribute(array,size))
  geometry.instanceCount=fibers.start.length/3
  const center=new Vector3();for(let i=0;i<fibers.start.length;i+=3) center.add(new Vector3().fromArray(fibers.start,i))
  center.divideScalar(Math.max(1,geometry.instanceCount));let radius=0
  for(let i=0;i<fibers.start.length;i+=3)radius=Math.max(radius,center.distanceTo(new Vector3().fromArray(fibers.start,i)),center.distanceTo(new Vector3().fromArray(fibers.end,i)))
  geometry.boundingSphere=new Sphere(center,radius+1)
  return geometry
}
export const ribbonMesh=(geometry:InstancedBufferGeometry,material:ShaderMaterial) => {const mesh=new Mesh(geometry,material);mesh.renderOrder=2;mesh.name='vascular-ribbons';return mesh}
