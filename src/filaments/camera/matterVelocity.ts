import {Color,Camera,GLSL3,Matrix4,Mesh,NoBlending,Scene,ShaderMaterial,WebGLRenderTarget,HalfFloatType,NearestFilter,type WebGLRenderer} from 'three'
export type MatterSource={mesh:Mesh;material:ShaderMaterial;flow?:boolean;restPoint:string;direction:string;previousPoint:string;centerClip:string}
// Reuse the existing coverage/occlusion and deformation shaders. Only a previous
// center is evaluated additionally; the existing filament geometry stays intact.
export function velocityMaterial(source:MatterSource){
  const poseNames={clock:'mcClock',dissolve:'mcDissolve',activity:'mcActivity',modelViewMatrix:'mcView',projectionMatrix:'mcProjection'}
  let vertex=source.material.vertexShader
  for(const [name,pose] of Object.entries(poseNames))vertex=vertex.replace(new RegExp(`\\b${name}\\b`,'g'),pose)
  for(const [name,pose] of Object.entries(poseNames).slice(0,3))vertex=vertex.replace(new RegExp(`uniform float ${pose};`),`uniform float ${name};float ${pose};`)
  vertex=vertex.replace(/void main\s*\(\s*\)/,'void sharpMain()').replace('gl_Position=clip;',`gl_Position=clip;${source.centerClip.replace(/projectionMatrix/g,'mcProjection')}`)
  let previous=source.previousPoint
  for(const [name,pose] of Object.entries(poseNames))previous=previous.replace(new RegExp(`\\b${name}\\b`,'g'),pose)
  vertex=`uniform mat4 mcPreviousView;uniform mat4 mcPreviousProjection;uniform float mcPreviousClock;uniform float mcPreviousDissolve;uniform float mcPreviousActivity;
    mat4 mcView;mat4 mcProjection;varying vec4 mcCurrentClip;varying vec4 mcOldClip;varying float mcDepth;varying vec2 mcFlow;varying float mcCoordinate;
    ${vertex}
    void main(){
      mcCurrentClip=vec4(0.,0.,0.,1.);mcDepth=0.;
      mcClock=clock;mcDissolve=dissolve;mcActivity=activity;mcView=modelViewMatrix;mcProjection=projectionMatrix;sharpMain();
      vec4 axis=mcCurrentClip+projectionMatrix*modelViewMatrix*vec4(normalize(${source.direction}+vec3(.000001)),0.);
      vec2 tangent=axis.xy/max(.001,axis.w)-mcCurrentClip.xy/max(.001,mcCurrentClip.w);
      mcFlow=normalize(tangent+vec2(.000001));mcCoordinate=.5+.5*sin(dot(${source.restPoint},vec3(.31,.22,.17)));
      mcClock=mcPreviousClock;mcDissolve=mcPreviousDissolve;mcActivity=mcPreviousActivity;
      mcOldClip=mcPreviousProjection*mcPreviousView*vec4(${previous},1.);
    }`
  const fragment=source.material.fragmentShader.replace(/void main\s*\(\s*\)/,'void shadeMain()')
  const material=new ShaderMaterial({glslVersion:GLSL3,uniforms:{...source.material.uniforms,mcPreviousView:{value:new Matrix4()},mcPreviousProjection:{value:new Matrix4()},mcPreviousClock:{value:0},mcPreviousDissolve:{value:0},mcPreviousActivity:{value:1}},
    vertexShader:vertex,fragmentShader:`layout(location=0) out vec4 mcVelocityOutput;layout(location=1) out vec4 mcFlowOutput;
      vec4 mcShade;\n#define gl_FragColor mcShade\n
      varying vec4 mcCurrentClip;varying vec4 mcOldClip;varying float mcDepth;varying vec2 mcFlow;varying float mcCoordinate;
      ${fragment}
      void main(){shadeMain();if(gl_FragColor.a<.025||mcDepth<.055)discard;
        vec2 velocity=mcOldClip.w>.055?(mcCurrentClip.xy/mcCurrentClip.w-mcOldClip.xy/mcOldClip.w)*.5:vec2(0.);
        mcVelocityOutput=vec4(velocity,mcDepth,max(0.,mcOldClip.w));mcFlowOutput=vec4(mcFlow,mcDepth,mcCoordinate);
      }`,depthTest:false,depthWrite:false,blending:NoBlending,side:source.material.side,toneMapped:false})
  material.userData.filamentPacking=source.material.userData.filamentPacking
  if(material.userData.filamentPacking==='instanced')material.vertexShader=material.vertexShader.replace(/\bposition\b/g,'fiberPosition')
  return material
}
export class MatterVelocity {
  readonly scene=new Scene()
  readonly target=new WebGLRenderTarget(1,1,{count:2,type:HalfFloatType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false})
  get flowTexture(){return this.target.textures[1]}
  readonly stats={combined:true,drawCalls:0,triangles:0}
  readonly entries: {source:MatterSource;proxy:Mesh;material:ShaderMaterial}[]
  constructor(sources:MatterSource[]){
    this.entries=sources.map(source=>{const material=velocityMaterial(source),proxy=new Mesh(source.mesh.geometry,material);proxy.matrixAutoUpdate=false;proxy.frustumCulled=source.mesh.frustumCulled;this.scene.add(proxy);return {source,proxy,material}})
    this.target.texture.name='matter-camera-velocity';this.flowTexture.name='matter-camera-surface-flow'
  }
  syncSources(sources:MatterSource[]){
    for(const entry of this.entries.filter(e=>!sources.some(s=>s.mesh===e.source.mesh))){this.scene.remove(entry.proxy);entry.material.dispose();this.entries.splice(this.entries.indexOf(entry),1)}
    for(const source of sources)if(!this.entries.some(e=>e.source.mesh===source.mesh)){const material=velocityMaterial(source),proxy=new Mesh(source.mesh.geometry,material);proxy.matrixAutoUpdate=false;proxy.frustumCulled=source.mesh.frustumCulled;this.scene.add(proxy);this.entries.push({source,proxy,material})}
  }
  setSize(width:number,height:number){this.target.setSize(width,height)}
  render(renderer:WebGLRenderer,camera:Camera,previousView:Matrix4,previousProjection:Matrix4,pose:{clock:number;dissolve:number;activity:number},combined=true){
    for(const {source,proxy,material} of this.entries){
      proxy.matrix.copy(source.mesh.matrixWorld)
      // r185+: manual matrix changes must invalidate updateWorldMatrix().
      proxy.matrixWorldNeedsUpdate=true
      material.uniforms.mcPreviousView.value.multiplyMatrices(previousView,source.mesh.matrixWorld)
      material.uniforms.mcPreviousProjection.value.copy(previousProjection)
      material.uniforms.mcPreviousClock.value=pose.clock;material.uniforms.mcPreviousDissolve.value=pose.dissolve;material.uniforms.mcPreviousActivity.value=pose.activity
    }
    const target=renderer.getRenderTarget(),color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear,gl=renderer.getContext() as WebGL2RenderingContext
    const calls=renderer.info.render.calls,triangles=renderer.info.render.triangles,both=[gl.COLOR_ATTACHMENT0,gl.COLOR_ATTACHMENT1]
    try{
      renderer.setClearColor(0,0);renderer.setRenderTarget(this.target);gl.drawBuffers(both);renderer.clear();renderer.autoClear=false
      if(combined){
        // Preserve source order. Dust writes velocity only and cannot erase the
        // underlying filament flow attachment; later tracers still cover dust.
        for(let start=0;start<this.entries.length;){
          const flow=this.entries[start].source.flow!==false;let end=start+1
          while(end<this.entries.length&&(this.entries[end].source.flow!==false)===flow)end++
          this.entries.forEach((e,i)=>{e.proxy.visible=i>=start&&i<end&&e.source.mesh.visible})
          gl.drawBuffers([gl.COLOR_ATTACHMENT0,flow?gl.COLOR_ATTACHMENT1:gl.NONE]);renderer.render(this.scene,camera);start=end
        }
      }else{
        // Debug reference: same outputs from the former two geometry passes.
        for(const flow of [false,true]){
          this.entries.forEach(e=>{e.proxy.visible=e.source.mesh.visible&&(!flow||e.source.flow!==false)})
          gl.drawBuffers(flow?[gl.NONE,gl.COLOR_ATTACHMENT1]:[gl.COLOR_ATTACHMENT0,gl.NONE]);renderer.render(this.scene,camera)
        }
      }
    }finally{gl.drawBuffers(both);renderer.autoClear=autoClear;renderer.setClearColor(color,alpha);renderer.setRenderTarget(target)}
    this.stats.combined=combined;this.stats.drawCalls=renderer.info.render.calls-calls;this.stats.triangles=renderer.info.render.triangles-triangles
  }
  dispose(){this.entries.forEach(e=>e.material.dispose());this.target.dispose()}
}
