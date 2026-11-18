
(function(){
 const dialog=document.getElementById('newAreaDialog'),form=document.getElementById('newAreaForm'),error=document.getElementById('newAreaError'),nameInput=document.getElementById('newAreaName'),goalInput=document.getElementById('newAreaGoal');
 function close(){dialog.close();document.getElementById('addArea').focus()}
 dialog.querySelector('.area-dialog-close').onclick=close;dialog.querySelector('.area-dialog-cancel').onclick=close;
 dialog.addEventListener('close',()=>document.getElementById('addArea').focus());
 form.addEventListener('input',()=>{error.textContent='';nameInput.removeAttribute('aria-invalid');goalInput.removeAttribute('aria-invalid')});
 form.addEventListener('submit',event=>{
 event.preventDefault();const name=nameInput.value.trim().replace(/\s+/g,' '),goal=Number(goalInput.value);
 function invalid(input,message){error.textContent=message;input.setAttribute('aria-invalid','true');input.focus()}
 if(!name||name.length>32)return invalid(nameInput,'Digite um nome de até 32 caracteres.');
 if(areas.some(a=>a.name.trim().toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR')))return invalid(nameInput,'Você já tem uma área com esse nome.');
 if(!goalInput.value.trim()||!Number.isSafeInteger(goal)||goal<1||goal>100000)return invalid(goalInput,'Use um número inteiro entre 1 e 100.000 pontos.');
 const palette=['#8dbb8c','#91b2dc','#e6aa81','#bd9cdb','#df9baf','#82bfb7'],icons=['🌱','🎨','🏃','🧠','💧','🎯'];
 const area={id:crypto.randomUUID(),name,icon:icons[areas.length%icons.length],color:palette[areas.length%palette.length],goal};areas.push(area);
 if(!save()){areas.pop();return invalid(nameInput,'Não foi possível salvar neste navegador. Libere espaço e tente novamente.')}
 render();close();if(currentUser)void saveAreaCloud(area);toast('Área criada.');
 });
})();
