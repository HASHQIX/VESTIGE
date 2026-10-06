import {useFrame,useThree} from '@react-three/fiber'
import {useEffect,useMemo,useRef,type MutableRefObject} from 'react'
import {MathUtils,Vector3} from 'three'
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js'
import {animateForest,type Forest} from '../forest'
import {createForestPhysics,forestFloor,moveForestPlayer} from '../forestNavigation'
import type {WorldAudio} from '../audio'

declare const HL:{setReducedMotion:(on:boolean)=>void;reducedMotion:()=>boolean}
const WALK_SPEED=3.5,FOLLOW_SPEED=2.4
export type Mode='intro'|'walk'|'follow'|'paused'|'end'
export type Bridge={lock:()=>void;reset:()=>void;viewStation:(index:number)=>void;viewGround:()=>void;snapshot:()=>Record<string,unknown>}
type Props={forest:Forest;audio:WorldAudio;mode:Mode;enabled:boolean;onInteract:()=>void;onPause:()=>void;bridgeRef:MutableRefObject<Bridge|null>;onLock:()=>void;onUnlock:()=>void;onEnd:()=>void;onReport:(station:number,progress:number)=>void;onError:()=>void;onReady:()=>void}

export function PlayerController(props:Props){
 const {forest,audio,mode,bridgeRef}=props,{camera,gl,invalidate}=useThree()
 const callbacks=useRef(props);callbacks.current=props
 const keys=useRef(new Set<string>()),velocity=useRef(new Vector3()),direction=useRef(new Vector3()),forward=useRef(new Vector3()),target=useRef(new Vector3())
 const controls=useRef<PointerLockControls|null>(null),tour=useRef(0),joining=useRef(false),previousMode=useRef(mode),physics=useRef(createForestPhysics()),jump=useRef(false)
 const route=forest.route,routeLength=useMemo(()=>route.getLength(),[route])
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>HL.setReducedMotion(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update)},[])
 useEffect(()=>{audio.setMushrooms(forest.mushroomSounds);return()=>audio.setMushrooms([])},[audio,forest])
 useEffect(()=>{
  const control=new PointerLockControls(camera,gl.domElement);controls.current=control;control.pointerSpeed=.65
  const clear=()=>{keys.current.clear();jump.current=false;velocity.current.set(0,0,0)}
  const lock=()=>callbacks.current.onLock(),unlock=()=>{clear();callbacks.current.onUnlock()},error=()=>callbacks.current.onError()
  control.addEventListener('lock',lock);control.addEventListener('unlock',unlock)
  const codes=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'])
  const down=(event:KeyboardEvent)=>{
   if(!callbacks.current.enabled||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return
   if(event.code==='Space'&&event.target instanceof HTMLElement&&event.target.closest('button'))return
   if(event.code==='Escape'){if(!event.repeat){clear();if(callbacks.current.mode==='paused')callbacks.current.onInteract();else callbacks.current.onPause()}return}
   if(codes.has(event.code)&&!(event.code==='Space'&&event.repeat)){event.preventDefault();callbacks.current.onInteract();keys.current.add(event.code);if(event.code==='Space')jump.current=true}
  }
  const up=(event:KeyboardEvent)=>keys.current.delete(event.code)
  window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',clear);document.addEventListener('pointerlockerror',error);document.addEventListener('visibilitychange',clear)
  const requestLock=()=>{if(control.isLocked)return;try{void Promise.resolve(gl.domElement.requestPointerLock()).catch(()=>callbacks.current.onError())}catch{callbacks.current.onError()}}
  bridgeRef.current={lock:requestLock,reset:()=>{clear();physics.current=createForestPhysics();tour.current=0;camera.position.set(...forest.stops[0].view);camera.lookAt(...forest.stops[0].target);invalidate()},viewStation:index=>{const stop=forest.stops[index];if(!stop)return;clear();physics.current=createForestPhysics();camera.position.set(...stop.view);camera.lookAt(...stop.target);invalidate()},viewGround:()=>{clear();physics.current=createForestPhysics();camera.position.set(35,forestFloor(35,10)+1.7,10);camera.lookAt(35,forestFloor(35,-5)+1.7,-5);invalidate()},snapshot:()=>({camera:camera.position.toArray(),locked:control.isLocked,forest:{clock:forest.clock,grounded:physics.current.grounded,verticalVelocity:physics.current.verticalVelocity,streaming:forest.streaming?.stats,matterCamera:forest.matterCamera,worldTracers:forest.tracers?.stats},audio:audio.info()})}
  camera.lookAt(...forest.stops[0].target);invalidate();callbacks.current.onReady()
  return()=>{clear();control.removeEventListener('lock',lock);control.removeEventListener('unlock',unlock);control.dispose();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',clear);document.removeEventListener('pointerlockerror',error);document.removeEventListener('visibilitychange',clear);controls.current=null;bridgeRef.current=null}
 },[camera,gl,invalidate,forest,audio,bridgeRef])
 useFrame((_state,delta)=>{
  const dt=Math.min(delta,.05)
  if(previousMode.current!==mode){if(mode!=='walk'){keys.current.clear();jump.current=false}velocity.current.set(0,0,0)
   if(mode==='follow'){let closest=Infinity;for(let i=0;i<=256;i++){const t=i/256,distance=route.getPointAt(t).distanceToSquared(camera.position);if(distance<closest){closest=distance;tour.current=t}}joining.current=route.getPointAt(tour.current).distanceTo(camera.position)>.12;camera.getWorldDirection(target.current);target.current.multiplyScalar(10).add(camera.position)}previousMode.current=mode
  }
  if(mode==='walk'&&props.enabled){const held=(a:string,b:string)=>keys.current.has(a)||keys.current.has(b),front=Number(held('KeyW','ArrowUp'))-Number(held('KeyS','ArrowDown')),side=Number(held('KeyD','ArrowRight'))-Number(held('KeyA','ArrowLeft'))
   direction.current.set(side,0,-front).applyQuaternion(camera.quaternion);direction.current.y=0;direction.current.normalize().multiplyScalar(WALK_SPEED);velocity.current.lerp(direction.current,1-Math.pow(.001,dt))
   const requested=jump.current;jump.current=false;moveForestPlayer(forest,camera.position,velocity.current.x*dt,velocity.current.z*dt,dt,physics.current,requested)
   camera.position.x=MathUtils.clamp(camera.position.x,forest.bounds.minX,forest.bounds.maxX);camera.position.z=MathUtils.clamp(camera.position.z,forest.bounds.minZ,forest.bounds.maxZ)
  }else if(mode==='follow'){
   if(joining.current){const join=route.getPointAt(tour.current),distance=camera.position.distanceTo(join);camera.position.lerp(join,Math.min(1,dt*FOLLOW_SPEED/Math.max(.001,distance)));physics.current=createForestPhysics();if(camera.position.distanceTo(join)<.14)joining.current=false}
   else {tour.current=Math.min(1,tour.current+dt*FOLLOW_SPEED/routeLength);camera.position.copy(route.getPointAt(tour.current))}
   const aim=route.getPointAt(Math.min(1,tour.current+10/routeLength)).add(new Vector3(0,2,0));target.current.lerp(aim,1-Math.exp(-dt*1.5));camera.lookAt(target.current);if(tour.current>=1)callbacks.current.onEnd()
  }
  const lead=forest.streaming?.stats.lookAhead??32;forest.streaming?.forecast(mode==='follow'||mode==='intro'?[8,16,lead,lead+16].map(distance=>route.getPointAt(Math.min(1,tour.current+distance/routeLength))):undefined)
  if(mode!=='walk'&&mode!=='follow')return
  camera.getWorldDirection(forward.current);animateForest(forest,dt,HL.reducedMotion(),camera.position);if(!HL.reducedMotion())forest.interaction?.update(camera.position,mode==='walk'&&physics.current.grounded,forest.clock)
  audio.update(camera.position,forward.current)
 },0)
 return null
}
