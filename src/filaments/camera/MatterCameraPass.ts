import {Color,HalfFloatType,Matrix4,ShaderMaterial,Vector2,WebGLRenderTarget,type Texture,type WebGLRenderer} from 'three'
import {Pass,FullScreenQuad} from 'three/addons/postprocessing/Pass.js'
import {defaultMatterCamera,historyDecay,type MatterCameraSettings} from './matterCameraSettings'
const vertex=`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const common=`varying vec2 uv0;uniform sampler2D current;uniform sampler2D history;uniform sampler2D velocity;uniform sampler2D flow;uniform sampler2D body;uniform vec2 resolution;uniform vec2 range;
uniform mat4 inverseVP;uniform mat4 previousVP;uniform float decay;uniform float trail;uniform float velocityScale;uniform float threshold;uniform float smear;uniform float flowLength;uniform float curvature;uniform float layers;uniform float noiseAmount;uniform float guard;
float brightness(vec3 c){return max(c.r,max(c.g,c.b));}
float linearDepth(float z){return 2.*range.x*range.y/(range.y+range.x-(z*2.-1.)*(range.y-range.x));}
vec3 bright(vec3 c){return c*smoothstep(threshold,threshold+.55,brightness(c));}
bool inside(vec2 p){return p.x>=0.&&p.y>=0.&&p.x<=1.&&p.y<=1.;}
// RG = real point motion, B = current depth, A = this point's previous depth.
vec4 surface(vec2 p){vec4 v=texture2D(velocity,p);if(v.b>.05)return v;
 float z=texture2D(body,p).r;if(z>=.99999)return vec4(0.);
 vec4 world=inverseVP*vec4(p*2.-1.,z*2.-1.,1.);world/=world.w;vec4 old=previousVP*world;
 return old.w>.05?vec4(p-(old.xy/old.w*.5+.5),linearDepth(z),old.w):vec4(0.);
}
// Flow stays separate from velocity. Fill only narrow gaps in a visible layer.
vec4 flowAt(vec2 p,float depth){vec4 f=texture2D(flow,p);if(f.b>.05&&abs(f.b-depth)<guard)return f;
 for(int i=0;i<4;i++){vec2 offset=vec2(i==0?2.:i==1?-2.:0.,i==2?2.:i==3?-2.:0.)/resolution;vec4 n=texture2D(flow,p+offset);if(n.b>.05&&abs(n.b-depth)<guard)return n;}
 return vec4(0.);
}
`
const flowSmear=common+`
vec3 integrate(vec2 origin,vec4 center,float direction){
 vec2 axis=normalize(center.rg*resolution+vec2(.000001))*direction,initial=axis,p=origin;
 vec3 micro=vec3(0.),medium=vec3(0.),longer=vec3(0.);float wm=0.,wd=0.,wl=0.;float depth=center.b;
 // 12 steps on each side. Step length changes across three physical scales.
 for(int i=0;i<12;i++){
  float stride=(i<4?1.5:i<8?4.5:9.)*flowLength/60.;
  vec4 local=flowAt(p,depth);if(local.b<.05)break;
  vec2 nextAxis=normalize(local.rg*resolution+vec2(.000001));if(dot(nextAxis,axis)<0.)nextAxis=-nextAxis;
  axis=normalize(mix(initial,nextAxis,curvature)+vec2(.000001));
  vec2 midpoint=p+axis/resolution*stride*.5;vec4 halfField=flowAt(midpoint,depth);if(halfField.b<.05)break;
  vec2 midAxis=normalize(halfField.rg*resolution+vec2(.000001));if(dot(midAxis,axis)<0.)midAxis=-midAxis;
  axis=normalize(mix(initial,midAxis,curvature)+vec2(.000001));p+=axis/resolution*stride;
  if(!inside(p))break;vec4 sampleFlow=flowAt(p,depth);if(sampleFlow.b<.05||abs(sampleFlow.b-center.b)>guard*2.)break;depth=sampleFlow.b;
  // Coordinate signal comes from immutable material positions, never screen grain.
  float breakup=mix(1.,smoothstep(.18,.42,.5+.5*sin(sampleFlow.a*38.+center.a*11.)),noiseAmount);
  float speedVariation=.3+1.5*sampleFlow.a;float w=breakup*speedVariation;
  vec3 c=bright(texture2D(current,p).rgb);
  if(i<4){micro+=c*w;wm+=1.;}else if(i<8){medium+=c*w;wd+=1.;}else{longer+=c*w;wl+=1.;}
 }
 float rare=smoothstep(.88,.97,center.a);
 return micro/max(1.,wm)*.55+medium/max(1.,wd)*.3*step(1.5,layers)+longer/max(1.,wl)*.15*rare*step(2.5,layers);
}
void main(){vec3 base=texture2D(current,uv0).rgb;vec4 s=surface(uv0),f=flowAt(uv0,s.b);vec3 light=vec3(0.);
 if(s.b>.05&&f.b>.05&&flowLength>.01)light=(integrate(uv0,f,1.)+integrate(uv0,f,-1.))*.5;
 gl_FragColor=vec4(base+light*smear,1.);
}`
const feedback=common+`void main(){vec3 c=texture2D(current,uv0).rgb;vec4 s=surface(uv0);vec2 previousUV=uv0-s.rg;
 vec4 h=texture2D(history,clamp(previousUV,vec2(0.),vec2(1.)));
 float valid=inside(previousUV)&&s.b>.05&&s.a>.05&&h.a>.05&&abs(h.a-s.a)<guard?1.:0.;
 vec3 low=c,high=c;for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){vec3 n=texture2D(current,uv0+vec2(float(x),float(y))*2./resolution).rgb;low=min(low,n);high=max(high,n);}}
 vec3 bounded=clamp(h.rgb,low*.8,high*1.1+vec3(.01));
 float hot=smoothstep(.03,.3,brightness(high));float moving=smoothstep(.05,1.,length(s.rg*resolution));
 // Proper reprojection has unit scale. Trail length cannot move the history UV.
 float weight=decay*valid*hot*(.20+.55*moving);vec3 accumulated=mix(c,bounded,weight);
 gl_FragColor=vec4(min(accumulated,vec3(12.)),s.b);
}`
const motionTrail=common+`uniform sampler2D sharp;void main(){vec3 processed=texture2D(current,uv0).rgb;vec4 s=surface(uv0);vec2 v=clamp(s.rg*velocityScale*trail,vec2(-.025),vec2(.025));vec3 sum=vec3(0.);float weights=0.;
 vec4 materialFlow=flowAt(uv0,s.b);float variation=.3+1.5*materialFlow.a;
 if(s.b>.05){for(int i=0;i<12;i++){float t=float(i)/11.;vec2 p=uv0-v*t*variation;vec4 n=surface(p);float w=(1.-t*.75)*(inside(p)&&n.b>.05&&abs(n.b-s.b)<guard?1.:0.);sum+=bright(texture2D(current,p).rgb)*w;weights+=w;}}
 vec3 raw=texture2D(sharp,uv0).rgb;vec3 trails=sum/max(weights,.001);
 gl_FragColor=vec4(max(raw,processed)+max(trails-processed,vec3(0.))*.45,1.);
}`
const copy=`varying vec2 uv0;uniform sampler2D current;void main(){gl_FragColor=texture2D(current,uv0);}`
export type CameraStats={lens?:{enabled:boolean;zoom:number;sceneRenders:number};mode:string;frames:number;resets:number;lastReset:string;width:number;height:number;particles:number;probeDof?:()=>{near:number;far:number;sharp:number};focusDof?:{enabled:boolean;focusDistance:number;width:number;height:number;scale:number;taps:number;quality:string;frameMilliseconds:number;sceneRenders:number};velocityWork?:{combined:boolean;drawCalls:number;triangles:number};compareVelocity?:()=>{differentValues:number;combined:{drawCalls:number;triangles:number};reference:{drawCalls:number;triangles:number}};probe?:()=>{worldTrailTravel:number;maxVelocity:number;litPixels:number;historyEnergy:number;flowEnergy:number;unattachedHistoryPixels:number;flowPixels:number;flowDirectionSpread:number}}
export class MatterCameraPass extends Pass{
 readonly histories=[0,1].map(()=>new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:false}))
 readonly flowTarget=new WebGLRenderTarget(1,1,{type:HalfFloatType,depthBuffer:false})
 readonly uniforms={current:{value:null as Texture|null},history:{value:null as Texture|null},velocity:{value:null as Texture|null},flow:{value:null as Texture|null},body:{value:null as Texture|null},resolution:{value:new Vector2(1,1)},range:{value:new Vector2(.05,350)},inverseVP:{value:new Matrix4()},previousVP:{value:new Matrix4()},decay:{value:.85},trail:{value:.7},velocityScale:{value:1},threshold:{value:.8},smear:{value:.65},flowLength:{value:60},curvature:{value:1},layers:{value:3},noiseAmount:{value:.55},guard:{value:.55},sharp:{value:null as Texture|null}}
 readonly materials=[flowSmear,feedback,motionTrail,copy].map(fragmentShader=>new ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,fragmentShader,depthTest:false,depthWrite:false,toneMapped:false}))
 readonly quad=new FullScreenQuad(this.materials[0]);settings:MatterCameraSettings={...defaultMatterCamera};index=0;dirty=true
 constructor(readonly stats:CameraStats){super()}
 reset(reason:string){this.dirty=true;this.stats.frames=0;this.stats.resets++;this.stats.lastReset=reason}
 setSize(w:number,h:number){const width=Math.max(1,Math.round(w*.75)),height=Math.max(1,Math.round(h*.75));this.histories.forEach(t=>t.setSize(width,height));this.flowTarget.setSize(width,height);this.uniforms.resolution.value.set(width,height);this.stats.width=width;this.stats.height=height;this.reset('resize')}
 render(renderer:WebGLRenderer,write:WebGLRenderTarget,read:WebGLRenderTarget,dt:number){
  const target=renderer.getRenderTarget(),color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),u=this.uniforms,s=this.settings
  const draw=(material:number,destination:WebGLRenderTarget|null)=>{this.quad.material=this.materials[material];renderer.setRenderTarget(destination);this.quad.render(renderer)}
  try{
   u.current.value=read.texture;if(!s.temporal){draw(3,this.renderToScreen?null:write);return}
   if(this.dirty){renderer.setClearColor(0,0);for(const t of this.histories){renderer.setRenderTarget(t);renderer.clear()}this.dirty=false}
   u.decay.value=historyDecay(s.persistence,dt);u.trail.value=s.trailLength;u.velocityScale.value=s.velocityScale;u.threshold.value=s.streakThreshold;u.smear.value=s.flowSmear;u.flowLength.value=s.flowLength*.75;u.curvature.value=s.flowCurvature;u.layers.value=s.flowLayers;u.noiseAmount.value=s.flowNoise;u.guard.value=s.depthGuard
   // Flow shapes the light first. Reprojected history is a secondary layer.
   draw(0,this.flowTarget);u.current.value=this.flowTarget.texture;u.history.value=this.histories[this.index].texture;draw(1,this.histories[1-this.index])
   u.current.value=this.histories[1-this.index].texture;u.sharp.value=read.texture;draw(2,this.renderToScreen?null:write)
   this.index=1-this.index;this.stats.frames++
  }finally{renderer.setClearColor(color,alpha);renderer.setRenderTarget(target)}
 }
 dispose(){this.histories.forEach(t=>t.dispose());this.flowTarget.dispose();this.materials.forEach(m=>m.dispose());this.quad.dispose()}
}
