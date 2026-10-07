import {AdditiveBlending,BufferGeometry,Float32BufferAttribute,Group,Points,PointsMaterial} from 'three'

const TAU=Math.PI*2

function seeded(value:number){let state=value>>>0;return()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}}
function skyPoint(angle:number,elevation:number,radius:number){return [Math.sin(angle)*Math.cos(elevation)*radius,Math.sin(elevation)*radius,-Math.cos(angle)*Math.cos(elevation)*radius]}

export function createSkySilhouette(orientation:number,_native:boolean){
 const radius=209,random=seeded(104729)
 const starMaterials=[
  new PointsMaterial({color:0xffc879,size:8,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,depthTest:false}),
  new PointsMaterial({color:0xffa24c,size:14,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,depthTest:false}),
  new PointsMaterial({color:0xfff0c2,size:20,sizeAttenuation:false,transparent:true,opacity:0,depthWrite:false,depthTest:false}),
 ]
 for(const material of starMaterials){material.fog=false;material.blending=AdditiveBlending;material.toneMapped=false}
 const starPhases=[random()*TAU,random()*TAU,random()*TAU],stars:Points[]=[]
 const starCounts=[180,90,36]
 for(let groupIndex=0;groupIndex<starMaterials.length;groupIndex++){
  const positions:number[]=[]
  for(let index=0;index<starCounts[groupIndex];index++){
   const angle=orientation+(random()-.5)*TAU
   const elevation=.32+random()*.92
   const point=skyPoint(angle,elevation,radius+random()*12)
   positions.push(point[0],point[1],point[2])
  }
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  const points=new Points(geometry,starMaterials[groupIndex]);points.frustumCulled=false;points.renderOrder=-2;stars.push(points)
 }

 const group=new Group();group.name='procedural-sky-stars';group.add(...stars);group.frustumCulled=false;group.renderOrder=-1;group.visible=false
 const gain={value:0}
 return {
  mesh:group,count:starCounts.reduce((total,value)=>total+value,0),orientation,gain,proximity:1,enabled:false,
  update:(elapsed:number)=>{
   for(let index=0;index<stars.length;index++){
    const pulse=.86+.14*Math.sin(elapsed*(.18+index*.07)+starPhases[index])
    starMaterials[index].opacity=Math.min(1,gain.value*(.74+index*.16)*pulse)
   }
  },
  dispose:()=>{
   for(const points of stars)(points.geometry as BufferGeometry).dispose()
   for(const material of starMaterials)material.dispose()
  },
 }
}
