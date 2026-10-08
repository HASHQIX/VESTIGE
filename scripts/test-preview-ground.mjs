import assert from 'node:assert/strict'
import {Vector3} from 'three'
import {appendPreviewSegment,previewLines} from '../src/forestPreview.ts'
import {createForestLayout} from '../src/forestLayout.ts'
import {worldSkeleton} from '../src/worldSkeleton.ts'
import {forestFloor} from '../src/forestNavigation.ts'

// Sample the actual emitted segments, including their interiors. Endpoint-only
// clipping would miss terrain crests with visible endpoints on both sides.
function checkAboveSoil(data){
 assert.equal(data.length%6,0)
 for(let i=0;i<data.length;i+=6)for(let j=0;j<=32;j++){
  const t=j/32,x=data[i]+(data[i+3]-data[i])*t,y=data[i+1]+(data[i+4]-data[i+1])*t,z=data[i+2]+(data[i+5]-data[i+2])*t
  assert(Number.isFinite(x+y+z))
  assert(y>=forestFloor(x,z)+.007,`Preview below soil at ${x}, ${y}, ${z}`)
 }
}

function testSegments(){
 const emit=(a,b)=>{const data=[];appendPreviewSegment(data,a,b);checkAboveSoil(data);return data}
 const a=new Vector3(0,0,0),b=new Vector3(0,8,0),savedA=a.clone(),savedB=b.clone()
 const clipped=emit(a,b);assert.equal(clipped.length,6);assert(Math.abs(clipped[1]-2.51)<.001);assert.equal(clipped[4],8)
 assert.deepEqual(emit(b,a),[...clipped.slice(3),...clipped.slice(0,3)])
 assert(a.equals(savedA)&&b.equals(savedB))
 assert.equal(emit(new Vector3(-2,0,0),new Vector3(2,0,0)).length,0)
 assert.deepEqual(emit(new Vector3(-2,9,0),new Vector3(2,8,0)),[-2,9,0,2,8,0])
 // A crest cuts the line in two; a valley exposes a middle section even when
 // both original endpoints are buried. These use the real terrain function.
 const crest=emit(new Vector3(0,3.5,0),new Vector3(0,3.5,Math.PI/.044));assert(crest.length>=12)
 const valley=emit(new Vector3(0,2,Math.PI/.044),new Vector3(0,2,2*Math.PI/.044));assert(valley.length>0)
}

function testForest(){
 const layout=createForestLayout(),skeleton=worldSkeleton(layout),start=performance.now(),data=previewLines(layout,skeleton)
 assert(data.length>0);checkAboveSoil(data)
 // Caps/high limbs must survive unchanged; don't "fix" burial by moving the
 // mushrooms, replacing terrain, or removing their entire preview.
 const mushroom={kind:'mushroom',id:0,x:0,z:0,base:-5,height:15,radius:2,hue:0}
 const isolated=previewLines({...layout,mushrooms:[mushroom]}, {nodes:[],limbs:[],hubs:[],attachments:[]})
 checkAboveSoil(isolated);assert(isolated.some((value,i)=>i%3===1&&value>10))
 console.log(`Preview terrain clipping: segment/crest/valley checks and ${data.length/6} real forest segments passed (${Math.round(performance.now()-start)} ms including dense validation).`)
}

testSegments();testForest()
