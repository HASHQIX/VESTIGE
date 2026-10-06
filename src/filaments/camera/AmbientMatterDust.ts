import {DoubleSide,InstancedBufferAttribute,InstancedBufferGeometry,Float32BufferAttribute,Matrix4,Mesh,ShaderMaterial} from 'three'
import {seeded} from '../../forestLayout.ts'
import type {HeroFilaments} from '../filamentBake'
import type {createFilamentRenderer} from '../FilamentRenderer'
import {matterMotionGLSL} from '../dissolveField.ts'
export const dustMotion=`vec3 dustPosition(vec3 p,vec3 direction,float s){float t=clock*activity;vec3 flow=normalize(direction+vec3(.000001));return matterPosition(p,flow)+matterCurl(p*.31+vec3(s*19.))* (.2+s*1.7)+flow*sin(t*.18+s*37.)*.65+matterCurl(p*.4+vec3(t*.11))*activity*.35;}`
export function createAmbientMatterDust(hero:HeroFilaments,filaments:ReturnType<typeof createFilamentRenderer>){
 const count=24000,random=seeded(18371),anchors=new Float32Array(count*3),directions=new Float32Array(count*3),seeds=new Float32Array(count),b=hero.buffers
 for(let i=0;i<count;i++){const offset=Math.floor(random()*(b.position.length/6))*6;anchors.set(b.position.subarray(offset,offset+3),i*3);directions.set(b.flow.subarray(offset,offset+3),i*3);seeds[i]=random()}
 const geometry=new InstancedBufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute([0,-1,0,0,1,0,1,-1,0,1,1,0],3));geometry.setIndex([0,2,1,2,3,1]);geometry.setAttribute('anchor',new InstancedBufferAttribute(anchors,3));geometry.setAttribute('direction',new InstancedBufferAttribute(directions,3));geometry.setAttribute('seed',new InstancedBufferAttribute(seeds,1));geometry.instanceCount=count
 const uniforms={...filaments.uniforms,previousView:{value:new Matrix4()},previousProjection:{value:new Matrix4()},previousClock:{value:0},particleStreak:{value:1.25}}
 const material=new ShaderMaterial({uniforms,transparent:true,depthTest:false,depthWrite:false,side:DoubleSide,forceSinglePass:true,toneMapped:false,
 vertexShader:`attribute vec3 anchor;attribute vec3 direction;attribute float seed;uniform vec2 resolution;uniform mat4 previousView;uniform mat4 previousProjection;uniform float previousClock;uniform float particleStreak;
 varying float across;varying float along;varying float visibility;varying float viewDepth;varying float warmth;
 ${matterMotionGLSL}${dustMotion}
 void main(){vec3 a=dustPosition(anchor,direction,seed);vec4 va=modelViewMatrix*vec4(a,1.),ca=projectionMatrix*va;
 vec3 old=a; // Analytic particle flow and camera reprojection provide a local streak.
 old-=normalize(direction+vec3(.000001))*cos(clock*activity*.18+seed*37.)*.65*.18*(clock-previousClock)*activity;
 vec4 cb=previousProjection*previousView*vec4(old,1.);vec2 delta=ca.xy/max(.001,ca.w)-cb.xy/max(.001,cb.w);float pixels=length(delta*resolution);
 vec2 axis=pixels>.001?normalize(delta*resolution):vec2(1.,0.);vec2 side=vec2(-axis.y,axis.x);float len=min(48.,pixels*particleStreak);
 vec4 clip=ca;clip.xy+=(side*position.y*(.55+seed*.5)-axis*position.x*len)/resolution*clip.w;
 gl_Position=clip;across=position.y;along=position.x;viewDepth=-va.z;warmth=seed;
 visibility=(.035+pow(seed,16.)*.65)*step(.055,-va.z);
 }`,
 fragmentShader:`uniform float streamFade;uniform sampler2D bodyDepth;uniform vec2 cameraRange;uniform vec2 resolution;varying float across;varying float along;varying float visibility;varying float viewDepth;varying float warmth;
 float linearDepth(float z){return 2.*cameraRange.x*cameraRange.y/(cameraRange.y+cameraRange.x-(z*2.-1.)*(cameraRange.y-cameraRange.x));}
 void main(){float surface=linearDepth(texture2D(bodyDepth,gl_FragCoord.xy/resolution).r);float alpha=exp(-across*across*5.)*sin(along*3.14159)*visibility*exp(-max(0.,viewDepth-surface)*3.)*mix(1.,1.-smoothstep(32.,48.,viewDepth),streamFade);if(alpha<.008)discard;
 gl_FragColor=vec4(mix(vec3(1.,.09,.008),vec3(1.,.52,.11),warmth)*(1.+pow(warmth,12.)*3.),alpha);}`})
 const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=4;mesh.name='ambient-matter-dust';return {mesh,geometry,material,uniforms,count}
}
