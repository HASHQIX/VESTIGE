import {useFrame} from '@react-three/fiber'
import {animateForest,type Forest} from '../forest'
// Walking/following already advance the same world clock in PlayerController.
// The entrance view also shows living matter; pausing freezes its histories.
export function ForestMatterLife({forest,intro}:{forest:Forest;intro:boolean}){
 useFrame(({camera},delta)=>{if(intro)animateForest(forest,Math.min(delta,.05),matchMedia('(prefers-reduced-motion: reduce)').matches,camera.position)})
 return null
}
