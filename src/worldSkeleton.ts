import {CatmullRomCurve3,Vector3} from 'three'
import {type ForestLayout,type P} from './forestLayout.ts'
import {forestFloor} from './forestNavigation.ts'
export type WorldLimb={id:number;kind:'limb'|'root'|'arch';from:number;to:number;points:P[];rx:number;ry:number}
export type WorldNode={id:number;position:P;degree:number;fungus?:number}
export function limbRadii(limb:WorldLimb,t:number){const swell=Math.sin(Math.PI*t)**2;if(limb.kind==='arch')return {rx:limb.rx*(1.12-.38*swell+.07*Math.sin(t*9+limb.id)),ry:limb.ry*(1.10-.38*swell+.05*Math.cos(t*11+limb.id))};return limb.kind==='root' ? {rx:limb.rx*(1+.20*Math.sin(t*7+limb.id)),ry:limb.ry*(1+.16*Math.sin(t*5+limb.id))} : {rx:limb.rx*(1.28-.34*swell+.10*Math.sin(t*8+limb.id)),ry:1.15+.55*swell*(.6+.4*Math.sin(limb.id*1.7)**2)}}
export type WorldSkeleton={nodes:WorldNode[];limbs:WorldLimb[];hubs:WorldNode[];attachments:{node:number;limb:number;sample:number}[]}
export function worldSkeleton(layout:ForestLayout):WorldSkeleton {
  const nodes:WorldNode[]=layout.nodes.map((position,id) => ({id,position,degree:0})),limbs:WorldLimb[]=[],attachments:{node:number;limb:number;sample:number}[]=[]
  const nearestNode=(p:P) => {let best=Infinity,id=0;nodes.slice(0,layout.nodes.length).forEach(n => {const d=new Vector3(...p).distanceToSquared(new Vector3(...n.position));if(d<best){best=d;id=n.id}});return id}
  for(const command of layout.bridges){const from=nearestNode(command.points[0]),to=nearestNode(command.points.at(-1)!);nodes[from].degree++;nodes[to].degree++;limbs.push({id:command.id,kind:command.arch?'arch':'limb',from,to,points:command.points.filter((_,i) => i%6===0),rx:command.width*.49,ry:command.arch?command.width*.12:1.05})}
  // Sagging roots grow out of two existing limbs; their forks fuse into one shared volume.
  const structural=[...limbs]
  for(let i=0;i<8&&structural.length>8;i++) {
    const host=structural[i+1],neighbor=structural[(i+5)%structural.length],a=host.points[Math.floor(host.points.length*.42)],b=neighbor.points[Math.floor(neighbor.points.length*.58)]
    if(Math.hypot(a[0]-b[0],a[2]-b[2])<8)continue
    const start=new Vector3(...a).add(new Vector3(0,-limbRadii(host,.42).ry,0)),end=new Vector3(...b).add(new Vector3(0,-limbRadii(neighbor,.58).ry,0))
    const middle=start.clone().lerp(end,.5);middle.y=Math.max(forestFloor(middle.x,middle.z)-.7,Math.min(start.y,end.y)-6-i*.35)
    const from=nodes.length;nodes.push({id:from,position:start.toArray() as P,degree:3});const to=nodes.length;nodes.push({id:to,position:end.toArray() as P,degree:3})
    limbs.push({id:2000+i,kind:'root',from,to,points:new CatmullRomCurve3([start,middle,end]).getPoints(24).map(p=>p.toArray() as P),rx:1.0+i%3*.32,ry:.65+i%3*.22})
    if(i%2===0){const fork=middle.clone(),target=new Vector3(...structural[i+2].points[12]);target.y-=limbRadii(structural[i+2],.5).ry
      const control=fork.clone().lerp(target,.5);control.y-=2
      const forkNode=nodes.length;nodes.push({id:forkNode,position:fork.toArray() as P,degree:3});const node=nodes.length;nodes.push({id:node,position:target.toArray() as P,degree:3})
      limbs.push({id:2100+i,kind:'root',from:forkNode,to:node,points:new CatmullRomCurve3([fork,control,target]).getPoints(18).map(p=>p.toArray() as P),rx:.8,ry:.55})
    }
  }
  // Hanging connective roots stay beneath nearby walking surfaces, leaving headroom.
  for(const root of limbs.filter(l=>l.kind==='root'))for(let i=0;i<root.points.length;i++){
    const p=root.points[i]
    for(const host of structural)for(const q of host.points)if(Math.hypot(p[0]-q[0],p[2]-q[2])<host.rx+1&&p[1]+root.ry>q[1]-.5&&p[1]-root.ry<q[1]+2.5)p[1]=q[1]-root.ry-.8
  }
  for(let i=limbs.length-1;i>=0;i--){const limb=limbs[i];if(limb.kind!=='root')continue
    let obstruction=false
    for(let j=1;j<limb.points.length&&!obstruction;j++)for(let t=0;t<=1&&!obstruction;t+=.2){const a=limb.points[j-1],b=limb.points[j],p=new Vector3(...a).lerp(new Vector3(...b),t)
      for(const host of layout.bridges)for(let k=0;k<host.points.length;k+=2){const q=host.points[k];if(Math.hypot(p.x-q[0],p.z-q[2])<host.width*.6+limb.rx&&p.y+limb.ry>q[1]+.3&&p.y-limb.ry<q[1]+3)obstruction=true}
    }
    if(obstruction)limbs.splice(i,1)
  }
  for(const m of layout.mushrooms) {
    const base:P=[m.x,(m.base??forestFloor(m.x,m.z))+.1,m.z],id=nodes.length
    nodes.push({id,position:base,degree:1,fungus:m.id})
    if(m.host===undefined)continue // Ground fungi grow from the world's soil, never from bridge tethers.
    let distance=Infinity,host=limbs.find(l=>l.id===m.host),index=0
    for(const limb of limbs.filter(l => l.kind!=='root'&&l.id===m.host))for(let i=0;i<limb.points.length;i++){const d=new Vector3(...base).distanceToSquared(new Vector3(...limb.points[i]));if(d<distance){distance=d;host=limb;index=i}}
    if(!host)continue
    const start=new Vector3(...host.points[index]);start.y-=.8
    const end=new Vector3(...base);end.y-=.3
    const middle=start.clone().lerp(end,.5);middle.y-=Math.min(2,Math.sqrt(distance)*.11)
    const from=nodes.length;nodes.push({id:from,position:start.toArray() as P,degree:3})
    attachments.push({node:from,limb:host.id,sample:index})
    limbs.push({id:1000+m.id,kind:'root',from,to:id,points:new CatmullRomCurve3([start,middle,end]).getPoints(6).map(p => p.toArray() as P),rx:Math.max(.62,Math.min(1.8,m.radius*.16)),ry:Math.max(.55,Math.min(1.5,m.radius*.13))})
  }
  return {nodes,limbs,hubs:nodes.slice(0,layout.nodes.length).filter(n=>n.degree>0),attachments}
}
