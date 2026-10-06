import {BackSide,Mesh,ShaderMaterial,SphereGeometry} from 'three'
import type {ForestUniforms} from './organicMaterial.ts'
export function forestAtmosphere(uniforms:ForestUniforms,warm=false) {
  const geometry=new SphereGeometry(330,24,16),material=new ShaderMaterial({uniforms,side:BackSide,depthWrite:false,toneMapped:false,
    vertexShader:`varying vec3 direction;void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.9999;}`,
    fragmentShader:`varying vec3 direction;uniform float clock;
    void main(){vec3 d=normalize(direction);float mist=pow(max(0.,1.-abs(d.y+.12)),4.);float curtain=.5+.5*sin(d.x*9.+d.z*6.+sin(d.y*12.)*.8);float deep=exp(-pow((d.y+.18)*2.4,2.));
      vec3 night=${warm?'vec3(.003,.0007,.0003)':'vec3(.0007,.0018,.005)'};vec3 cyan=${warm?'vec3(.026,.003,.0007)':'vec3(.001,.018,.028)'}*mist*(.35+.65*curtain);vec3 violet=${warm?'vec3(.011,.001,.0004)':'vec3(.008,.001,.019)'}*deep*(1.-curtain)*.7;
      gl_FragColor=vec4(night+cyan+violet,1.);}`})
  const mesh=new Mesh(geometry,material);mesh.name='cold-luminous-atmosphere';mesh.renderOrder=-3;mesh.frustumCulled=false
  return {mesh,geometry,material}
}
