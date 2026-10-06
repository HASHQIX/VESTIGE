import {Scene,Mesh,RenderTarget,HalfFloatType,NearestFilter,Color,BlendMode,CustomBlending,ZeroFactor,OneFactor,type Camera,type Matrix4,type WebGPURenderer} from 'three/webgpu'
import {mrt} from 'three/tsl'
import {compactVelocityIndex,forestVelocityMode,type VelocityMode} from './VelocityIndex.ts'
import {velocityMaterial,type MatterSource} from '../filaments/camera/matterVelocity'
import {nodeMaterial,type GraphMaterial} from './NodeMaterials'
export class GpuVelocity {
 readonly scene=new Scene()
 readonly target=new RenderTarget(1,1,{count:2,type:HalfFloatType,minFilter:NearestFilter,magFilter:NearestFilter,depthBuffer:false})
 readonly entries:{source:MatterSource;proxy:Mesh;shader:ReturnType<typeof velocityMaterial>;graph:GraphMaterial;compact?:ReturnType<typeof compactVelocityIndex>;releaseIndex:()=>void}[]=[]
 readonly stats={combined:true,drawCalls:0,triangles:0,mode:forestVelocityMode(),indexBytes:0,sourceTriangles:0,proxyTriangles:0}
 readonly preserveFlow=mrt({})

 constructor(readonly overrides:Record<string,any>,readonly renderer?:WebGPURenderer,readonly mode:VelocityMode=forestVelocityMode()){this.stats.mode=mode;this.target.texture.name='velocity';this.target.textures[1].name='flow';const blend=new BlendMode(CustomBlending);blend.blendSrc=ZeroFactor;blend.blendDst=OneFactor;blend.blendSrcAlpha=ZeroFactor;blend.blendDstAlpha=OneFactor;this.preserveFlow.setBlendMode('flow',blend)}
 get flowTexture(){return this.target.textures[1]}
 syncSources(sources:MatterSource[]){
  for(const e of [...this.entries])if(!sources.some(s=>s.mesh===e.source.mesh)){this.scene.remove(e.proxy);e.graph.material.dispose();e.shader.dispose();e.releaseIndex();this.entries.splice(this.entries.indexOf(e),1)}
  for(const source of sources)if(!this.entries.some(e=>e.source.mesh===source.mesh)){
   const name=source.mesh.name,kind=name.includes('tracer')?'velocityTracer':name.includes('dust')?'velocityDust':name.includes('fragment')?'velocitySpore':'velocityFilament'
   const shader=velocityMaterial(source),graph=nodeMaterial(shader,kind,kind==='velocityTracer'?this.overrides:{},false,this.renderer),proxy=new Mesh(source.mesh.geometry,graph.material)
   proxy.matrixAutoUpdate=false;proxy.frustumCulled=source.mesh.frustumCulled;proxy.renderOrder=source.mesh.renderOrder;const compact=this.renderer&&this.mode==='compact'&&kind==='velocityFilament'?compactVelocityIndex(source.mesh.geometry):undefined
   let released=false
   const releaseIndex=()=>{
    if(released)return;released=true
    // Pinned r186 boundary: BufferAttribute has no public dispose. Only the
    // owned alternate index is released; borrowed source attributes stay alive.
    if(compact&&this.renderer)(this.renderer as any)._attributes.delete(compact)
    source.mesh.geometry.removeEventListener('dispose',releaseIndex)
   }
   if(compact)source.mesh.geometry.addEventListener('dispose',releaseIndex)
   this.scene.add(proxy);this.entries.push({source,proxy,shader,graph,compact,releaseIndex})
  }
 }
 setSize(w:number,h:number){this.target.setSize(w,h)}
 render(renderer:WebGPURenderer,camera:Camera,previousView:Matrix4,previousProjection:Matrix4,pose:{clock:number;dissolve:number;activity:number}){
  for(const {source,proxy,shader,graph} of this.entries){
   proxy.visible=source.mesh.visible;proxy.matrix.copy(source.mesh.matrixWorld);proxy.matrixWorldNeedsUpdate=true
   shader.uniforms.mcPreviousView.value.multiplyMatrices(previousView,source.mesh.matrixWorld);shader.uniforms.mcPreviousProjection.value.copy(previousProjection)
   shader.uniforms.mcPreviousClock.value=pose.clock;shader.uniforms.mcPreviousDissolve.value=pose.dissolve;shader.uniforms.mcPreviousActivity.value=pose.activity;graph.sync()
  }
  const indices=new Map<Mesh['geometry'],Mesh['geometry']['index']>(),active=new Set<typeof this.entries[number]>()
  this.stats.indexBytes=0;this.stats.sourceTriangles=0;this.stats.proxyTriangles=0
  for(const e of this.entries){
   const geometry=e.proxy.geometry
   const instances='instanceCount' in geometry?Number(geometry.instanceCount):1
   // Rest-space error bounds are unsuitable for strongly unravelled strands.
   // Keep their original topology until they return to the attached state.
   if(e.compact&&Number(e.shader.uniforms.dissolve?.value??0)<=.05)active.add(e)
   this.stats.sourceTriangles+=(geometry.index?.count??geometry.getAttribute('position').count)/3*instances
   this.stats.proxyTriangles+=(active.has(e)?e.compact!.count:geometry.index?.count??geometry.getAttribute('position').count)/3*instances
   if(e.compact)this.stats.indexBytes+=e.compact.array.byteLength
   if(active.has(e)&&!indices.has(geometry))indices.set(geometry,geometry.index)
  }
  const target=renderer.getRenderTarget(),color=renderer.getClearColor(new Color()),alpha=renderer.getClearAlpha(),autoClear=renderer.autoClear,previousMRT=renderer.getMRT(),calls=renderer.info.render.drawCalls,triangles=renderer.info.render.triangles
  try{
   for(const e of active)e.proxy.geometry.setIndex(e.compact!)
   renderer.setClearColor(0,0);renderer.setRenderTarget(this.target);renderer.setMRT(null);renderer.clear();renderer.autoClear=false
   // Independent attachment blending preserves filament flow under dust, while
   // dust still writes its actual velocity/depth. No duplicate geometry pass.
   for(let start=0;start<this.entries.length;){const flow=this.entries[start].source.flow!==false;let end=start+1;while(end<this.entries.length&&(this.entries[end].source.flow!==false)===flow)end++
    this.entries.forEach((e,i)=>{e.proxy.visible=i>=start&&i<end&&e.source.mesh.visible});renderer.setMRT(flow?null:this.preserveFlow);renderer.render(this.scene,camera);start=end
   }
  }finally{for(const [geometry,index] of indices)geometry.setIndex(index);renderer.setMRT(previousMRT);renderer.autoClear=autoClear;renderer.setRenderTarget(target);renderer.setClearColor(color,alpha)}
  this.stats.drawCalls=renderer.info.render.drawCalls-calls;this.stats.triangles=renderer.info.render.triangles-triangles
 }
 dispose(){this.entries.forEach(e=>{e.graph.material.dispose();e.shader.dispose();e.releaseIndex()});this.target.dispose()}
}
