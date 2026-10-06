import * as THREE from 'three'
import {PLAYER_RADIUS} from './experience/collision.ts'

export const forestFloor=(x:number,z:number) => 2.5+Math.sin(z*.044)*1.25+Math.sin(x*.06)*.65
export type ForestDeck={id:string;points:THREE.Vector3[];width:number}
export type ForestTerrain={supportHeight?:(x:number,z:number,minY:number,maxY:number)=>number|undefined;volumeField?:(x:number,y:number,z:number)=>number;surfaceHeight?:(x:number,z:number,near:number)=>number|undefined;decks:ForestDeck[];colliders:THREE.Box3[];bounds:{minX:number;maxX:number;minZ:number;maxZ:number}}

// The same sampled centre lines build the visible root decks and their walking surfaces.
function deckProjection(deck:ForestDeck,x:number,z:number) {
  let nearest=Infinity,height:number | undefined
  const radius=deck.width/2-PLAYER_RADIUS
  for(let i=1;i<deck.points.length;i++) {
    const a=deck.points[i-1],b=deck.points[i],dx=b.x-a.x,dz=b.z-a.z
    const t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz || 1),0,1)
    const distance=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2
    if(distance<=radius*radius && distance<nearest) {nearest=distance;height=THREE.MathUtils.lerp(a.y,b.y,t)}
  }
  return height===undefined ? undefined : {height,distance:nearest}
}

export const deckHeight=(deck:ForestDeck,x:number,z:number) => deckProjection(deck,x,z)?.height

export function forestSupport(terrain:ForestTerrain,x:number,z:number,feet:number,maxStep=.18):number | undefined {
  if(terrain.supportHeight)return terrain.supportHeight(x,z,feet-.65,feet+maxStep)
  let height:number | undefined,best=Infinity
  if(terrain.surfaceHeight){
    const surface=terrain.surfaceHeight(x,z,feet+maxStep)
    if(surface!==undefined&&Math.abs(surface-feet)<=maxStep)return surface
    const lower=terrain.surfaceHeight(x,z,feet)
    if(lower!==undefined&&Math.abs(lower-feet)<=maxStep)return lower
  } else {
    for(const candidate of terrain.decks.map(deck=>deckProjection(deck,x,z))) {
      if(candidate===undefined)continue
      const difference=Math.abs(candidate.height-feet),score=candidate.distance+difference*.0001
      if(difference<=maxStep&&score<best){height=candidate.height;best=score}
    }
    if(height!==undefined)return height
  }
  const floor=forestFloor(x,z)
  return Math.abs(floor-feet)<=maxStep ? floor : undefined
}

export function moveOnForest(terrain:ForestTerrain,position:THREE.Vector3,dx:number,dz:number) {
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06))
  const attempt=(x:number,z:number) => {
    if(x<terrain.bounds.minX || x>terrain.bounds.maxX || z<terrain.bounds.minZ || z>terrain.bounds.maxZ) return false
    const feet=forestSupport(terrain,x,z,position.y-1.7)
    if(feet===undefined) return false // Keep the walker on a high deck at its edge.
    if(terrain.colliders.some(box => feet+1.7>box.min.y && feet<box.max.y &&
      Math.hypot(x-THREE.MathUtils.clamp(x,box.min.x,box.max.x),z-THREE.MathUtils.clamp(z,box.min.z,box.max.z))<PLAYER_RADIUS)) return false
    position.set(x,feet+1.7,z);return true
  }
  for(let i=0;i<steps;i++) {
    const x=position.x+dx/steps,z=position.z+dz/steps
    if(!attempt(x,z)) {attempt(x,position.z);attempt(position.x,z)}
  }
}

export class ForestRoute extends THREE.Curve<THREE.Vector3> {
  readonly points:THREE.Vector3[]
  constructor(decks:ForestDeck[]) {
    super();this.points=decks.flatMap((deck,i) => i ? deck.points.slice(1) : deck.points)
    this.arcLengthDivisions=this.points.length*2
  }
  getPoint(t:number,target=new THREE.Vector3()) {
    const scaled=THREE.MathUtils.clamp(t,0,1)*(this.points.length-1),i=Math.min(this.points.length-2,Math.floor(scaled))
    return target.copy(this.points[i]).lerp(this.points[i+1],scaled-i).add(new THREE.Vector3(0,1.7,0))
  }
}

