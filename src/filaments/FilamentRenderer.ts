import {acquireGlowProfile,forestGlowMode} from './GlowProfile.ts'
import {footPulses,footWaveGLSL} from './FootstepWaves.ts'
import {matterMotionGLSL} from './dissolveField.ts'
import {DoubleSide,Mesh,ShaderMaterial,Vector2,Vector3,type Texture} from 'three'
import type {ForestUniforms} from '../organicMaterial.ts'
import {filamentGeometry,type FilamentPacking} from './filamentBuffers.ts'
import type {HeroFilaments} from './filamentBake.ts'
import {instancedFilaments,instancedFilamentGLSL} from './InstancedFilaments.ts'
function defaultPacking():FilamentPacking {
  const requested=typeof location==='undefined'?null:new URLSearchParams(location.search).get('packing')
  return requested==='legacy'||requested==='rank'||requested==='instanced'?requested:'tangent'
}
export function createFilamentRenderer(hero:HeroFilaments,shared:ForestUniforms,packing:FilamentPacking=defaultPacking(),stripPoints=16){
  const instanced=packing==='instanced'?instancedFilaments(hero.buffers,stripPoints):undefined
  const glowMode=forestGlowMode(),profile=acquireGlowProfile()
  const uniforms={...shared,glowProfile:{value:profile.texture},glowProfileSize:{value:profile.size},useGlowProfile:{value:glowMode==='analytic'?0:1},bakedBloom:{value:glowMode==='local'?1:0},glowWidth:{value:glowMode==='local'?4:1},overview:{value:0},fiberFlowSpeed:{value:1},fiberMemory:{value:1.5},fiberWave:{value:.75},streamFocusDepth:{value:20},streamFocusRange:{value:0},streamWeight:{value:1},ground:{value:0},walkFocus:{value:new Vector3()},footPulses:{value:footPulses()},streamFade:{value:0},baseVisibility:{value:1},activity:{value:1},dissolve:{value:0},dissolveCenter:{value:new Vector3(...hero.region.center)},bodyDepth:{value:null as Texture|null},cameraRange:{value:new Vector2(.05,350)},regionMin:{value:new Vector3(...hero.region.min)},regionMax:{value:new Vector3(...hero.region.max)}}
  const geometry=instanced?.geometry??filamentGeometry(hero.buffers,packing as Exclude<FilamentPacking,'instanced'>)
  if(instanced)Object.assign(uniforms,{pointTexture:{value:instanced.texture},pointSize:{value:instanced.size}})
  const material=new ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,side:DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`attribute vec3 previous;attribute vec3 next;attribute vec3 flow;attribute vec4 data;attribute float level;
      uniform float glowWidth;uniform float overview;uniform float streamFocusDepth;uniform float streamFocusRange;uniform vec2 resolution;varying float across;varying float arc;varying float seed;varying float depth;varying float coverage;varying vec3 rest;varying float rank;varying float detached;varying float footLight;
      ${matterMotionGLSL}${footWaveGLSL}
      vec2 projected(vec4 p){return p.xy/max(.0001,p.w);}
      void main(){
        rest=position;footLight=footWave(position)*activity;detached=unravel(position);across=data.x*glowWidth;arc=data.z;seed=data.w;rank=level;coverage=0.;
        vec3 direction=normalize(flow+vec3(.000001));
        vec4 v=modelViewMatrix*vec4(matterPosition(position,direction),1.);depth=-v.z;
        if(v.z>-.055){gl_Position=projectionMatrix*v;return;}
        vec4 clip=projectionMatrix*v,pv=modelViewMatrix*vec4(matterPosition(previous,direction),1.),nv=modelViewMatrix*vec4(matterPosition(next,direction),1.);
        pv.z=min(pv.z,-.055);nv.z=min(nv.z,-.055);
        vec2 p=projected(clip)*resolution,a=projected(projectionMatrix*pv)*resolution,b=projected(projectionMatrix*nv)*resolution;
        vec2 before=p-a,after=b-p;
        if(length(before)<.001)before=after;if(length(after)<.001)after=before;
        vec2 tangent=normalize(normalize(before+vec2(.000001))+normalize(after+vec2(.000001)));
        vec2 side=vec2(-tangent.y,tangent.x),segment=normalize(after+vec2(.000001));
        float join=min(2.,1./max(.5,abs(dot(side,vec2(-segment.y,segment.x)))));
        float detailDepth=streamFocusRange>0.?min(depth,abs(depth-streamFocusDepth)):depth;float lod=1.-smoothstep(level>1.5?35.:85.,level>1.5?85.:180.,detailDepth);
        lod=mix(lod,1.,overview);float core=data.y*lod,pixels=max(.8,core)*2.6*glowWidth;
        clip.xy+=side*data.x*pixels*join/resolution*clip.w;
        gl_Position=clip;across=data.x*glowWidth;arc=data.z;seed=data.w;rank=level;coverage=min(1.,core/.8);
      }`,
    fragmentShader:`uniform sampler2D glowProfile;uniform float glowProfileSize;uniform float useGlowProfile;uniform float bakedBloom;uniform float overview;uniform float activity;uniform float fiberFlowSpeed;uniform float fiberMemory;uniform float fiberWave;uniform float streamFocusDepth;uniform float streamFocusRange;uniform float streamWeight;uniform float ground;uniform vec3 walkFocus;uniform float streamFade;uniform float baseVisibility;uniform float clock;uniform sampler2D bodyDepth;uniform vec2 cameraRange;uniform vec2 resolution;uniform vec3 regionMin;uniform vec3 regionMax;
      varying float across;varying float arc;varying float seed;varying float depth;varying float coverage;varying vec3 rest;varying float rank;varying float detached;varying float footLight;
      float linearDepth(float d){float n=cameraRange.x,f=cameraRange.y;return 2.*n*f/(f+n-(d*2.-1.)*(f-n));}
      void main(){
        float surface=linearDepth(texture2D(bodyDepth,gl_FragCoord.xy/resolution).x);
        float behind=max(0.,depth-surface-.07),penetration=mix(exp(-behind*2.8)*(1.-smoothstep(.8,1.5,behind)),1.,smoothstep(.15,.8,detached));
        if(penetration<.005)discard;
        vec3 edge=min(rest-regionMin,regionMax-rest);float boundary=smoothstep(0.,1.6,min(edge.x,min(edge.y,edge.z)));
        float core=exp(-across*across*36.),halo=exp(-across*across*5.)*.075;
        float opticalMask=core+halo;
        if(useGlowProfile>.5){
          vec4 optical=texture2D(glowProfile,vec2((clamp(abs(across)*.25,0.,1.)*(glowProfileSize-1.)+.5)/glowProfileSize,.5));
          opticalMask=optical.r+optical.b*bakedBloom;
        }
        float variation=.72+.28*sin(arc*.34+seed*27.);
        float phase=fract((arc-clock*.55)/28.+seed*7.);
        float pulse=exp(-pow((phase-.5)*45.,2.))*step(.92,seed);
        float h=.5+.5*sin(rest.z*.022+rest.x*.035+rest.y*.09);
        vec3 amber=mix(vec3(1.,.045,.005),vec3(1.,.28,.055),h);
        vec3 flowing=vec3(0.);
        if(overview>.5&&activity>0.){
        // Analytic light packets travel along each baked world-space path. No new
        // particles, geometry, history textures or screen-space displacement.
        float speed=mix(3.,10.,seed)*max(0.,fiberFlowSpeed);
        float lifetime=clamp(fiberMemory,.2,3.);
        float spacing=mix(12.,32.,fract(seed*17.3));
        float ageDistance=mod(clock*speed+seed*spacing-arc,spacing);
        float headWidth=mix(.18,.48,fract(seed*31.7));
        float headDistance=min(ageDistance,spacing-ageDistance);
        float head=exp(-headDistance*headDistance/(headWidth*headWidth));
        if(useGlowProfile>.5)head=texture2D(glowProfile,vec2((clamp(headDistance/headWidth*.25,0.,1.)*(glowProfileSize-1.)+.5)/glowProfileSize,.5)).g;
        float tail=exp(-ageDistance/max(.3,mix(3.,10.,seed)*lifetime*.65));
        tail*=1.-smoothstep(spacing*.65,spacing,ageDistance);
        float breakup=.55+.45*smoothstep(-.4,.6,sin(arc*2.3+seed*63.));
        float wave=.5+.5*sin(rest.x*.065+rest.z*.047+rest.y*.14-clock*1.4);
        float flowLight=overview*activity*(1.-ground*.45)*(1.+fiberWave*wave*.7);
        flowing=flowLight*(amber*tail*breakup*3.2+vec3(1.,.72,.36)*head*8.);
        }
        float bright=(rank<.5?1.45:rank<1.5?.95:.74)+pulse*3.+detached*.5+footLight*2.2;
        bright*=1.+ground*2.5*(1.-smoothstep(2.,11.,length(rest.xz-walkFocus.xz)));
        float fog=exp(-max(0.,depth-25.)*mix(.009,.002,overview));float fadeDepth=streamFocusRange>0.?min(depth,max(0.,abs(depth-streamFocusDepth)-streamFocusRange)):depth;float localFade=mix(1.,1.-smoothstep(32.,48.,fadeDepth),streamFade);
        float gap=sin(arc*1.9+seed*57.-clock*.3)*.5+.5;
        float fragments=mix(1.,smoothstep(.23,.40,gap),smoothstep(.65,.98,detached));
        gl_FragColor=vec4((amber*bright*variation+flowing)*fog,opticalMask*coverage*penetration*boundary*fragments*(rank>1.5?.58:.82)*baseVisibility*localFade*streamWeight);
      }`})
  // Canonical TSL factories use scalar rank and a flow binding. Native bindings
  // below reproduce either legacy input or derived tangent with the same graph.
  if(packing==='legacy')material.vertexShader=material.vertexShader.replace('attribute float level;','attribute vec4 meta;').replace(/\blevel\b/g,'meta.x')
  if(packing==='tangent')material.vertexShader=material.vertexShader.replace('attribute vec3 flow;','vec3 flow;').replace('void main(){','void main(){flow=next-previous;')
  if(instanced){
    material.vertexShader=material.vertexShader.replace('attribute vec3 previous;attribute vec3 next;attribute vec3 flow;attribute vec4 data;attribute float level;','').replace(/\bposition\b/g,'fiberPosition')
    material.vertexShader=instancedFilamentGLSL+material.vertexShader.replace('void main(){','void main(){reconstructFiber();')
    material.addEventListener('dispose',()=>instanced.texture.dispose())
  }
  material.userData.filamentPacking=packing
  material.userData.glowMode=glowMode
  material.addEventListener('dispose',profile.release)
  const mesh=new Mesh(geometry,material);mesh.name='layered-filament-matter';mesh.renderOrder=2
  return {mesh,geometry,material,uniforms,paths:hero.buffers.paths,counts:hero.buffers.counts,depths:hero.buffers.depths}
}
