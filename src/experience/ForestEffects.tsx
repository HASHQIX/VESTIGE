import {useMemo} from 'react'
import {useThree} from '@react-three/fiber'
import {ForestGlow} from './ForestGlow'
import {ForestWebGPU} from '../webgpu/ForestWebGPU'
import {isNativeWebGPU} from '../webgpu/createRenderer'
import type {Forest} from '../forest'
import {defaultMatterCamera} from '../filaments/camera/matterCameraSettings'
export function ForestEffects(props:{forest:Forest;onReady:()=>void;onError:()=>void;visibilityEnabled:boolean}){
 const gl=useThree(s=>s.gl)
 const settings=useMemo(()=>({...defaultMatterCamera,baseFibers:props.visibilityEnabled ? .16 : defaultMatterCamera.baseFibers}),[props.visibilityEnabled])
 const previewBrightness=props.visibilityEnabled?1.5:1
 return isNativeWebGPU(gl)?<ForestWebGPU {...props} settings={settings} previewBrightness={previewBrightness}/>:<ForestGlow {...props} settings={settings} previewBrightness={previewBrightness}/>
}
