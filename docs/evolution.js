
function renderEvolution(){
 const greeting=document.getElementById('evolutionGreeting');
 const profileUsername = readStore('mp_community_profile', null)?.username;
 const displayName = profileUsername || window.mpAccountName || window.mpAccountUsername;
 greeting.textContent = displayName
   ? 'Boas-vindas, ' + displayName + '! Este é o seu espaço de evolução.'
   : 'Boas-vindas ao seu espaço de evolução!';
 const box=document.getElementById('evolutionContent'),days=Number(document.getElementById('evolutionPeriod').value),now=new Date(),today=iso(now);
 const weeks=new Set(entries.map(e=>{const d=new Date(e.date+'T12:00:00'),w=new Date(d);w.setDate(d.getDate()-((d.getDay()+6)%7));return iso(w)}));
 const first=entries.map(e=>e.date).sort()[0],enough=first&&(Date.now()-new Date(first+'T12:00:00').getTime()>=13*86400000)&&weeks.size>=2;
 if(!enough){const count=Math.min(weeks.size,2);box.innerHTML='<div class="evolution-locked"><span class="evolution-lock" aria-hidden="true">◷</span><h3>Sua análise está sendo preparada</h3><p>Registre seus passos durante duas semanas para liberar a comparação e ver suas mudanças.</p><div class="evolution-progress"><span style="width:'+count*50+'%"></span></div><small>'+count+' de 2 semanas com registros</small></div>';return}
 const cutoff=shift(today,-days+1),previousStart=shift(cutoff,-7),current=entries.filter(e=>e.date>=shift(today,-6)&&e.date<=today),previous=entries.filter(e=>e.date>=shift(today,-13)&&e.date<=shift(today,-7));
 const total=a=>a.reduce((sum,e)=>sum+(Number(e.value)||0),0),areaTotal=(list,id)=>list.filter(e=>String(e.areaId)===String(id)).reduce((s,e)=>s+(Number(e.value)||0),0);
 const changes=areas.map(a=>({name:a.name,delta:areaTotal(current,a.id)-areaTotal(previous,a.id)})).filter(x=>x.delta!==0).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
 const learnings=entries.filter(e=>e.date>=cutoff&&/aprendi|aprendeu|aprendizado|descobri|consegui pela primeira vez/i.test((e.title||'')+' '+(e.note||'')));
 box.innerHTML='<div class="evolution-compare"><article class="panel evolution-week"><h3>Semana anterior</h3><strong>'+previous.length+'</strong><span>registros</span><p>'+total(previous)+' pontos</p></article><article class="panel evolution-week evolution-current"><h3>Última semana</h3><strong>'+current.length+'</strong><span>registros</span><p>'+total(current)+' pontos</p><small>'+((total(current)-total(previous))>=0?'+':'')+(total(current)-total(previous))+' pontos</small></article></div><h3 class="evolution-subhead">O que mudou</h3>'+(changes.length?'<div class="evolution-insights">'+changes.map(c=>'<div class="evolution-insight"><span>'+ (c.delta>0?'↑':'↓')+'</span><strong>'+(c.delta>0?'Avanço':'Menos registros')+' em '+esc(c.name)+'</strong><small>'+Math.abs(c.delta)+' '+(Math.abs(c.delta)===1?'ponto':'pontos')+' de diferença nesta semana</small></div>').join('')+'</div>':'<p class="evolution-empty">Ainda não há mudanças claras por área para comparar neste período.</p>')+'<h3 class="evolution-subhead">Novos aprendizados</h3>'+(learnings.length?'<ul class="evolution-learnings">'+learnings.map(e=>'<li>'+esc(e.title||e.note)+'</li>').join('')+'</ul>':'<p class="evolution-empty">Quando você anotar algo que aprendeu, isso aparecerá aqui.</p>');
}
document.getElementById('evolutionPeriod').addEventListener('change',renderEvolution);
