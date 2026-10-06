// Shared by the long fibers and the secondary fragments: reconstruction always
// evaluates from immutable rest coordinates, so no integration error accumulates.
export const matterMotionGLSL=`
  uniform float clock;uniform float activity;uniform float dissolve;uniform vec3 dissolveCenter;
  vec3 matterCurl(vec3 p){
    return vec3(.8*cos(p.x+.8*p.y+1.3)-cos(p.z+.6*p.x+.4),
      .7*cos(p.y+.7*p.z+2.1)-cos(p.x+.8*p.y+1.3),
      .6*cos(p.z+.6*p.x+.4)-cos(p.y+.7*p.z+2.1));
  }
  float unravel(vec3 p){
    float warp=sin(p.x*.39+p.z*.28)*.55+sin(p.y*.7-p.z*.24)*.35;
    return dissolve*(1.-smoothstep(3.0,9.0,length(p-dissolveCenter)+warp));
  }
  vec3 matterPosition(vec3 p,vec3 direction){
    float d=unravel(p),time=clock*.16;
    vec3 curl=matterCurl(p*.27+vec3(time,-time*.6,time*.4));
    // Broad correlated drift peels strands away before their light fragments.
    vec3 attached=matterCurl(p*.19+vec3(time*.4))*.045*activity;
    return p+attached+curl*d*(.45+2.3*d)+direction*d*(.5+3.0*d)+vec3(0.,d*d*1.5,0.);
  }
`
export function advanceDissolve(value:number,target:number,dt:number){
  const step=Math.min(.05,Math.max(0,dt))*.24
  return Math.abs(target-value)<=step?target:value+Math.sign(target-value)*step
}
