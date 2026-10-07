import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
import {Vector3} from 'three'

const source=readFileSync(new URL('../src/filaments/WorldGuideAtlas.ts',import.meta.url),'utf8')
const moduleCode=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace("from 'three'",`from '${import.meta.resolve('three')}'`)
const {WorldGuideAtlas}=await import('data:text/javascript;base64,'+Buffer.from(moduleCode).toString('base64'))
const samples=[0,16,32,48,63]
const points=positions=>{
 const data=new Float32Array(positions.length*256)
 positions.forEach((position,row)=>{for(let col=0;col<64;col++)data.set([...position,1],row*256+col*4)})
 return data
}

// Independent full-scan oracle: no spatial culling, source-order stable sorting.
function expected(data,position,direction,limit){
 const ranked=[]
 for(let row=0;row<data.length/256;row++){
  const distances=samples.map(col=>{
   const at=row*256+col*4,delta=new Vector3(data[at],data[at+1],data[at+2]).sub(position),squared=delta.lengthSq()
   return {squared,visible:!direction||squared<16||delta.dot(direction)/Math.max(.01,Math.sqrt(squared))>.5}
  })
  ranked.push({row,distance:Math.min(...distances.map(p=>p.squared)),visible:Math.min(...distances.filter(p=>p.visible).map(p=>p.squared))})
 }
 ranked.sort((a,b)=>(a.visible-b.visible)||a.distance-b.distance)
 const selected=ranked.filter(p=>p.visible<(direction?65*65:32*32)).slice(0,limit)
 return (selected.length?selected:ranked.slice(0,1)).map(p=>p.row)
}

let checks=0
function checkRanking(data,position,direction,limit=128){
 const count=data.length/256,atlas=new WorldGuideAtlas(data,count,count,limit)
 atlas.select(position,0,direction)
 assert.deepEqual(atlas.selected.map(slot=>atlas.owners[slot]),expected(data,position,direction,limit))
 checks++
}

function testRanking(){
 // Cutoffs, negative cells, ties, disconnected samples, empty and distant fallback.
 const boundary=points([[65,0,0],[64.999,0,0],[32,0,0],[31.999,0,0],[-32,0,0],[0,0,65],[0,0,-65],[4,0,0],[3.999,0,0],[32,32,32],[0,0,0],[0,0,0],[200,200,200]])
 boundary.set([0,0,-2,1],12*256+32*4)
 for(const p of [new Vector3(),new Vector3(32,32,32),new Vector3(-32,-32,-32),new Vector3(1000,0,0)])for(const d of [undefined,new Vector3(1,0,0),new Vector3(-1,0,0),new Vector3(0,0,1)])checkRanking(boundary,p,d)
 checkRanking(new Float32Array(),new Vector3())

 let seed=81
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)
 const data=points(Array.from({length:3000},()=>[(random()-.5)*350,(random()-.5)*140,(random()-.5)*350]))
 for(let row=0;row<3000;row++)for(const col of samples){const at=row*256+col*4;data[at]+=Math.sin(row+col)*30;data[at+1]+=col*.2;data[at+2]+=Math.cos(row-col)*30}
 for(let i=0;i<80;i++)checkRanking(data,new Vector3((random()-.5)*400,(random()-.5)*160,(random()-.5)*400),i%5?new Vector3(random()-.5,random()-.5,random()-.5).normalize():undefined)
}

function testSlotLifetime(){
 // Replacements must preserve occupied slots until the particle lifetime expires.
 const atlas=new WorldGuideAtlas(points([[0,0,0],[1,0,0],[500,0,0],[501,0,0]]),4,4,2)
 atlas.select(new Vector3(),0)
 assert.equal(atlas.select(new Vector3(1,0,0),.1),undefined)
 atlas.replaceSource(points([[200,0,0],[201,0,0]]),Int32Array.from([2,3]))
 atlas.select(new Vector3(200,0,0),1)
 assert.deepEqual(atlas.selected.map(slot=>atlas.owners[slot]),[2,3])
 assert(atlas.slots.has(0)&&atlas.slots.has(1))
 atlas.replaceSource(points([[400,0,0],[401,0,0]]),Int32Array.from([4,5]))
 atlas.select(new Vector3(400,0,0),2)
 assert.equal(atlas.pending,true)
 assert.deepEqual(atlas.selected.map(slot=>atlas.owners[slot]),[2,3])
 assert.equal(atlas.select(new Vector3(400,0,0),2.1),undefined)
 atlas.select(new Vector3(400,0,0),4.2)
 assert.equal(atlas.pending,false)
 assert.deepEqual(atlas.selected.map(slot=>atlas.owners[slot]),[4,5])
 assert(!atlas.slots.has(0)&&!atlas.slots.has(1))
 assert(atlas.select(new Vector3(400,0,0),0)) // clock reset invalidates selection gate
 atlas.replaceSource(new Float32Array(),new Int32Array())
 atlas.select(new Vector3(),1)
 assert.equal(atlas.pending,false)
 assert.deepEqual(atlas.selected.map(slot=>atlas.owners[slot]),[4,5])
}

testRanking();testSlotLifetime()

console.log(`Guide ranking: ${checks} cases matched full-scan oracle; replacement/lifetime/retry/reset checks passed.`)
