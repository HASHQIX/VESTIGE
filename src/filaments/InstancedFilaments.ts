import {BufferAttribute,DataTexture,FloatType,InstancedBufferAttribute,InstancedBufferGeometry,NearestFilter,RGBAFormat,Sphere,Vector2,Vector3} from 'three'
import type {PackedFilaments} from './filamentBuffers.ts'

/** Repeat one short ribbon strip. Each original centre point is stored once,
 * including its exact baked width/arc/seed/rank; only sides and neighbours are
 * reconstructed on the GPU. The worker payload remains available to tracers. */
export function instancedFilaments(packed:PackedFilaments,stripPoints=16){
 if(!Number.isInteger(stripPoints)||stripPoints<2||stripPoints>64)throw new Error('Invalid ribbon strip size')
 const count=packed.position.length/6
 if(!Number.isInteger(count)||count>=2**24)throw new Error('Ribbon point IDs exceed exact float range')
 const width=2048,height=Math.max(1,Math.ceil(count*2/width))
 if(height>4096)throw new Error('Ribbon atlas exceeds the portable texture limit')
 const data=new Float32Array(width*height*4),ranges:number[]=[]
 let start=0
 const center=new Vector3(),min=new Vector3(Infinity,Infinity,Infinity),max=new Vector3(-Infinity,-Infinity,-Infinity)
 for(let p=0;p<count;p++){
  const a=p*6,b=p*8,t=p*8,first=packed.data[b+2]===0,last=p===count-1||packed.data[b+10]===0
  if(first)start=p
  for(let k=0;k<3;k++){const v=packed.position[a+k];data[t+k]=v;min.setComponent(k,Math.min(min.getComponent(k),v));max.setComponent(k,Math.max(max.getComponent(k),v))}
  data[t+3]=packed.data[b+2];data[t+4]=packed.data[b+1];data[t+5]=packed.data[b+3];data[t+6]=packed.meta[b];data[t+7]=(first?1:0)+(last?2:0)
  if(last)for(let offset=start;offset<p;offset+=stripPoints-1)ranges.push(offset,Math.min(p,offset+stripPoints-1))
 }
 const texture=new DataTexture(data,width,height,RGBAFormat,FloatType)
 texture.name='unique-filament-points';texture.minFilter=texture.magFilter=NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true
 const geometry=new InstancedBufferGeometry(),vertices=new Float32Array(stripPoints*6),indices=new Uint16Array((stripPoints-1)*6)
 for(let p=0;p<stripPoints;p++){
  vertices.set([-1,p,0,1,p,0],p*6)
  if(p<stripPoints-1)indices.set([p*2,p*2+2,p*2+1,p*2+2,p*2+3,p*2+1],p*6)
 }
 const base=new BufferAttribute(vertices,3)
 geometry.setAttribute('position',base);geometry.setAttribute('ribbonVertex',base)
 geometry.setAttribute('stripRange',new InstancedBufferAttribute(new Float32Array(ranges),2));geometry.setIndex(new BufferAttribute(indices,1));geometry.instanceCount=ranges.length/2
 // Template coordinates are not world coordinates. Bounds must cover the
 // actual point field for both color meshes and their velocity proxies.
 if(count){center.addVectors(min,max).multiplyScalar(.5);let radius=0;const point=new Vector3()
  for(let p=0;p<count;p++)radius=Math.max(radius,center.distanceTo(point.fromArray(packed.position,p*6)))
  geometry.boundingSphere=new Sphere(center,radius)
 }else geometry.boundingSphere=new Sphere(new Vector3(),0)
 geometry.userData.filamentPacking='instanced';geometry.userData.filamentVertices=count*2
 geometry.userData.pointBytes=data.byteLength
 return {geometry,texture,size:new Vector2(width,height),points:count,instances:geometry.instanceCount}
}

export const instancedFilamentGLSL=`
 attribute vec3 ribbonVertex;attribute vec2 stripRange;
 uniform sampler2D pointTexture;uniform vec2 pointSize;
 vec3 fiberPosition;vec3 previous;vec3 next;vec3 flow;vec4 data;float level;
 vec4 fiberPoint(float index,float part){
  float texel=index*2.+part;
  return texture2D(pointTexture,vec2((mod(texel,pointSize.x)+.5)/pointSize.x,(floor(texel/pointSize.x)+.5)/pointSize.y));
 }
 void reconstructFiber(){
  float index=min(stripRange.x+ribbonVertex.y,stripRange.y);
  vec4 point=fiberPoint(index,0.),params=fiberPoint(index,1.);
  fiberPosition=point.xyz;
  previous=fiberPoint(index-(mod(params.w,2.)>.5?0.:1.),0.).xyz;
  next=fiberPoint(index+(params.w>1.5?0.:1.),0.).xyz;
  flow=next-previous;data=vec4(ribbonVertex.x,params.x,point.w,params.y);level=params.z;
 }
`
