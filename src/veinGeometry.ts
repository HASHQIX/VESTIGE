import {BufferGeometry,Float32BufferAttribute,Uint32BufferAttribute,Vector3} from 'three'
import type {FiberPath} from './fiberField.ts'
export type PackedVeins={positions:Float32Array;normals:Float32Array;ink:Float32Array;indices:Uint32Array}
export function packVeins(paths:FiberPath[]):PackedVeins {
  const positions:number[]=[],normals:number[]=[],ink:number[]=[],indices:number[]=[],sides=6
  paths.filter(p => p.rank===0).forEach((path,id) => {
    const offset=positions.length/3;let normal=new Vector3(1,0,0)
    for(let i=0;i<path.points.length;i++) {
      const center=new Vector3(...path.points[i]),before=new Vector3(...path.points[Math.max(0,i-1)]),after=new Vector3(...path.points[Math.min(path.points.length-1,i+1)]),tangent=after.sub(before).normalize()
      if(tangent.lengthSq()<1e-8)tangent.set(0,1,0)
      normal.addScaledVector(tangent,-normal.dot(tangent))
      if(normal.lengthSq()<1e-6)normal=new Vector3(0,0,1).addScaledVector(tangent,-tangent.z)
      normal.normalize();const binormal=new Vector3().crossVectors(tangent,normal).normalize()
      for(let j=0;j<sides;j++){const angle=j/sides*Math.PI*2,n=normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal,Math.sin(angle)),p=center.clone().addScaledVector(n,path.widths[i]*.52);positions.push(...p.toArray());normals.push(...n.toArray());ink.push(path.hue,id*.731)}
      if(i)for(let j=0;j<sides;j++){const a=offset+(i-1)*sides+j,b=offset+(i-1)*sides+(j+1)%sides,c=offset+i*sides+j,d=offset+i*sides+(j+1)%sides;indices.push(a,b,c,b,d,c)}
    }
  })
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),ink:new Float32Array(ink),indices:new Uint32Array(indices)}
}
export function veinGeometry(data:PackedVeins) {
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(data.positions,3));geometry.setAttribute('normal',new Float32BufferAttribute(data.normals,3));geometry.setAttribute('ink',new Float32BufferAttribute(data.ink,2));geometry.setIndex(new Uint32BufferAttribute(data.indices,1));geometry.computeBoundingSphere();return geometry
}
