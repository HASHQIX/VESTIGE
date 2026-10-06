import {Vector3,Vector4} from 'three'
export const footPulses=()=>Array.from({length:4},()=>new Vector4(0,0,0,-1000))

// Four short world-space waves reuse the existing fibers and particle histories.
// No extra geometry, simulation buffers or fullscreen pass is needed.
export class FootstepWaves {
 readonly stats={emitted:0,active:0}
 private previous=new Vector3()
 private initialized=false
 private distance=0
 private time=-Infinity
 private slot=0
 readonly pulses:Vector4[]
 constructor(pulses=footPulses()){this.pulses=pulses}
 update(position:Vector3,grounded:boolean,clock:number){
  const moved=this.initialized?this.previous.distanceTo(position):0
  if(!this.initialized||moved>3||clock<this.time){this.distance=0;this.pulses.forEach(p=>p.w=-1000)}
  else if(grounded){
   this.distance+=Math.hypot(position.x-this.previous.x,position.z-this.previous.z)
   if(this.distance>=1.1){this.distance%=1.1;this.pulses[this.slot].set(position.x,position.y-1.7,position.z,clock);this.slot=(this.slot+1)%this.pulses.length;this.stats.emitted++}
  }else this.distance=0
  this.previous.copy(position);this.initialized=true;this.time=clock
  this.stats.active=this.pulses.filter(p=>clock>=p.w&&clock-p.w<2.4).length
 }
}

export const footWaveGLSL=`
 uniform vec4 footPulses[4];
 float footWave(vec3 p){float energy=0.;
  for(int i=0;i<4;i++){vec4 pulse=footPulses[i];float age=clock-pulse.w;
   if(age>=0.&&age<2.4){vec3 delta=p-pulse.xyz;float r=age*3.2;
    if(abs(delta.y)<1.6&&dot(delta.xz,delta.xz)<64.){
     float band=(length(delta.xz)-r)/.65;
     energy+=exp(-band*band-delta.y*delta.y*2.-age*1.25);
    }
   }
  }return min(1.,energy);
 }
`
