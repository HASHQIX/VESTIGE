// At most two dense regions are rendered. Retire the old secondary region before
// admitting the next; a newly reached primary region may take a slot immediately.
export class ForestReveal {
 readonly regions=new Map<string,{progress:number;target:number}>()
 private desired:string[]=[]
 constructor(initial:string){this.regions.set(initial,{progress:1,target:1})}
 select(keys:string[],primary?:string){
  this.desired=keys.slice(0,2)
  for(const [key,state] of this.regions)state.target=this.desired.includes(key)?1:0
  if(primary&&this.desired.includes(primary)&&!this.regions.has(primary)&&this.regions.size===2){
   const retire=[...this.regions].filter(([key])=>key!==primary).sort((a,b)=>a[1].target-b[1].target||a[1].progress-b[1].progress)[0]
   if(retire)this.regions.delete(retire[0])
  }
  this.admit()
 }
 private admit(){for(const key of this.desired)if(!this.regions.has(key)&&this.regions.size<2)this.regions.set(key,{progress:0,target:1})}
 forget(key:string){this.regions.delete(key);this.desired=this.desired.filter(k=>k!==key)}
 advance(dt:number){
  for(const [key,state] of this.regions){
   const step=Math.max(0,Math.min(.1,dt))/.7
   state.progress=state.target?Math.min(1,state.progress+step):Math.max(0,state.progress-step)
   if(!state.target&&state.progress===0)this.regions.delete(key)
  }
  this.admit()
 }
 weight(key:string){const t=this.regions.get(key)?.progress??0;return t*t*(3-2*t)}
 get settling(){return [...this.regions.values()].some(s=>s.progress!==s.target)||this.desired.some(k=>!this.regions.has(k))}
}
