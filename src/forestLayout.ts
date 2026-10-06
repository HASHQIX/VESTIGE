import {CatmullRomCurve3,Vector3} from 'three'
import {forestFloor} from './forestNavigation.ts'
export type P=[number,number,number]
export type MushroomShape={kind:'mushroom';id:number;x:number;z:number;height:number;radius:number;hue:number;base?:number;host?:number}
export type BridgeShape={kind:'bridge';id:number;points:P[];width:number;hue:number;walkable?:boolean;arch?:boolean}
export type OrganShape=MushroomShape|BridgeShape
export function seeded(seed:number) {return () => {seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
export function crownOf(m:MushroomShape):P{return [m.x+Math.sin(m.z*.13)*m.height*.10,(m.base??forestFloor(m.x,m.z))+m.height,m.z+Math.cos(m.x*.14)*m.height*.06]}
export function growthClearance(m:MushroomShape,others:MushroomShape[],limbs:BridgeShape[]) {
  const c=crownOf(m),r=m.radius*1.14+.28,ry=m.radius*.22+.30
  for(const other of others) {
    const b=crownOf(other),rr=other.radius*1.14+.28,hy=other.radius*.22+.30
    if(Math.hypot(c[0]-b[0],c[2]-b[2])<r+rr&&Math.abs(c[1]-b[1])<ry+hy)return false
    const ob=other.base??forestFloor(other.x,other.z),sr=other.radius*(other.radius>10 ? .46 : .31)+.22
    for(let i=0;i<=12;i++){const t=i/12,p=[other.x+(b[0]-other.x)*t,ob+other.height*t,other.z+(b[2]-other.z)*t];if(((p[0]-c[0])/(r+sr))**2+((p[1]-c[1])/(ry+sr))**2+((p[2]-c[2])/(r+sr))**2<1)return false}
    const mb=m.base??forestFloor(m.x,m.z),mr=m.radius*(m.radius>10 ? .46 : .31)+.22
    for(let i=0;i<=12;i++){const t=i/12,p=[m.x+(c[0]-m.x)*t,mb+m.height*t,m.z+(c[2]-m.z)*t];if(((p[0]-b[0])/(rr+mr))**2+((p[1]-b[1])/(hy+mr))**2+((p[2]-b[2])/(rr+mr))**2<1)return false}
  }
  for(const limb of limbs)for(let i=0;i<limb.points.length;i+=2){const p=limb.points[i];if(Math.hypot(p[0]-c[0],p[2]-c[2])<r+limb.width*.9&&c[1]-ry<p[1]+4.5&&c[1]+ry>p[1]-7.6)return false}
  const base=m.base??forestFloor(m.x,m.z),stem=m.radius*(m.radius>10 ? .46 : .31)+.22
  for(const limb of limbs)for(let i=0;i<limb.points.length;i+=2){const p=limb.points[i],y=p[1]+1
    if(y<base-stem||y>c[1]+stem)continue
    const t=Math.max(0,Math.min(1,(y-base)/m.height)),x=m.x+(c[0]-m.x)*t,z=m.z+(c[2]-m.z)*t
    if(Math.hypot(x-p[0],z-p[2])<stem+.75)return false
  }
  return true
}
export function createForestLayout() {
  const random=seeded(73421),nodes:P[]=[[0,forestFloor(0,22),22],[-12,10,-15],[8,18,-55],[-14,26,-95],[4,35,-137],[35,18,-62],[-35,11,-90],[-22,51,-58],[30,43,-110],[-20,29,-143],[-42,41,-100],[27,12,-140],[-45,forestFloor(-45,-8),-8],[45,forestFloor(45,-20),-20],[-48,forestFloor(-48,-105),-105],[35,forestFloor(35,-165),-165],[-5,forestFloor(-5,-170),-170],[14,57,-40],[42,51,-70],[-8,10,-155],[-30,34,-129]]
  const links=[[0,1,2,.1],[1,2,3,1.3],[2,3,2,2.2],[3,4,4,3.4],[2,5,4,3.2],[5,3,4,.5],[1,6,3,2.4],[6,3,2,.4],[6,19,1,1.6],[4,8,5,.6],[8,18,3,2.1],[18,17,6,3.4],[17,7,3,1.4],[7,10,7,2.8],[10,20,5,.8],[20,9,2,1.7],[9,4,2,3.4],[19,11,1,2.6],[11,4,2,.4],[3,9,4,1.2],[5,11,3,2.7],[3,20,5,.6],[12,1,2,.4],[13,5,4,1.8],[14,6,3,2.4],[15,11,2,3.3],[16,19,2,.8]]
  const bridges:BridgeShape[]=links.map(([a,b,lift,hue],id) => {
    const start=new Vector3(...nodes[a]),end=new Vector3(...nodes[b]),side=new Vector3(-(end.z-start.z),0,end.x-start.x).normalize(),rise=Math.min(1.2,lift*.25),required=(Math.abs(end.y-start.y)+rise*Math.PI)/.30
    let samples:Vector3[]=[],length=0
    // Lengthen short ascents with broad bends. Height follows horizontal arc length, not spline time.
    for(let attempt=0;attempt<12;attempt++){
      // This lower limb sweeps around the elevated node instead of clipping its flank.
      const amplitude=attempt===0?(id===19?8:Math.max(1.2,Math.min(4,Math.abs(Math.sin(id*2.3))*4))):Math.min(65,attempt*6),waves=1,knots=[start.clone().setY(0)]
      for(let j=1;j<8;j++){const t=j/8,p=start.clone().lerp(end,t).setY(0).addScaledVector(side,Math.sin(t*Math.PI*waves)*(id===25?-1:id===18||id===22||id===26?1:id%2?1:-1)*amplitude);p.x=Math.max(-64,Math.min(64,p.x));p.z=Math.max(-180,Math.min(24,p.z));knots.push(p)}
      knots.push(end.clone().setY(0));samples=new CatmullRomCurve3(knots).getPoints(144);length=samples.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(samples[i]),0)
      if(length>=required)break
    }
    let distance=0;const points=samples.map((p,i)=>{if(i)distance+=p.distanceTo(samples[i-1]);const t=length?distance/length:0;return [p.x,start.y+(end.y-start.y)*t+Math.sin(t*Math.PI)*rise,p.z] as P})
    return {kind:'bridge',id:id+33,points,width:id===0?8:7,hue}
  })
  // Broad rooted limbs continue through shared nodes into the elevated walking network.
  for(const index of [0,9,11,13,22]){bridges[index].arch=true;bridges[index].width=11+index%3}
  const mushrooms:MushroomShape[]=[],specs=[[-58,-8,47,20],[63,-22,50,18],[-56,-66,58,17],[-58,-113,57,19],[61,-87,59,18],[-37,-165,48,17],[64,-164,48,18]]
  const accept=(m:MushroomShape) => {
    const y=(m.base??forestFloor(m.x,m.z))+m.height+m.radius*.03;m.height+=Math.round(y/.4)*.4-y
    if(!growthClearance(m,mushrooms,bridges))return false
    mushrooms.push(m);return true
  }
  for(const [x,z,height,radius] of specs)for(const rise of [0,4,8,12,16,20,24,28,32])if(accept({kind:'mushroom',id:mushrooms.length,x,z,height:height+rise,radius,hue:0}))break
  for(let attempt=0;attempt<600 && mushrooms.length<37;attempt++) {
    const radius=1.1+random()**2*4.1,x=(random()>.5?1:-1)*(9+random()*33),z=18-random()*181
    accept({kind:'mushroom',id:mushrooms.length,x,z,height:1.2+radius*(1.3+random()*1.8),radius,hue:0})
  }
  const groundCount=mushrooms.length
  for(let attempt=0;attempt<2400 && mushrooms.length<groundCount+34;attempt++) {
    const host=bridges[Math.floor(random()*bridges.length)],index=mushrooms.length<groundCount+2?(random()>.5?8:host.points.length-9):8+Math.floor(random()*(host.points.length-16)),p=new Vector3(...host.points[index]),tangent=new Vector3(...host.points[index+1]).sub(p).setY(0).normalize(),side=new Vector3(-tangent.z,0,tangent.x)
    const radius=mushrooms.length<groundCount+2?11+random()*3:mushrooms.length<groundCount+4?5.5+random()*3:1.1+random()**2*2.1,offset=(random()>.5?1:-1)*(host.width*.43+(radius>10?radius*.42:0)),q=p.clone().addScaledVector(side,offset)
    accept({kind:'mushroom',id:mushrooms.length,x:q.x,z:q.z,base:p.y-.82,height:3.0+radius*(1.6+random()*1.3),radius,hue:0,host:host.id})
  }
  return {mushrooms,bridges,nodes,bounds:{minX:-68,maxX:68,minZ:-185,maxZ:28}}
}
export type ForestLayout=ReturnType<typeof createForestLayout>
