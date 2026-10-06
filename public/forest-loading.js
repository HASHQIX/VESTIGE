(() => {
 const overlay=document.getElementById('startup-loading');
 if(!overlay)return;
 const button=overlay.querySelector('.loader-sound'),status=overlay.querySelector('.loader-status');
 let handler,context,sceneReady=false,soundReady=false,failed=false,leaving=false,resolveFinish;
 const completion=new Promise(resolve=>{resolveFinish=resolve});
 function enter(){
  if(!sceneReady||!soundReady||failed||leaving)return;
  leaving=true;button.disabled=true;overlay.classList.add('is-leaving');
  window.setTimeout(()=>{overlay.remove();resolveFinish()},matchMedia('(prefers-reduced-motion: reduce)').matches?220:750);
 }
 async function prepare(){
  if(!handler||!context)return;
  try{
   await handler(context);soundReady=true;overlay.classList.add('sound-enabled');
   button.setAttribute('aria-pressed','true');status.textContent='';enter();
  }catch{
   button.disabled=false;overlay.classList.remove('sound-enabled');
   status.textContent='Could not enable sound. Try again.';
  }
 }
 button.addEventListener('click',()=>{
  if(button.disabled||failed)return;
  button.disabled=true;overlay.classList.add('sound-enabled');status.textContent='';
  try{
   context??=new AudioContext();
   void context.resume().then(prepare).catch(()=>{button.disabled=false;overlay.classList.remove('sound-enabled');status.textContent='Could not enable sound. Try again.'});
  }catch{button.disabled=false;overlay.classList.remove('sound-enabled');status.textContent='Sound is unavailable in this browser.'}
 });
 window.__forestLoader={
  stage(){},
  onSound(callback){handler=callback;if(context)void prepare()},
  finish(){sceneReady=true;enter();return completion},
  error(message){failed=true;button.hidden=true;status.hidden=true;const error=overlay.querySelector('.loader-error');error.hidden=false;error.querySelector('p').textContent=message},
 };
 overlay.querySelector('.loader-error button').addEventListener('click',()=>location.reload());
})();
