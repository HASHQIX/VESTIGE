import {DoubleSide,InstancedBufferAttribute,InstancedBufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial} from 'three'
import {seeded} from '../forestLayout.ts'
import type {HeroFilaments} from './filamentBake.ts'
import type {createFilamentRenderer} from './FilamentRenderer.ts'
import {matterMotionGLSL} from './dissolveField.ts'
export function createFilamentSpores(hero:HeroFilaments,filaments:ReturnType<typeof createFilamentRenderer>){
  const geometry=new InstancedBufferGeometry(),positions:number[]=[],directions:number[]=[],seeds:number[]=[],random=seeded(6047),count=1800,buffers=hero.buffers
  for(let i=0;i<count;i++){const vertex=Math.floor(random()*(buffers.position.length/6))*6;positions.push(...buffers.position.slice(vertex,vertex+3));directions.push(...buffers.flow.slice(vertex,vertex+3));seeds.push(random())}
  geometry.setAttribute('position',new Float32BufferAttribute([0,-1,0,0,1,0,1,-1,0,1,1,0],3));geometry.setIndex([0,2,1,2,3,1])
  geometry.setAttribute('anchor',new InstancedBufferAttribute(new Float32Array(positions),3));geometry.setAttribute('direction',new InstancedBufferAttribute(new Float32Array(directions),3));geometry.setAttribute('seed',new InstancedBufferAttribute(new Float32Array(seeds),1));geometry.instanceCount=count
  const material=new ShaderMaterial({uniforms:filaments.uniforms,transparent:true,depthWrite:false,depthTest:false,side:DoubleSide,forceSinglePass:true,toneMapped:false,
    vertexShader:`attribute vec3 anchor;attribute vec3 direction;attribute float seed;uniform vec2 resolution;varying float across;varying float visibility;varying float along;varying float viewDepth;
      ${matterMotionGLSL}
      void main(){
        vec3 flow=normalize(direction+vec3(.000001));float d=unravel(anchor);
        vec3 a=matterPosition(anchor,flow)+matterCurl(anchor*.51+clock*.09)*d*d*.35;
        vec3 velocity=flow*.75+matterCurl(anchor*.27+clock*.16)*.8;
        vec3 b=a+velocity*d*(.10+seed*.55);
        vec4 va=modelViewMatrix*vec4(a,1.),vb=modelViewMatrix*vec4(b,1.),ca=projectionMatrix*va,cb=projectionMatrix*vb;
        vec2 delta=(cb.xy/max(.001,cb.w)-ca.xy/max(.001,ca.w))*resolution;
        vec2 side=length(delta)>.001?normalize(vec2(-delta.y,delta.x)):vec2(1.,0.);
        vec4 clip=mix(ca,cb,position.x);clip.xy+=side*position.y*.9/resolution*clip.w;
        gl_Position=clip;across=position.y;along=position.x;viewDepth=-va.z;
        visibility=smoothstep(.72,.99,d)*(.25+.75*seed)*step(.055,-va.z)*step(.055,-vb.z);
      }`,
    fragmentShader:`varying float across;varying float visibility;varying float along;varying float viewDepth;
      void main(){float alpha=exp(-across*across*5.)*sin(along*3.14159)*visibility;
        if(alpha<.01)discard;gl_FragColor=vec4(vec3(1.,.48,.08)*2.8*exp(-max(0.,viewDepth-25.)*.009),alpha);}`})
  const mesh=new Mesh(geometry,material);mesh.name='detached-filament-fragments';mesh.renderOrder=3;mesh.frustumCulled=false
  return {mesh,geometry,material,count}
}
