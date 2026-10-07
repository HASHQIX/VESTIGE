(() => {
 const overlay=document.getElementById('startup-loading');
 if(!overlay)return;
 const button=overlay.querySelector('.loader-sound'),status=overlay.querySelector('.loader-status');
 let handler,revealHandler,context,sceneReady=false,failed=false,leaving=false,resolveFinish;
 let revealReady=false,readingHoldStarted=false,soundRequested=false;
 const completion=new Promise(resolve=>{resolveFinish=resolve});
 const tagline=overlay.querySelector('.loader-tagline');
 function holdForReading(){
  if(readingHoldStarted)return;
  readingHoldStarted=true;
  window.setTimeout(()=>{revealReady=true;enter()},4000);
 }
 tagline.addEventListener('animationend',event=>{if(event.target===tagline&&event.animationName==='copy-reveal')holdForReading()});
 if(matchMedia('(prefers-reduced-motion: reduce)').matches)holdForReading();
 function revealWorld(){
  revealHandler?.();overlay.classList.add('is-leaving');
  window.setTimeout(()=>{document.removeEventListener('click',activate);overlay.remove();resolveFinish()},matchMedia('(prefers-reduced-motion: reduce)').matches?220:2250);
 }
 function captureParticles(){
  const ratio=Math.min(window.devicePixelRatio||1,1.5),width=innerWidth,height=innerHeight;
  const source=document.createElement('canvas');source.width=Math.ceil(width*ratio);source.height=Math.ceil(height*ratio);
  const ctx=source.getContext('2d');if(!ctx)return null;
  ctx.scale(ratio,ratio);
  const glyphs=overlay.querySelectorAll('.loader-kicker .loader-word>span,.loader-title>span,.loader-tagline .loader-word>span,.loader-label');
  for(const glyph of glyphs){
   const box=glyph.getBoundingClientRect(),container=glyph.closest('.loader-title,.loader-kicker,.loader-tagline,.loader-sound'),style=getComputedStyle(container);
   const size=parseFloat(style.fontSize)||16;
   ctx.font=`${style.fontWeight} ${size}px ${style.fontFamily}`;
   ctx.fillStyle=container.matches('.loader-title')?style.color:'#bf9970';
   ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=container.matches('.loader-title')?7:2;
   const text=glyph.textContent||'',metrics=ctx.measureText(text);
   const ascent=metrics.fontBoundingBoxAscent??size*.8,descent=metrics.fontBoundingBoxDescent??size*.2;
   ctx.fillText(text,box.left+(box.width-metrics.width)/2,box.top+(box.height-ascent-descent)/2+ascent);
  }
  ctx.shadowBlur=0;
  for(const selector of ['.loader-line-horizontal','.loader-line-vertical']){
   const el=overlay.querySelector(selector),r=el.getBoundingClientRect();ctx.fillStyle='#cba477';ctx.fillRect(r.left,r.top,Math.max(1,r.width),Math.max(1,r.height));
  }
  const orbit=overlay.querySelector('.loader-orbit'),r=orbit.getBoundingClientRect();
  ctx.beginPath();ctx.ellipse(r.left+r.width/2,r.top+r.height/2,r.width/2,r.height/2,0,0,Math.PI*2);ctx.strokeStyle='#9f7950';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#ffe0ab';ctx.shadowColor='#ffbf72';ctx.shadowBlur=8;
  for(const y of [r.top,r.bottom]){ctx.beginPath();ctx.arc(r.left+r.width/2,y,1.5,0,Math.PI*2);ctx.fill()}
  ctx.shadowBlur=0;
  const pixels=ctx.getImageData(0,0,source.width,source.height),step=4,particles=[];
  for(let y=0;y<source.height;y+=step)for(let x=0;x<source.width;x+=step){
   const i=(y*source.width+x)*4;if(pixels.data[i+3]<28)continue;
   particles.push({x:x/ratio,y:y/ratio,r:pixels.data[i],g:pixels.data[i+1],b:pixels.data[i+2],alpha:pixels.data[i+3]/255,size:(1.2+Math.random()*1.5)/ratio,
    delay:y/source.height*2400,duration:1200+Math.random()*350,
    dx:10+Math.random()*70,dy:70+Math.random()*150,wobble:(Math.random()-.5)*40,phase:Math.random()*Math.PI*2});
  }
  return {particles,width,height,ratio};
 }
 function eraseWithWind(){
  const captured=captureParticles();
  if(!captured){revealWorld();return}
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(captured.width*captured.ratio);canvas.height=Math.ceil(captured.height*captured.ratio);
  Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:'2',pointerEvents:'none'});overlay.appendChild(canvas);
  const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();revealWorld();return}
  ctx.scale(captured.ratio,captured.ratio);overlay.classList.add('is-erasing');
  const content=overlay.querySelector('.loader-content'),started=performance.now(),duration=4000;
  function frame(now){
   const elapsed=now-started;ctx.clearRect(0,0,captured.width,captured.height);
   content.style.clipPath=`inset(${Math.min(captured.height,elapsed/2400*captured.height)}px 0 0)`;
   for(const p of captured.particles){
    const age=(elapsed-p.delay)/p.duration;if(age<0||age>=1)continue;
    const drift=age*age;
    ctx.globalAlpha=(1-age)*p.alpha;ctx.fillStyle=`rgb(${p.r},${p.g},${p.b})`;
    const x=p.x+p.dx*drift+p.wobble*drift+Math.sin(p.phase+age*10)*age*8;
    const y=p.y+p.dy*drift+age*age*95;
    ctx.fillRect(x,y,p.size,p.size);
   }
   ctx.globalAlpha=1;
   if(elapsed<duration)requestAnimationFrame(frame);else{canvas.remove();revealWorld()}
  }
  requestAnimationFrame(frame);
 }
 function enter(){
  if(!sceneReady||!revealReady||failed||leaving)return;
  leaving=true;button.disabled=true;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)revealWorld();
  else eraseWithWind();
 }
 async function prepare(){
  if(!handler||!context)return;
  try{
   await handler(context);overlay.classList.add('sound-enabled');
   button.setAttribute('aria-pressed','true');status.textContent='';enter();
  }catch{
   soundRequested=false;button.disabled=false;overlay.classList.remove('sound-enabled');
   status.textContent='Could not enable sound. Try again.';
  }
 }
 function activate(){
  if(failed)return;
  // Lock a persistent element during the gesture, even before the canvas exists.
  const target=document.getElementById('root');
  if(target&&document.pointerLockElement!==target){
   try{void Promise.resolve(target.requestPointerLock()).catch(()=>{})}catch{}
  }
  if(soundRequested)return;
  soundRequested=true;
  button.disabled=true;overlay.classList.add('sound-enabled');status.textContent='';
  try{
   context??=new AudioContext();
   void context.resume().then(prepare).catch(()=>{soundRequested=false;button.disabled=false;overlay.classList.remove('sound-enabled');status.textContent='Could not enable sound. Try again.'});
  }catch{soundRequested=false;button.disabled=false;overlay.classList.remove('sound-enabled');status.textContent='Sound is unavailable in this browser.'}
 }
 // Includes the dust/fade phase, when clicks pass through the overlay.
 document.addEventListener('click',activate);
 window.__forestLoader={
  stage(){},
  onSound(callback){handler=callback;if(context)void prepare()},
  onReveal(callback){revealHandler=callback},
  finish(){sceneReady=true;enter();return completion},
  error(message){failed=true;button.hidden=true;status.hidden=true;const error=overlay.querySelector('.loader-error');error.hidden=false;error.querySelector('p').textContent=message},
 };
 overlay.querySelector('.loader-error button').addEventListener('click',()=>location.reload());
})();
