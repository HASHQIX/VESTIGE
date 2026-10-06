import {useEffect,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {Vector3} from 'three'
import type {Forest} from '../forest'
import {isNativeWebGPU} from '../webgpu/createRenderer'
import {createSkySilhouette} from './skyParticles'

declare global {interface Window {__vestigeSky?:{snapshot:()=>Record<string,unknown>;look:(elevation:number,azimuth?:number)=>void}}}

// The distant panorama follows translation only, so the forest silhouettes stay on the horizon.
export function ProceduralSkySilhouette({forest,active}:{forest:Forest;active:boolean}){
 const {gl,scene,camera,invalidate}=useThree()
 const state=useRef<ReturnType<typeof createSkySilhouette>|undefined>(undefined)
 const running=useRef(active);running.current=active
 useEffect(()=>{
  if(new URLSearchParams(location.search).get('sky')==='off')return
  const [x,,z]=forest.stops[0].view,[tx,,tz]=forest.stops[0].target
  const sky=createSkySilhouette(Math.atan2(tx-x,-(tz-z)),isNativeWebGPU(gl))
  state.current=sky;scene.add(sky.mesh)
  const reduced=matchMedia('(prefers-reduced-motion: reduce)')
  const update=()=>{sky.enabled=running.current&&!document.hidden&&!reduced.matches}
  reduced.addEventListener('change',update);document.addEventListener('visibilitychange',update);update()
  const debug={snapshot:()=>({ready:true,active:sky.enabled,proximity:sky.proximity,gain:sky.gain.value,particles:sky.count,backend:isNativeWebGPU(gl)?'webgpu':'webgl'}),look:(elevation:number,azimuth=0)=>{
   const angle=sky.orientation+azimuth*Math.PI/180,up=elevation*Math.PI/180
   camera.lookAt(camera.position.clone().add(new Vector3(Math.sin(angle)*Math.cos(up),Math.sin(up),-Math.cos(angle)*Math.cos(up))));invalidate()
  }}
  if(new URLSearchParams(location.search).get('debug')==='1')window.__vestigeSky=debug
  return()=>{state.current=undefined;reduced.removeEventListener('change',update);document.removeEventListener('visibilitychange',update);scene.remove(sky.mesh);sky.dispose();if(window.__vestigeSky===debug)delete window.__vestigeSky}
 },[forest,gl,scene,camera,invalidate])
 useEffect(()=>{const sky=state.current;if(sky)sky.enabled=active&&!document.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches},[active])
 useFrame(({clock},delta)=>{
  const sky=state.current;if(!sky)return
  sky.mesh.position.copy(camera.position)
  // The distant volcanic horizon and stars stay present throughout the walk.
  sky.proximity=1
  const target=sky.enabled?.72:0
  sky.gain.value+=(target-sky.gain.value)*(1-Math.exp(-delta*3.4))
  sky.update(clock.elapsedTime)
  sky.mesh.visible=sky.gain.value>.004
 })
 return null
}
