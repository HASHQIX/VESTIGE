import {useThree} from '@react-three/fiber'
import {ForestGlow} from './ForestGlow'
import {ForestWebGPU} from '../webgpu/ForestWebGPU'
import {isNativeWebGPU} from '../webgpu/createRenderer'
import type {Forest} from '../forest'
import {defaultMatterCamera} from '../filaments/camera/matterCameraSettings'
export function ForestEffects(props:{forest:Forest;onReady:()=>void;onError:()=>void}){
 const gl=useThree(s=>s.gl)
 return isNativeWebGPU(gl)?<ForestWebGPU {...props} settings={defaultMatterCamera}/>:<ForestGlow {...props} settings={defaultMatterCamera}/>
}
