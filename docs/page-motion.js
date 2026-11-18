
(function gentlePageMotion(){
 const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');if(reduce.matches)return;
 const animations=new Set();
 if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(!entry.isIntersecting)return;const el=entry.target;if(el.getBoundingClientRect().height===0)return;observer.unobserve(el);if(typeof el.animate==='function'){const animation=el.animate([{opacity:.45},{opacity:1}],{duration:650,easing:'cubic-bezier(.2,.65,.3,1)'});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(animation));}})},{threshold:.08});
  document.querySelectorAll('.panel,.stats,.tip-grid article,.about-cards article').forEach(el=>observer.observe(el));
  reduce.addEventListener('change',()=>{if(reduce.matches){observer.disconnect();animations.forEach(animation=>animation.cancel());animations.clear();}});
 }
 if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
 const light=document.createElement('div');light.className='cursor-light';light.setAttribute('aria-hidden','true');document.body.append(light);
 document.addEventListener('pointermove',event=>{if(event.pointerType==='touch'||reduce.matches)return;light.style.transform='translate3d('+event.clientX+'px,'+event.clientY+'px,0)';light.classList.add('visible');},{passive:true});
 function hide(){light.classList.remove('visible');}
 document.documentElement.addEventListener('pointerleave',hide);window.addEventListener('blur',hide);document.addEventListener('visibilitychange',()=>{if(document.hidden)hide()});reduce.addEventListener('change',()=>{if(reduce.matches)hide()});
})();
