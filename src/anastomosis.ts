import {periodicDelta,type CellNetwork,type UV} from './cellNetwork.ts'
// Weld every added growth tip to an existing cell edge, splitting that edge at the attachment.
export function attachTip(net:CellNetwork,tip:number) {
  const p=net.nodes[tip].uv;let best=Infinity,at=-1,fraction=0,point:UV=[0,0]
  net.edges.forEach((edge,id) => {
    if(edge.source!=='cell'||edge.a===tip||edge.b===tip)return
    const a=net.nodes[edge.a].uv,b=net.nodes[edge.b].uv,dx=b[0]-a[0],dy=periodicDelta(a[1],b[1],net.period),px=p[0]-a[0],py=periodicDelta(a[1],p[1],net.period),t=Math.max(0,Math.min(1,(px*dx+py*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(px-dx*t,py-dy*t)
    if(d<best){best=d;at=id;fraction=t;point=[a[0]+dx*t,a[1]+dy*t]}
  })
  if(at<0)return
  const edge=net.edges[at];let join:number
  if(fraction<.02)join=edge.a
  else if(fraction>.98)join=edge.b
  else{join=net.nodes.length;net.nodes.push({uv:point});const old=edge.b;edge.b=join;net.edges.push({...edge,a:join,b:old})}
  if(best<1e-5){net.edges.forEach(e => {if(e.a===tip)e.a=join;if(e.b===tip)e.b=join});return}
  net.edges.push({a:tip,b:join,load:0,level:2,source:'growth'})
}

// Small capillary loops split and rejoin the same parent edge; they cannot leave free ends.
export function capillaryLoops(net:CellNetwork,seed:number) {
  let state=seed>>>0;const random=() => {state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
  const edges=[...net.edges]
  for(const edge of edges) {
    if(edge.source!=='cell'||random()>.23)continue
    const a=net.nodes[edge.a].uv,b=net.nodes[edge.b].uv,dx=b[0]-a[0],dy=periodicDelta(a[1],b[1],net.period),length=Math.hypot(dx,dy)
    if(length<.5)continue
    const from=.12+random()*.2,to=.62+random()*.2,bow=length*(.08+random()*.1)*(random()>.5 ? 1 : -1)
    const add=(t:number,w:number) => {const id=net.nodes.length;net.nodes.push({uv:[Math.max(0,Math.min(net.length,a[0]+dx*t-dy/length*w)),a[1]+dy*t+dx/length*w]});return id}
    const start=add(from,0),end=add(to,0),mid=add((from+to)*.5,bow),old=edge.b;edge.b=start
    net.edges.push({...edge,a:start,b:end},{...edge,a:end,b:old},{a:start,b:mid,load:0,level:2,source:'growth'},{a:mid,b:end,load:0,level:2,source:'growth'})
  }
}
