import {Vector3} from 'three'
import type {WorldVolume} from './worldSDF.ts'
import type {P} from './forestLayout.ts'
// All blocks use the same lattice and face diagonals. Edge IDs weld their boundaries.
export type WorldSurface={positions:P[];normals:P[];triangles:number[];step:number}
const corners:P[]=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]]
const tetrahedra=[[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]]
export function worldSurface(volume:WorldVolume,step=.4,region?:{min:P;max:P}):WorldSurface {
  const size=16,span=size*step,blocks=new Set<string>(),positions:P[]=[],normals:P[]=[],triangles:number[]=[],edges=new Map<string,number>(),p=new Vector3()
  for(const primitive of volume.primitives){
    // A prototype crops extraction blocks, never the organism's SDF or its lattice.
    const min=primitive.min.map((v,a)=>Math.max(v-2.2,region?.min[a]??-Infinity)),max=primitive.max.map((v,a)=>Math.min(v+2.2,region?.max[a]??Infinity))
    if(min.some((v,a)=>v>max[a]))continue
    for(let x=Math.floor(min[0]/span);x<=Math.floor(max[0]/span);x++)for(let y=Math.floor(min[1]/span);y<=Math.floor(max[1]/span);y++)for(let z=Math.floor(min[2]/span);z<=Math.floor(max[2]/span);z++)blocks.add(`${x},${y},${z}`)
  }
  const gridMin=volume.bounds.min.map(v=>Math.floor(v/step)-3),gridMax=volume.bounds.max.map(v=>Math.ceil(v/step)+3),nx=gridMax[0]-gridMin[0]+1,ny=gridMax[1]-gridMin[1]+1
  const gridId=(x:number,y:number,z:number)=>(x-gridMin[0])+nx*((y-gridMin[1])+ny*(z-gridMin[2]))
  const width=size+3,index=(x:number,y:number,z:number)=>x+width*(y+width*z),values=new Float32Array(width**3)
  const vertex=(a:number,b:number,ids:number[],coords:P[],scalar:number[],local:P[]) => {
    const key=Math.abs(scalar[a])<1e-8?`g${ids[a]}`:Math.abs(scalar[b])<1e-8?`g${ids[b]}`:ids[a]<ids[b]?`${ids[a]}:${ids[b]}`:`${ids[b]}:${ids[a]}`,existing=edges.get(key)
    if(existing!==undefined)return existing
    const t=scalar[a]/(scalar[a]-scalar[b]),c=coords[a],d=coords[b],position:P=[(c[0]+(d[0]-c[0])*t)*step,(c[1]+(d[1]-c[1])*t)*step,(c[2]+(d[2]-c[2])*t)*step]
    const gradient=(v:P) => {const [x,y,z]=v;return new Vector3(values[index(x+1,y,z)]-values[index(x-1,y,z)],values[index(x,y+1,z)]-values[index(x,y-1,z)],values[index(x,y,z+1)]-values[index(x,y,z-1)])}
    const normal=gradient(local[a]).lerp(gradient(local[b]),t).normalize().toArray() as P,id=positions.length
    positions.push(position);normals.push(normal);edges.set(key,id);return id
  }
  const emit=(a:number,b:number,c:number,outward:Vector3) => {
    if(a===b||a===c||b===c)return
    const pa=new Vector3(...positions[a]),pb=new Vector3(...positions[b]),pc=new Vector3(...positions[c])
    // Winding follows this tetrahedron's scalar signs, never smoothed vertex normals.
    // At a narrow fusion crease the latter can point across the face and invert a floor triangle.
    if(pb.sub(pa).cross(pc.sub(pa)).dot(outward)<0)triangles.push(a,c,b);else triangles.push(a,b,c)
  }
  for(const key of blocks) {
    const base=key.split(',').map(v=>Number(v)*size)
    for(let z=0;z<width;z++)for(let y=0;y<width;y++)for(let x=0;x<width;x++)values[index(x,y,z)]=volume.field(p.set((base[0]+x-1)*step,(base[1]+y-1)*step,(base[2]+z-1)*step))
    for(let z=1;z<=size;z++)for(let y=1;y<=size;y++)for(let x=1;x<=size;x++) {
      const local=corners.map(c=>[x+c[0],y+c[1],z+c[2]] as P),scalar=local.map(c=>values[index(...c)])
      if(scalar.every(v=>v>=0)||scalar.every(v=>v<0))continue
      const coords=local.map(c=>[base[0]+c[0]-1,base[1]+c[1]-1,base[2]+c[2]-1] as P),ids=coords.map(c=>gridId(...c))
      for(const tet of tetrahedra) {
        const inside=tet.filter(i=>scalar[i]<0),outside=tet.filter(i=>scalar[i]>=0)
        if(!inside.length||!outside.length)continue
        const v=(a:number,b:number)=>vertex(a,b,ids,coords,scalar,local)
        const outward=new Vector3()
        for(const i of outside)outward.addScaledVector(new Vector3(...corners[i]),1/outside.length)
        for(const i of inside)outward.addScaledVector(new Vector3(...corners[i]),-1/inside.length)
        if(inside.length===1)emit(v(inside[0],outside[0]),v(inside[0],outside[1]),v(inside[0],outside[2]),outward)
        else if(inside.length===3)emit(v(outside[0],inside[0]),v(outside[0],inside[1]),v(outside[0],inside[2]),outward)
        else {const a=v(inside[0],outside[0]),b=v(inside[0],outside[1]),c=v(inside[1],outside[0]),d=v(inside[1],outside[1]);emit(a,b,c,outward);emit(b,d,c,outward)}
      }
    }
  }
  return {positions,normals,triangles,step}
}
