import type {PackedBody} from './implicitBody.ts'

const CELL=2,STRIDE=4294967296
export type WalkingSurfaceData={cells:Map<string,Float64Array>;triangles:number}
type IndexedBody={positions:Float32Array;indices:Uint32Array}
const indexed=(bodies:PackedBody[]):IndexedBody[]=>bodies.map(body=>({positions:body.positions,indices:body.indices??Uint32Array.from({length:body.positions.length/3},(_,i)=>i)}))

// Built in the Worker from the very triangles rendered by the depth/surface pass.
export function buildWalkingSurface(bodies:PackedBody[]):WalkingSurfaceData {
  const cells=new Map<string,number[]>();let triangles=0
  indexed(bodies).forEach(({positions:p,indices},chunk)=>{
    for(let face=0;face<indices.length;face+=3){
      const a=indices[face]*3,b=indices[face+1]*3,c=indices[face+2]*3
      const bx=p[b]-p[a],bz=p[b+2]-p[a+2],cx=p[c]-p[a],cz=p[c+2]-p[a+2]
      const det=bx*cz-bz*cx,normalY=-det
      if(normalY<=1e-12)continue
      triangles++
      const minX=Math.floor((Math.min(p[a],p[b],p[c])-.0001)/CELL),maxX=Math.floor((Math.max(p[a],p[b],p[c])+.0001)/CELL)
      const minZ=Math.floor((Math.min(p[a+2],p[b+2],p[c+2])-.0001)/CELL),maxZ=Math.floor((Math.max(p[a+2],p[b+2],p[c+2])+.0001)/CELL)
      for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const key=`${x},${z}`,list=cells.get(key)??[];list.push(chunk*STRIDE+face);cells.set(key,list)}
    }
  })
  return {cells:new Map(Array.from(cells,([key,list])=>[key,new Float64Array(list)])),triangles}
}

export function createWalkingSurface(bodies:PackedBody[],data=buildWalkingSurface(bodies)) {
  const sources=indexed(bodies),cells=new Map(data.cells)
  const heightAt=(x:number,z:number,minY:number,maxY:number):number|undefined=>{
    let highest:number|undefined
    for(const code of cells.get(`${Math.floor(x/CELL)},${Math.floor(z/CELL)}`)??[]){
      const chunk=Math.floor(code/STRIDE),face=code-chunk*STRIDE,{positions:p,indices}=sources[chunk]
      const a=indices[face]*3,b=indices[face+1]*3,c=indices[face+2]*3
      if(Math.min(p[a+1],p[b+1],p[c+1])>maxY||Math.max(p[a+1],p[b+1],p[c+1])<minY)continue
      const bx=p[b]-p[a],bz=p[b+2]-p[a+2],cx=p[c]-p[a],cz=p[c+2]-p[a+2],dx=x-p[a],dz=z-p[a+2],det=bx*cz-bz*cx
      const u=(dx*cz-dz*cx)/det,v=(bx*dz-bz*dx)/det
      // Inclusive shared edges survive Float32 quantisation and chunk boundaries.
      if(u<-.00001||v<-.00001||u+v>1.00001)continue
      const height=p[a+1]+u*(p[b+1]-p[a+1])+v*(p[c+1]-p[a+1])
      if(height>=minY-.00001&&height<=maxY+.00001&&(highest===undefined||height>highest))highest=height
    }
    return highest
  }
  return {heightAt,triangles:data.triangles,dispose:()=>cells.clear()}
}
