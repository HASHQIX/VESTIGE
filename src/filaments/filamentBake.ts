import type {ForestLayout} from '../forestLayout.ts'
import type {WorldSkeleton} from '../worldSkeleton.ts'
import type {WorldVolume} from '../worldSDF.ts'
import type {WorldSurface} from '../worldSurface.ts'
import {bakeFilamentField,heroRegion} from './filamentField.ts'
import {filamentSeeds} from './filamentSeeds.ts'
import {traceFilament} from './filamentTracer.ts'
import {packFilaments} from './filamentBuffers.ts'
export function bakeHeroFilaments(layout:ForestLayout,skeleton:WorldSkeleton,volume:WorldVolume,surface:WorldSurface){
  const region=heroRegion(layout);if(!region)return undefined
  const field=bakeFilamentField(volume,layout,skeleton,region),seeds=filamentSeeds(surface,field),paths=seeds.flatMap(seed=>{const path=traceFilament(field,seed);return path?[path]:[]})
  return {region,buffers:packFilaments(paths)}
}
export type HeroFilaments=NonNullable<ReturnType<typeof bakeHeroFilaments>>

// Same field and integrator as the approved study, sampled lazily across the
// whole world instead of baking millions of empty-space voxels.
export function bakeWorldFilaments(layout:ForestLayout,skeleton:WorldSkeleton,volume:WorldVolume,surface:WorldSurface){
  const region={...volume.bounds,center:volume.bounds.min.map((v,k)=>(v+volume.bounds.max[k])*.5) as import('../forestLayout.ts').P}
  const field=bakeFilamentField(volume,layout,skeleton,region,.65,true),seeds=filamentSeeds(surface,field,[480,8400,36000],6006,1.5),paths=seeds.flatMap(seed=>{const path=traceFilament(field,seed);return path?[path]:[]})
  return {region,buffers:packFilaments(paths)}
}

// Streaming keeps the exact study seed budget, field spacing and RK2 integrator.
export function bakeFilamentRegion(layout:ForestLayout,skeleton:WorldSkeleton,volume:WorldVolume,surface:WorldSurface,region:import('./filamentField.ts').FilamentRegion){
 const field=bakeFilamentField(volume,layout,skeleton,region,.65,true),seeds=filamentSeeds(surface,field),paths=seeds.flatMap(seed=>{const path=traceFilament(field,seed);return path?[path]:[]})
 return {region,buffers:packFilaments(paths)}
}
