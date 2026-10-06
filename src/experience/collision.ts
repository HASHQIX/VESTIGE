// Reused from ../memory/src/experience/collision.ts; no visible collision meshes.
import * as THREE from 'three'
export const PLAYER_RADIUS = .22
function blocked(x: number, z: number, colliders: THREE.Box3[]) {
  return colliders.some(box => {
    if (box.max.y < .1 || box.min.y > 1.85) return false
    const dx = x - THREE.MathUtils.clamp(x,box.min.x,box.max.x), dz = z - THREE.MathUtils.clamp(z,box.min.z,box.max.z)
    return dx*dx + dz*dz < PLAYER_RADIUS*PLAYER_RADIUS
  })
}
export function moveWithCollisions(position: THREE.Vector3, dx: number, dz: number, colliders: THREE.Box3[]) {
  const steps = Math.max(1,Math.ceil(Math.hypot(dx,dz)/.06))
  for (let i=0;i<steps;i++) {
    if (!blocked(position.x+dx/steps,position.z,colliders)) position.x+=dx/steps
    if (!blocked(position.x,position.z+dz/steps,colliders)) position.z+=dz/steps
  }
}
