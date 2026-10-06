import {Canvas} from '@react-three/fiber'
import {ACESFilmicToneMapping} from 'three'
import {useCallback,useEffect,useRef,useState} from 'react'
import {createForestRenderer,isNativeWebGPU} from './webgpu/createRenderer'
import {ForestMatterLife} from './experience/ForestMatterLife'
import {ForestEffects} from './experience/ForestEffects'
import {PlayerController,type Bridge,type Mode} from './experience/PlayerController'
import {WorldAudio} from './audio'
import {createForestAsync,type Forest} from './forest'

declare global { interface Window { __oneLineDebug?: {snapshot:()=>Record<string,unknown>};__forestLoader?:{stage:(progress:number)=>void;onSound:(handler:(context:AudioContext)=>Promise<void>)=>void;finish:()=>Promise<void>;error:(message:string)=>void} } }

export default function App(){
 const [forest,setForest]=useState<Forest>(),[gpu,setGpu]=useState(false),[mode,setMode]=useState<Mode>('intro')
 const [muted,setMuted]=useState(false),[visible,setVisible]=useState(!document.hidden),[ready,setReady]=useState(false)
 const [rendered,setRendered]=useState(false),[loadingError,setLoadingError]=useState('')
 const [loaderDismissed,setLoaderDismissed]=useState(false)
 const [aboutOpen,setAboutOpen]=useState(false)
 const bridge=useRef<Bridge|null>(null),modeRef=useRef<Mode>('intro'),audio=useRef(new WorldAudio())
 const aboutResume=useRef(false)
 const changeMode=useCallback((next:Mode)=>{modeRef.current=next;setMode(next)},[])
 const sceneRendered=useCallback(()=>setRendered(true),[])
 const renderFailed=useCallback(()=>setLoadingError('The forest could not load. Please reload to try again.'),[])
 useEffect(()=>{window.__forestLoader?.onSound(context=>audio.current.prepare(context))},[])
 useEffect(()=>{const controller=new AbortController();let built:Forest|undefined
  createForestAsync(controller.signal).then(value=>{if(controller.signal.aborted){value.dispose();return}built=value;setForest(value);window.__forestLoader?.stage(.9)}).catch(error=>{if(error.name!=='AbortError')renderFailed()})
  return()=>{controller.abort();built?.dispose()}
 },[renderFailed])
 useEffect(()=>{if(loadingError)window.__forestLoader?.error(loadingError)},[loadingError])
 useEffect(()=>{
  if(!forest||!ready||!rendered||loadingError)return
  let cancelled=false
  const completion=window.__forestLoader?.finish()??Promise.resolve()
  completion.then(()=>{if(!cancelled){setLoaderDismissed(true);changeMode('walk');void audio.current.start().catch(()=>undefined)}})
  return()=>{cancelled=true}
 },[forest,ready,rendered,loadingError,changeMode])
 useEffect(()=>{audio.current.setMuted(muted)},[muted])
 useEffect(()=>{audio.current.setActive(visible&&(mode==='walk'||mode==='follow'))},[mode,visible])
 useEffect(()=>{const onVisibility=()=>{setVisible(!document.hidden);if(document.hidden&&(modeRef.current==='walk'||modeRef.current==='follow')){changeMode('paused');if(document.pointerLockElement)document.exitPointerLock()}};document.addEventListener('visibilitychange',onVisibility);return()=>document.removeEventListener('visibilitychange',onVisibility)},[changeMode])
 useEffect(()=>()=>audio.current.dispose(),[])
 const walk=useCallback(()=>{if(!loaderDismissed||aboutOpen)return;void audio.current.start().catch(()=>undefined);changeMode('walk')},[changeMode,loaderDismissed,aboutOpen])
 const look=useCallback(()=>{if(!loaderDismissed)return;walk();bridge.current?.lock()},[walk,loaderDismissed])
 const pause=useCallback(()=>{if(modeRef.current==='walk'||modeRef.current==='follow')changeMode('paused');if(document.pointerLockElement)document.exitPointerLock()},[changeMode])
 const openAbout=useCallback(()=>{
  aboutResume.current=modeRef.current==='walk'||modeRef.current==='follow'
  if(aboutResume.current){changeMode('paused');if(document.pointerLockElement)document.exitPointerLock()}
  setAboutOpen(true)
 },[changeMode])
 const closeAbout=useCallback(()=>{setAboutOpen(false);if(aboutResume.current){aboutResume.current=false;changeMode('walk')}},[changeMode])
 useEffect(()=>{if(!aboutOpen)return;const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closeAbout()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[aboutOpen,closeAbout])
 useEffect(()=>{window.__oneLineDebug={snapshot:()=>bridge.current?.snapshot()??{}};return()=>{delete window.__oneLineDebug}},[])
 const running=mode==='walk'||mode==='follow',intro=mode==='intro'
 return <main aria-label="VESTIGE" className={`experience forest-experience ${running?'is-running':''}`} data-mode={mode} data-scene="forest" data-renderer={gpu?'webgpu':'webgl'}>
  <div className="world" onClick={look}>{forest&&<Canvas dpr={[1,1.5]} frameloop={!visible?'never':running||intro?'always':'demand'} camera={{position:forest.stops[0].view,fov:68,near:.05,far:350}} gl={createForestRenderer} onCreated={({gl})=>{setGpu(isNativeWebGPU(gl));gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=1.05;gl.setClearColor(0x01030a)}} fallback={null}>
   <color attach="background" args={['#01030a']}/><fog attach="fog" args={['#000000',18,90]}/><primitive object={forest.group} dispose={null}/><PlayerController forest={forest} audio={audio.current} mode={mode} enabled={loaderDismissed&&!aboutOpen} onInteract={walk} onPause={pause} bridgeRef={bridge} onLock={()=>changeMode('walk')} onUnlock={()=>{if(modeRef.current==='walk')pause()}} onEnd={()=>changeMode('end')} onReport={()=>{}} onError={()=>{}} onReady={()=>setReady(true)}/><ForestMatterLife forest={forest} intro={intro}/><ForestEffects forest={forest} onReady={sceneRendered} onError={renderFailed}/>
  </Canvas>}</div>
  {loaderDismissed&&<><button className="about-trigger" onClick={openAbout} aria-haspopup="dialog" aria-expanded={aboutOpen}>ABOUT</button><section className="journey-controls"><button onClick={()=>setMuted(value=>!value)} aria-pressed={muted}>{muted?'SOUND OFF':'SOUND ON'}</button><button onClick={mode==='paused'?walk:pause}>{mode==='paused'?'RESUME':'PAUSE'}</button></section></>}
  {aboutOpen&&<section className="about-page" role="dialog" aria-modal="true" aria-labelledby="about-title"><div className="about-sheet"><button className="about-close" onClick={closeAbout} aria-label="Close About">CLOSE</button><article className="about-copy"><h1 id="about-title">VESTIGE</h1><p className="about-lead">A message to the future, carried by sound.</p><p>VESTIGE is a place to wander and listen. Walk through a world of luminous roots, towering mushrooms, and pathways woven from light. A glow follows your footsteps. As you approach each mushroom, a different soundscape unfolds: birds calling, waterfalls rushing, cicadas filling the air.</p><p>It looks like another world. What you hear is this one.</p><p>I created VESTIGE as a personal message to the future. As I imagine a world increasingly shaped by technology, I wonder how much room will remain for sounds we did not create. Will the voices of birds, the movement of water, and the quiet rustling of a forest still be ordinary experiences? Or will they become something people have to search for?</p><p>This is not a prediction that nature will disappear. It is an invitation to notice what we might otherwise take for granted.</p><p>Each mushroom holds a small piece of that living world. Together, they form a connected landscape of sound — not simply to tell a future visitor that these places existed, but to offer a sense of what it felt like to be there. To stand somewhere where human activity was not the loudest thing.</p><p>There is no need to hurry. Follow a distant call. Stay beside the water. Listen to what becomes audible when you stop moving.</p><p>My hope is that these sounds will never need a place like this to survive — and that VESTIGE will remain a reminder, never a replacement.</p></article></div></section>}
 </main>
}
