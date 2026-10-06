import {AdditiveBlending,BufferGeometry,Float32BufferAttribute,LineSegments,Mesh,ShaderMaterial,Vector2,Vector3} from 'three'
import {type ForestLayout,type P} from './forestLayout.ts'
import {forestFloor} from './forestNavigation.ts'
import {capPoint,mushroomFrame} from './implicitBody.ts'
import {limbRadii,type WorldSkeleton} from './worldSkeleton.ts'
import type {createFilamentRenderer} from './filaments/FilamentRenderer.ts'

// Analytic silhouettes, not another field bake or particle simulation.
export function previewLines(layout:ForestLayout,skeleton:WorldSkeleton){
 const positions:number[]=[]
 const line=(points:Vector3[])=>{for(let i=1;i<points.length;i++)positions.push(...points[i-1].toArray(),...points[i].toArray())}
 for(const limb of skeleton.limbs)for(let strand=0;strand<16;strand++){
  const points:Vector3[]=[]
  for(let i=0;i<=24;i++){
   const t=i/24,at=t*(limb.points.length-1),k=Math.min(limb.points.length-2,Math.floor(at)),p=new Vector3(...limb.points[k]).lerp(new Vector3(...limb.points[k+1]),at-k)
   const tangent=new Vector3(...limb.points[k+1]).sub(new Vector3(...limb.points[k])).setY(0).normalize(),side=new Vector3(-tangent.z,0,tangent.x),r=limbRadii(limb,t)
   const angle=strand/16*Math.PI*2+.06*Math.sin(t*9+strand*.7),vertical=Math.sin(angle)*r.ry
   p.addScaledVector(side,Math.cos(angle)*r.rx);p.y+=(limb.kind==='root'?0:-r.ry+.01)+vertical*(vertical<0&&limb.kind!=='root'?2.1:1);points.push(p)
  }
  line(points)
 }
 for(const m of layout.mushrooms){
  const frame=mushroomFrame(m),r=m.radius
  for(let strand=0;strand<20;strand++){
   const angle=strand/20*Math.PI*2,points:Vector3[]=[]
   for(let i=0;i<=24;i++){const t=i/24;points.push(capPoint(m,angle+t*.75,t,strand%3===0))}line(points)
  }
  for(let strand=0;strand<8;strand++){
   const angle=strand/8*Math.PI*2,points:Vector3[]=[]
   for(let i=0;i<=16;i++){
    const t=i/16,radius=Math.max(.3,r*((r>10 ? .18 : .095)+(r>10 ? .22 : .15)*(1-t)**5+(r>10 ? .25 : .18)*t**8)*(1+.09*Math.sin(t*7+m.id)))
    points.push(new Vector3(m.x+frame.leanX*t+Math.sin(t*5+m.id)*r*.022+Math.cos(angle+t*.3)*radius,frame.base+m.height*t,m.z+frame.leanZ*t+Math.sin(angle+t*.3)*radius))
   }line(points)
  }
 }
 for(const hub of skeleton.hubs)for(let strand=0;strand<8;strand++){
  const [x,y,z]=hub.position,r=10.5+Math.min(5,hub.degree*.8),angle=strand/8*Math.PI*2
  line(Array.from({length:17},(_,i)=>{const t=i/16;return new Vector3(x+Math.cos(angle+t*.45)*r*t,y-1.5+1.5*Math.sqrt(1-t*t),z+Math.sin(angle+t*.45)*r*t)}))
 }
 return new Float32Array(positions)
}
export function groundPreviewGeometry(layout:ForestLayout){
 const {minX,maxX,minZ,maxZ}=layout.bounds,nx=Math.ceil((maxX-minX)/2),nz=Math.ceil((maxZ-minZ)/2),positions:number[]=[],indices:number[]=[]
 for(let z=0;z<=nz;z++)for(let x=0;x<=nx;x++){const px=minX+x/nx*(maxX-minX),pz=minZ+z/nz*(maxZ-minZ);positions.push(px,forestFloor(px,pz)+.06,pz)}
 for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const a=z*(nx+1)+x,b=a+nx+1;indices.push(a,b,a+1,a+1,b,b+1)}
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry
}
export function createForestPreview(layout:ForestLayout,skeleton:WorldSkeleton,f:ReturnType<typeof createFilamentRenderer>){
 const start=performance.now(),position=previewLines(layout,skeleton),geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(position,3));geometry.computeBoundingSphere()
 const uniforms={gain:{value:1},resolution:{value:new Vector2()},bodyDepth:f.uniforms.bodyDepth,cameraRange:f.uniforms.cameraRange,regionWeights:{value:[1,1]},regionCount:{value:0},regionMin:{value:[new Vector3(),new Vector3()]},regionMax:{value:[new Vector3(),new Vector3()]}}
 const material=new ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,blending:AdditiveBlending,toneMapped:false,
 vertexShader:`varying vec3 world;varying float depth;void main(){world=(modelMatrix*vec4(position,1.)).xyz;vec4 view=modelViewMatrix*vec4(position,1.);depth=-view.z;gl_Position=projectionMatrix*view;}`,
 fragmentShader:`uniform float gain;uniform sampler2D bodyDepth;uniform vec2 cameraRange;uniform vec2 resolution;uniform float regionWeights[2];uniform int regionCount;uniform vec3 regionMin[2];uniform vec3 regionMax[2];varying vec3 world;varying float depth;
 float linearDepth(float z){return 2.*cameraRange.x*cameraRange.y/(cameraRange.y+cameraRange.x-(z*2.-1.)*(cameraRange.y-cameraRange.x));}
 void main(){float prepared=0.;for(int i=0;i<2;i++){if(i>=regionCount)break;vec3 edge=min(world-regionMin[i],regionMax[i]-world);prepared=max(prepared,smoothstep(0.,1.6,min(edge.x,min(edge.y,edge.z)))*(1.-smoothstep(32.,48.,depth))*regionWeights[i]);}
 float surface=linearDepth(texture2D(bodyDepth,gl_FragCoord.xy/resolution).r);if(depth>surface+.15)discard;
 float breakup=.65+.35*sin(world.y*.23+world.z*.17+world.x*.11);float alpha=(1.-prepared)*.32*breakup*exp(-max(0.,depth-30.)*.012)*(1.-smoothstep(110.,150.,depth));if(alpha<.005)discard;gl_FragColor=vec4(vec3(.65,.18,.035)*gain,alpha);}`})
 const mesh=new LineSegments(geometry,material);mesh.name='static-forest-preview';mesh.layers.set(2);mesh.frustumCulled=false
 const floorGeometry=groundPreviewGeometry(layout),floorMaterial=new ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,blending:AdditiveBlending,toneMapped:false,vertexShader:material.vertexShader,
  fragmentShader:material.fragmentShader.replace('void main(){','float fiber(float v){float width=max(.002,fwidth(v)),distance=abs(fract(v+.5)-.5);return (1.-smoothstep(width*.55,width*1.5,distance))*(1.-smoothstep(.3,.9,width));}\nvoid main(){float a=world.x*.85+.35*sin(world.z*.9)+.22*sin(world.x*.41+world.z*.32);float b=world.z*.9+.4*sin(world.x*.75)+.2*sin(world.z*.5-world.x*.28);float weave=max(fiber(a),fiber(b));')
   .replace('(1.-prepared)*.32*breakup','(1.-prepared)*.38*breakup*weave')})
 const floorMesh=new Mesh(floorGeometry,floorMaterial);floorMesh.name='woven-ground-preview';floorMesh.layers.set(2);floorMesh.frustumCulled=false
 function regions(regions:{min:P;max:P;weight?:number}[]){uniforms.regionCount.value=Math.min(2,regions.length);regions.slice(0,2).forEach((r,i)=>{uniforms.regionMin.value[i].set(...r.min);uniforms.regionMax.value[i].set(...r.max);uniforms.regionWeights.value[i]=r.weight??1})}
 return {mesh,floorMesh,floorGeometry,floorMaterial,geometry,material,uniforms,regions,vertices:position.length/3+floorGeometry.getAttribute('position').count,bytes:position.byteLength+floorGeometry.getAttribute('position').array.byteLength+floorGeometry.index!.array.byteLength,buildMilliseconds:performance.now()-start}
}