export type ForestPhysics={verticalVelocity:number;grounded:boolean}
export const createForestPhysics=():ForestPhysics=>({verticalVelocity:0,grounded:false})
const JUMP_VELOCITY=5.5
const RISE_GRAVITY=18
const FALL_GRAVITY=9
const MAX_FALL_SPEED=24
// Gravity is stepped independently of the keys. Vertical sweeps catch lower limbs and the ground.
export function moveForestPlayer(terrain:ForestTerrain,position:THREE.Vector3,dx:number,dz:number,dt:number,state:ForestPhysics,jump=false) {
  const duration=Math.max(0,Math.min(.05,dt)),steps=Math.max(1,Math.ceil(Math.max(Math.hypot(dx,dz)/.05,duration/.012))),slice=duration/steps
  const field=terrain.volumeField
  const blocked=(x:number,z:number,feet:number,supported:boolean)=>{
    if(!field&&terrain.colliders.some(box=>feet+1.7>box.min.y&&feet+.25<box.max.y&&Math.hypot(x-THREE.MathUtils.clamp(x,box.min.x,box.max.x),z-THREE.MathUtils.clamp(z,box.min.z,box.max.z))<PLAYER_RADIUS))return true
    if(field)for(const y of supported?[1.7]:[.9,1.4,1.7])for(const [ox,oz] of [[0,0],[PLAYER_RADIUS,0],[-PLAYER_RADIUS,0],[0,PLAYER_RADIUS],[0,-PLAYER_RADIUS]])if(field(x+ox,feet+y,z+oz)<-.025)return true
    return false
  }
  if(jump&&state.grounded){state.verticalVelocity=JUMP_VELOCITY;state.grounded=false}
  for(let i=0;i<steps;i++) {
    const feet=position.y-1.7
    const attempt=(x:number,z:number)=>{
      if(x<terrain.bounds.minX||x>terrain.bounds.maxX||z<terrain.bounds.minZ||z>terrain.bounds.maxZ)return false
      // Only a grounded walker may step onto nearby support. While airborne,
      // landing is resolved by the vertical sweep below so the descent is not
      // shortened by snapping from a distance.
      const support=state.grounded?forestSupport(terrain,x,z,feet,.6):undefined,proposed=support??feet
      // A steep rise is an obstacle, not an unsupported step into the root interior.
      if(state.grounded&&support===undefined&&(terrain.supportHeight?.(x,z,feet+.03,feet+1.7)!==undefined||(field&&field(x,feet+.03,z)<-.025)))return false
      if(blocked(x,z,proposed,support!==undefined))return false
      position.x=x;position.z=z
      if(support!==undefined&&state.verticalVelocity<=0){position.y=support+1.7;state.grounded=true;state.verticalVelocity=0}else state.grounded=false
      return true
    }
    const x=position.x+dx/steps,z=position.z+dz/steps
    if(!attempt(x,z)){attempt(x,position.z);attempt(position.x,z)}
    if(state.grounded)continue
    // Keep the lift responsive while easing the return to the ground. A separate
    // descent gravity prevents the landing from feeling like a snap downward.
    const gravity=state.verticalVelocity>0?RISE_GRAVITY:FALL_GRAVITY
    state.verticalVelocity=Math.max(-MAX_FALL_SPEED,state.verticalVelocity-gravity*slice)
    const oldFeet=position.y-1.7,nextFeet=oldFeet+state.verticalVelocity*slice
    if(state.verticalVelocity>0&&field&&field(position.x,nextFeet+1.9,position.z)<0){state.verticalVelocity=0;continue}
    if(state.verticalVelocity<=0){
      const surfaces=terrain.supportHeight?[terrain.supportHeight(position.x,position.z,nextFeet-.0001,oldFeet+.03)]:terrain.surfaceHeight ? [terrain.surfaceHeight(position.x,position.z,oldFeet)] : terrain.decks.map(d=>deckHeight(d,position.x,position.z))
      if(!terrain.surfaceHeight&&!terrain.supportHeight)surfaces.push(forestFloor(position.x,position.z))
      const landing=surfaces.filter((h):h is number=>h!==undefined&&h<=oldFeet+.03&&h>=nextFeet).sort((a,b)=>b-a)[0]
      if(landing!==undefined){position.y=landing+1.7;state.verticalVelocity=0;state.grounded=true;continue}
    }
    position.y=nextFeet+1.7
  }
}
