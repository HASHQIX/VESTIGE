import {BufferAttribute,type BufferGeometry} from 'three'

export type VelocityMode='full'|'compact'
export function forestVelocityMode():VelocityMode {
 return 'compact'
}

// An index-only approximation for the auxiliary velocity/flow draw. All source
// attributes, every path, endpoints and the color-pass topology remain intact.
// Merge at most two segments, bounding rest-position, arc and width errors.
export function compactVelocityIndex(geometry:BufferGeometry){
 if('isInstancedBufferGeometry' in geometry)return undefined
 const position=geometry.getAttribute('position'),data=geometry.getAttribute('data'),original=geometry.index
 if(!position||!data||!original||position.itemSize!==3||data.itemSize!==4||position.count!==data.count||position.count%2||geometry.groups.length)return undefined
 if('isInterleavedBufferAttribute' in position||'isInterleavedBufferAttribute' in data)return undefined
 const points=position.count/2,p=position.array,d=data.array,selected=new Uint32Array(points)
 let count=0,paths=0,segments=0
 const merge=(a:number,b:number,c:number)=>{
  const start=d[a*8+2],end=d[c*8+2],span=end-start
  if(span<=0)return false
  const t=(d[b*8+2]-start)/span
  if(t<=0||t>=1)return false
  let error=0
  for(let k=0;k<3;k++){const delta=p[b*6+k]-(p[a*6+k]+(p[c*6+k]-p[a*6+k])*t);error+=delta*delta}
  const width=d[a*8+1]+(d[c*8+1]-d[a*8+1])*t
  return error<=.025*.025&&Math.abs(width-d[b*8+1])<=.025
 }
 for(let start=0;start<points;){
  let end=start+1
  while(end<points&&d[end*8+2]>d[(end-1)*8+2])end++
  if(end-start<2||d[start*8]!==-1||d[start*8+4]!==1)return undefined
  paths++;selected[count++]=start
  for(let i=start;i<end-1;){i+=i+2<end&&merge(i,i+1,i+2)?2:1;selected[count++]=i;segments++}
  start=end
 }
 // This helper is only for the paired ribbons produced by packFilaments.
 if(original.count!==(points-paths)*6||segments*6>=original.count)return undefined
 const indices=new Uint32Array(segments*6)
 let cursor=0
 for(let i=1;i<count;i++){
  const a=selected[i-1],b=selected[i]
  if(d[b*8+2]<=d[a*8+2])continue
  const v=a*2,w=b*2
  indices[cursor++]=v;indices[cursor++]=w;indices[cursor++]=v+1
  indices[cursor++]=w;indices[cursor++]=w+1;indices[cursor++]=v+1
 }
 return new BufferAttribute(indices,1)
}
