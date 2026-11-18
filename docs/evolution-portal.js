
document.getElementById('evolutionExit').addEventListener('click', () => showPage('dashboard'));
let portalTimer;
function openEvolutionPortal(leaving=false){
 const portal=document.getElementById('evolutionPortal');
 portal.querySelector('.portal-message').textContent=leaving?'Voltando ao seu espaço':'Seu espaço de evolução';
 clearTimeout(portalTimer);
 portal.classList.remove('portal-active');
 portal.classList.toggle('portal-closing',leaving);
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 void portal.offsetWidth;
 portal.classList.add('portal-active');
 portalTimer=setTimeout(()=>portal.classList.remove('portal-active'),1600);
}
