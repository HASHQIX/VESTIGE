import {Vector3} from 'three'

// Attention steers preparation, never collision or the protected near-ground
// material. Use the analytic world rather than a synchronous GPU depth readback.
export class ForestFocus {
 readonly point=new Vector3()
 readonly stats={distance:20,targetDistance:20,casts:0,samples:0,hit:false}
 private previous=-Infinity
 private nextCast=0
 private position=new Vector3(Infinity,Infinity,Infinity)
 private readonly field:(x:number,y:number,z:number)=>number
 constructor(field:(x:number,y:number,z:number)=>number){this.field=field}
 update(position:Vector3,direction:Vector3,now:number,manual?:number){
  const first=!Number.isFinite(this.previous),teleport=this.position.distanceToSquared(position)>64
  const dt=first?0:Math.min(.1,Math.max(0,(now-this.previous)/1000));this.previous=now;this.position.copy(position)
  if(first||teleport||now>=this.nextCast){
   let distance=1.2,target=20;this.stats.hit=false
   if(manual!==undefined){target=Math.max(1,Math.min(60,manual));const value=this.field(position.x+direction.x*target,position.y+direction.y*target,position.z+direction.z*target);this.stats.samples++;this.stats.hit=Number.isFinite(value)&&Math.abs(value)<3}
   else for(let i=0;i<96&&distance<=60;i++){
    const value=this.field(position.x+direction.x*distance,position.y+direction.y*distance,position.z+direction.z*distance);this.stats.samples++
    if(!Number.isFinite(value))break
    if(value<=.08){target=distance;this.stats.hit=true;break}
    distance+=Math.max(.25,Math.min(1,Math.abs(value)*.65))
   }
   this.stats.targetDistance=target;this.stats.casts++;this.nextCast=now+250
  }
  if(manual!==undefined)this.stats.targetDistance=Math.max(1,Math.min(60,manual))
  if(first||teleport)this.stats.distance=this.stats.targetDistance
  else this.stats.distance+=(this.stats.targetDistance-this.stats.distance)*(1-Math.exp(-4*dt))
  this.point.copy(position).addScaledVector(direction,this.stats.distance)
  return this.point
 }
}
