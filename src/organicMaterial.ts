import {ShaderMaterial,Vector2,DoubleSide} from 'three'
export type ForestUniforms={clock:{value:number};sway:{value:number};resolution:{value:Vector2}}
export const colourGLSL=`
float worldHue(vec3 p){return p.y*.065+p.z*.030+p.x*.080+.70*sin(p.x*.10+p.z*.055)+.30*sin(length(p-vec3(-9.,10.,-15.))*.075);}
vec3 tissueColour(float h) {
  vec3 cyan=vec3(.04,.85,1.),blue=vec3(.05,.23,1.),violet=vec3(.62,.12,1.),pink=vec3(1.,.12,.72),green=vec3(.50,1.,.32);
  float t=mod(h,5.);if(t<0.)t+=5.;
  if(t<1.)return mix(cyan,blue,t);if(t<2.)return mix(blue,violet,t-1.);
  if(t<3.)return mix(violet,pink,t-2.);if(t<4.)return mix(pink,green,t-3.);return mix(green,cyan,t-4.);
}
`
const noiseGLSL=`
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){return .57*noise3(p)+.28*noise3(p*2.03+7.2)+.15*noise3(p*4.13-3.1);}
float filament(float phase,float width){float d=abs(sin(phase));float aa=max(.004,fwidth(phase)*.65);return (1.-smoothstep(width,width+aa,d))*(1.-smoothstep(.55,2.2,fwidth(phase)));}
`
export function createOrganicMaterial(uniforms:ForestUniforms) {
  return new ShaderMaterial({uniforms,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,toneMapped:false,
    vertexShader:`attribute vec3 surface;attribute vec4 species;varying vec3 flow;varying vec4 organ;varying vec3 worldP;varying vec3 nView;varying vec3 viewP;
    void main(){flow=surface;organ=species;worldP=position;vec4 v=modelViewMatrix*vec4(position,1.);viewP=v.xyz;nView=normalize(normalMatrix*normal);gl_Position=projectionMatrix*v;}`,
    fragmentShader:`uniform float clock;uniform float sway;varying vec3 flow;varying vec4 organ;varying vec3 worldP;varying vec3 nView;varying vec3 viewP;
    ${colourGLSL}${noiseGLSL}
    void main(){
      float kind=organ.z;
      vec3 domain=worldP*.19;float broad=fbm(domain+vec3(organ.w,0.,0.));
      vec3 warped=domain+vec3(fbm(domain*.7+organ.w),fbm(domain*.7+4.),fbm(domain*.7-3.))*2.;
      float primary=filament(fbm(warped*.9)*21.,.018)*.32;
      float secondary=filament(fbm(warped*2.8)*33.,.022)*.50;
      float micro=filament(fbm(warped*9.3)*53.,.018)*.58;
      float cells=filament(fbm(warped*1.7)*29.,.022)*.22;
      if(kind>1.5){primary=filament(fbm(domain*.7)*32.,.025)*.7;secondary=filament(fbm(domain*1.7+3.)*25.,.018)*.36;micro=0.;cells=0.;}
      float hairLOD=1.-smoothstep(65.,150.,-viewP.z);
      float mask=max(primary,max(secondary*.56,max(micro*.28*hairLOD,cells)));
      float rim=kind>1.5 ? 0. : pow(1.-abs(dot(normalize(nView),normalize(-viewP))),11.)*.55;
      mask=max(mask,rim);
      if(mask<.045)discard;
      float h=worldHue(worldP)+clock*.008;
      vec3 ink=tissueColour(h);
      float hot=step(.86,noise3(domain*.6+organ.w));
      float pulse=.5+.5*sin(clock*.7-worldP.y*.19+broad*5.);
      float energy=.72+primary*.80+rim*1.05+hot*primary*pulse*2.8;
      float fog=exp(-max(0.,-viewP.z-20.)*.007);
      gl_FragColor=vec4(ink*mask*energy*fog*(1.+sway*.045*sin(clock*.4)),1.);
    }`})
}
export function createRibbonMaterial(uniforms:ForestUniforms) {
  return new ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`attribute vec3 start;attribute vec3 end;attribute vec4 data;attribute vec4 motion;varying vec3 worldP;varying float across;varying float depth;varying float phase;varying float hue;varying float along;varying float coverage;uniform vec2 resolution;uniform float clock;uniform float sway;
    void main(){
      vec3 a=start,b=end;
      a.x+=motion.z*sway*.16*sin(clock*.5+a.y*.2+data.w);a.z+=motion.z*sway*.10*cos(clock*.4+a.y*.2);
      b.x+=motion.w*sway*.16*sin(clock*.5+b.y*.2+data.w);b.z+=motion.w*sway*.10*cos(clock*.4+b.y*.2);
      vec4 va=modelViewMatrix*vec4(a,1.),vb=modelViewMatrix*vec4(b,1.);
      if(va.z>-.06 && vb.z>-.06){gl_Position=vec4(2.,2.,2.,1.);return;}
      if(va.z>-.06)va=mix(va,vb,(-.06-va.z)/(vb.z-va.z));
      if(vb.z>-.06)vb=mix(vb,va,(-.06-vb.z)/(va.z-vb.z));
      vec4 ca=projectionMatrix*va,cb=projectionMatrix*vb;
      vec2 delta=(cb.xy/max(.001,cb.w)-ca.xy/max(.001,ca.w))*resolution;
      vec2 side=length(delta)>.001 ? normalize(vec2(-delta.y,delta.x)) : vec2(1.,0.);
      float t=position.x;vec4 clip=mix(ca,cb,t);vec4 view=mix(va,vb,t);
      float width=mix(data.x,data.y,t);
      float naturalWidth=width*projectionMatrix[1][1]*resolution.y/max(.1,-view.z);
      float pixels=max(1.2,naturalWidth);coverage=min(1.,naturalWidth/1.2);
      clip.xy+=side*position.y*pixels/resolution*clip.w;
      gl_Position=clip;across=position.y;depth=-view.z;phase=data.w;along=mix(motion.x,motion.y,t);
      worldP=mix(a,b,t);hue=data.z;
    }`,
    fragmentShader:`uniform float clock;varying vec3 worldP;varying float across;varying float depth;varying float phase;varying float hue;varying float along;varying float coverage;${colourGLSL}
    void main(){float edge=1.-smoothstep(.58,1.,abs(across));float core=exp(-across*across*6.);
    float hot=step(.85,fract(phase*.173));float impulse=pow(.5+.5*sin(clock*.8-along*12.+phase),8.);
    float brightness=.46+core*1.05+hot*impulse*2.6;
    gl_FragColor=vec4(tissueColour(worldHue(worldP)+clock*.008)*brightness*exp(-max(0.,depth-20.)*.007),edge*coverage);}`})
}

export function createVeinMaterial(uniforms:ForestUniforms) {
  return new ShaderMaterial({uniforms,depthWrite:true,toneMapped:false,
    vertexShader:`attribute vec2 ink;varying vec2 pigment;varying vec3 worldP;varying vec3 normalV;varying vec3 viewP;void main(){pigment=ink;worldP=position;normalV=normalize(normalMatrix*normal);vec4 v=modelViewMatrix*vec4(position,1.);viewP=v.xyz;gl_Position=projectionMatrix*v;}`,
    fragmentShader:`uniform float clock;varying vec2 pigment;varying vec3 worldP;varying vec3 normalV;varying vec3 viewP;${colourGLSL}void main(){float facing=abs(dot(normalize(normalV),normalize(-viewP)));float pulse=pow(.5+.5*sin(clock*.8-worldP.y*.3+pigment.y),8.);float hot=step(.85,fract(pigment.y*.173));float light=.45+.92*facing+hot*pulse*2.1;gl_FragColor=vec4(tissueColour(worldHue(worldP)+clock*.008)*light*exp(-max(0.,-viewP.z-20.)*.007),1.);}`})
}
