import {generateForestPayload,payloadTransfers} from './forestBuild.ts'
import type {ForestLayout} from './forestLayout.ts'
const scope=self as unknown as {onmessage:((event:MessageEvent<ForestLayout&{filamentPreview?:boolean;fullStudy?:boolean;streamRegion?:import('./filaments/filamentField.ts').FilamentRegion;requestId?:string}>) => void)|null;postMessage:(data:unknown,transfers?:ArrayBuffer[]) => void}
scope.onmessage=async event => {
  try {
    const payload=generateForestPayload(event.data,false,event.data.streamRegion)
    scope.postMessage({payload,requestId:event.data.requestId},payloadTransfers(payload))
  }
  catch(error){scope.postMessage({requestId:event.data.requestId,error:error instanceof Error ? error.message : 'Forest generation failed'})}
}
