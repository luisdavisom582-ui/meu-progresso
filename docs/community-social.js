(function socialCommunity() {
  'use strict';
  const page = document.querySelector('.community-page');
  const legacy = document.createElement('div');
  legacy.hidden = true;
  legacy.className = 'community-legacy';
  while (page.firstChild) legacy.append(page.firstChild);
  page.append(legacy);
  const storageKey = 'mp_social_demo_v1';
  const examples = [
    { id: 'sample-reading', author: 'Marina', initials: 'MA', topic: 'Pequena vitória', body: 'Voltei a ler antes de dormir. Foram só dez páginas, mas gostei de reservar esse tempo para mim.', date: 'Relato de exemplo', example: true },
    { id: 'sample-routine', author: 'Rafael', initials: 'RA', topic: 'Rotina', body: 'Nesta semana, organizei o estudo em períodos curtos. Consegui começar com mais calma e respeitar as pausas.', date: 'Relato de exemplo', example: true },
    { id: 'sample-day', author: 'Pessoa anônima', initials: 'PA', topic: 'Meu dia', body: 'Hoje não consegui cumprir tudo o que planejei. Anotei o que fiz e deixei uma tarefa pequena para amanhã.', date: 'Relato de exemplo', example: true, anonymous: true }
  ];
  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey));
      if (value && Array.isArray(value.posts) && Array.isArray(value.supported) &&
          Array.isArray(value.saved) && Array.isArray(value.hidden) &&
          value.comments && typeof value.comments === 'object') return value;
    } catch {}
    return { posts: [], supported: [], saved: [], hidden: [], comments: {} };
  }
  let state = loadState();
  let view = 'feed';
  let topic = '';
  let search = '';
  let photo = '';
  let photoPending = false;
  let photoRevision = 0;
  let focusPost = '';
  const root = document.createElement('div');
  root.className = 'social-community';
  page.append(root);
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }
  function myName() {
    try {
      const userName = typeof currentUser !== 'undefined' && currentUser
        ? currentUser.user_metadata?.full_name || currentUser.user_metadata?.name : '';
      const stored = JSON.parse(localStorage.getItem('mp_community_profile') || 'null');
      return String(userName || stored?.display_name || 'Você').slice(0, 60);
    } catch { return 'Você'; }
  }
  function icon(name) {
    const paths = {
      heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
      comment: '<path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z"/>',
      save: '<path d="M6 3h12v18l-6-4-6 4Z"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      flag: '<path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/>',
      photo: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>'
    };
    return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
  }
  function announce(message) {
    root.querySelector('.social-status').textContent = message;
  }
  function commit(change) {
    const next = JSON.parse(JSON.stringify(state));
    change(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch {
      announce('Não foi possível salvar. Libere espaço no navegador e tente novamente.');
      return false;
    }
    state = next;
    return true;
  }
  function posts() { return [...state.posts, ...examples]; }
  function toggle(list, id) {
    const index = list.indexOf(id);
    if (index === -1) list.push(id);
    else list.splice(index, 1);
  }
  function validPhoto(value) {
    return typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(value);
  }
  function postCard(post) {
    const supported = state.supported.includes(post.id);
    const saved = state.saved.includes(post.id);
    const comments = Array.isArray(state.comments[post.id]) ? state.comments[post.id] : [];
    return '<article class="social-post panel" data-post="' + escape(post.id) + '">' +
      '<header class="social-post-head"><button class="social-author" data-action="profile">' +
      '<span class="social-avatar">' + escape(post.initials || 'EU') + '</span><span><strong>' +
      escape(post.author) + '</strong><small>' + escape(post.date) + '</small></span></button>' +
      '<button class="social-icon-button" data-action="report" aria-label="Denunciar publicação de ' +
      escape(post.author) + '">' + icon('flag') + '</button></header>' +
      '<span class="social-topic">' + escape(post.topic) + '</span><p class="social-body">' +
      escape(post.body) + '</p>' + (validPhoto(post.photo) ? '<img class="social-post-image" src="' +
      escape(post.photo) + '" alt="Foto anexada à publicação de ' + escape(post.author) + '" loading="lazy">' : '') +
      '<div class="social-post-actions"><button data-action="support" aria-pressed="' + supported + '">' +
      icon('heart') + (supported ? 'Apoiado' : 'Apoiar') + '</button><button data-action="comments" aria-expanded="' +
      (focusPost === post.id) + '">' + icon('comment') + 'Comentar' +
      (comments.length ? ' (' + comments.length + ')' : '') + '</button><button data-action="save" aria-pressed="' +
      saved + '">' + icon('save') + (saved ? 'Salvo' : 'Salvar') + '</button></div>' +
      '<div class="social-comments"' + (focusPost === post.id ? '' : ' hidden') + '>' +
      '<p class="social-local-note">Comentários de teste, visíveis só neste navegador.</p>' +
      comments.map(comment => '<p class="social-comment"><strong>' + escape(comment.author) +
        '</strong> ' + escape(comment.body) + '</p>').join('') +
      '<form class="social-comment-form"><label class="social-sr-only" for="comment-' +
      escape(post.id) + '">Seu comentário</label><input id="comment-' + escape(post.id) +
      '" name="comment" required maxlength="400" placeholder="Escreva com respeito…" autocomplete="off">' +
      '<button type="submit" class="select-small">Enviar</button></form></div></article>';
  }
  root.innerHTML =
    '<header class="social-header"><div><h2>Comunidade</h2><p>Pequenos passos, histórias compartilhadas.</p></div>' +
    '<button class="add-btn" id="socialNewPost">' + icon('plus') + 'Criar publicação</button></header>' +
    '<p class="social-demo-note">Demonstração com perfis fictícios. Publicações, apoios, comentários e salvos ficam apenas neste navegador.</p>' +
    '<div class="social-layout"><aside class="social-sidebar panel"><div class="social-my-profile"><span class="social-avatar social-avatar-large">EU</span>' +
    '<strong id="socialMyName"></strong><small>Seu espaço na comunidade</small></div>' +
    '<nav class="social-navigation" aria-label="Navegação da comunidade"><button data-view="feed">Feed</button>' +
    '<button data-view="saved">Salvos</button><button data-view="mine">Minhas publicações</button>' +
    '<button data-view="guide">Como funciona</button></nav></aside><div class="social-main">' +
    '<div class="social-filters panel"><label for="socialSearch">Buscar relatos<input id="socialSearch" type="search" placeholder="Busque por assunto ou palavra"></label>' +
    '<label for="socialTopic">Tema<select id="socialTopic"><option value="">Todos os temas</option><option>Pequena vitória</option><option>Rotina</option><option>Meu dia</option><option>Aprendizado</option></select></label></div>' +
    '<div class="social-status" role="status" aria-live="polite"></div><div id="socialFeed"></div></div></div>' +
    '<dialog class="social-dialog" id="socialComposer" aria-labelledby="socialComposerTitle"><form id="socialPostForm">' +
    '<div class="social-dialog-head"><h2 id="socialComposerTitle">Criar publicação</h2><button type="button" data-close aria-label="Fechar">×</button></div>' +
    '<p class="social-local-note">Publicação de teste. Ela ficará apenas neste navegador.</p>' +
    '<label for="socialBody">O que você quer compartilhar?</label><textarea id="socialBody" required maxlength="1200" rows="5" placeholder="Conte uma pequena conquista ou como foi seu dia…"></textarea>' +
    '<div class="social-compose-row"><label for="socialComposeTopic">Tema<select id="socialComposeTopic"><option>Meu dia</option><option>Pequena vitória</option><option>Rotina</option><option>Aprendizado</option></select></label>' +
    '<label class="social-anonymous"><input id="socialAnonymous" type="checkbox" checked>Publicar anonimamente</label></div>' +
    '<label class="social-photo-label" for="socialPhoto">' + icon('photo') + 'Adicionar foto (opcional)<input id="socialPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
    '<div id="socialPhotoPreview" hidden><img alt="Prévia da foto"><button type="button" id="socialRemovePhoto" class="select-small">Remover foto</button></div>' +
    '<p class="social-local-note">Use dados fictícios. Escolha uma foto sua, sem dados pessoais ou outras pessoas sem autorização.</p>' +
    '<p id="socialComposerError" class="social-error" role="alert"></p><div class="social-dialog-actions"><button type="button" data-close class="select-small">Cancelar</button>' +
    '<button type="submit" class="add-btn">Publicar neste navegador</button></div></form></dialog>' +
    '<dialog class="social-dialog" id="socialProfile" aria-labelledby="socialProfileTitle"><div class="social-dialog-head"><h2 id="socialProfileTitle">Perfil</h2>' +
    '<button type="button" data-close aria-label="Fechar perfil">×</button></div><div id="socialProfileContent"></div></dialog>' +
    '<dialog class="social-dialog" id="socialReport" aria-labelledby="socialReportTitle"><form id="socialReportForm"><div class="social-dialog-head"><h2 id="socialReportTitle">Denunciar publicação</h2>' +
    '<button type="button" data-close aria-label="Fechar denúncia">×</button></div><p>Nesta demonstração, a publicação será ocultada só para você. Nenhuma denúncia será enviada.</p>' +
    '<label for="socialReportReason">Motivo<select id="socialReportReason" required><option value="">Selecione</option><option>Desrespeito</option><option>Exposição de dados pessoais</option><option>Conteúdo inadequado</option><option>Outro motivo</option></select></label>' +
    '<div class="social-dialog-actions"><button type="button" data-close class="select-small">Cancelar</button><button type="submit" class="add-btn">Ocultar neste navegador</button></div></form></dialog>';
  const feed = root.querySelector('#socialFeed');
  const composer = root.querySelector('#socialComposer');
  const profileDialog = root.querySelector('#socialProfile');
  const reportDialog = root.querySelector('#socialReport');
  let reportedId = '';
  function render() {
    root.querySelector('#socialMyName').textContent = myName();
    root.querySelectorAll('[data-view]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    root.querySelector('.social-filters').hidden = view === 'guide';
    if (view === 'guide') {
      feed.innerHTML = '<section class="panel social-guide"><h3>Compartilhe no seu ritmo</h3><ol><li>Toque em “Criar publicação” e escreva seu relato.</li>' +
        '<li>Escolha um tema e decida se quer usar seu nome ou publicar anonimamente.</li><li>Use Apoiar, Comentar e Salvar para experimentar o feed.</li></ol>' +
        '<p>Respeite as experiências das pessoas e preserve informações pessoais. Toque na bandeira para ocultar uma publicação inadequada.</p>' +
        '<p>Todos os perfis de exemplo são fictícios. As interações desta demonstração ficam neste navegador.</p></section>';
      return;
    }
    const query = search.trim().toLocaleLowerCase('pt-BR');
    const visible = posts().filter(post => !state.hidden.includes(post.id))
      .filter(post => view !== 'saved' || state.saved.includes(post.id))
      .filter(post => view !== 'mine' || post.mine)
      .filter(post => !topic || post.topic === topic)
      .filter(post => !query || (post.body + ' ' + post.author + ' ' + post.topic).toLocaleLowerCase('pt-BR').includes(query));
    feed.innerHTML = visible.length ? visible.map(postCard).join('') :
      '<div class="panel social-empty"><h3>' + (view === 'saved' ? 'Seus salvos ficam aqui' : view === 'mine' ? 'Seu primeiro relato pode começar aqui' : 'Nenhum relato encontrado') +
      '</h3><p>' + (view === 'saved' ? 'Toque em Salvar em uma publicação para guardar e ler depois.' : view === 'mine' ? 'Use Criar publicação para experimentar.' : 'Tente outra palavra ou mude o tema.') + '</p></div>';
  }
  root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    view = button.dataset.view;
    render();
  }));
  root.querySelector('#socialSearch').addEventListener('input', event => { search = event.target.value; render(); });
  root.querySelector('#socialTopic').addEventListener('change', event => { topic = event.target.value; render(); });
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  root.querySelector('#socialNewPost').addEventListener('click', () => {
    composer.showModal();
    root.querySelector('#socialBody').focus();
  });
  function removePhoto() {
    photoRevision += 1;
    photoPending = false;
    photo = '';
    root.querySelector('#socialPhoto').value = '';
    root.querySelector('#socialPhotoPreview').hidden = true;
  }
  root.querySelector('#socialRemovePhoto').addEventListener('click', removePhoto);
  root.querySelector('#socialPhoto').addEventListener('change', async event => {
    const file = event.target.files[0];
    removePhoto();
    if (!file) return;
    const error = root.querySelector('#socialComposerError');
    error.textContent = '';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      error.textContent = 'Escolha uma imagem JPG, PNG ou WebP de até 4 MB.';
      return;
    }
    const revision = photoRevision;
    photoPending = true;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (revision !== photoRevision) return;
      const ratio = Math.min(1, 1000 / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      photo = canvas.toDataURL('image/webp', .75);
      root.querySelector('#socialPhotoPreview img').src = photo;
      root.querySelector('#socialPhotoPreview').hidden = false;
    } catch { error.textContent = 'Não foi possível abrir essa foto. Tente outra imagem.'; }
    finally { URL.revokeObjectURL(url); if (revision === photoRevision) photoPending = false; }
  });
  root.querySelector('#socialPostForm').addEventListener('submit', event => {
    event.preventDefault();
    const body = root.querySelector('#socialBody').value.trim();
    const error = root.querySelector('#socialComposerError');
    if (!body) { error.textContent = 'Escreva seu relato antes de publicar.'; return; }
    if (photoPending) { error.textContent = 'Aguarde a preparação da foto.'; return; }
    const anonymous = root.querySelector('#socialAnonymous').checked;
    const author = anonymous ? 'Pessoa anônima' : myName();
    const post = { id: crypto.randomUUID(), author, initials: anonymous ? 'PA' : author.slice(0, 2).toUpperCase(),
      body, photo, anonymous, topic: root.querySelector('#socialComposeTopic').value, mine: true,
      date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) };
    if (!commit(next => next.posts.unshift(post))) {
      error.textContent = 'Não foi possível salvar. Libere espaço no navegador e tente novamente.';
      return;
    }
    event.target.reset();
    removePhoto();
    error.textContent = '';
    composer.close();
    view = 'feed';
    topic = '';
    search = '';
    root.querySelector('#socialSearch').value = '';
    root.querySelector('#socialTopic').value = '';
    render();
    announce('Publicação salva neste navegador.');
  });
  feed.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    const card = button?.closest('[data-post]');
    if (!card) return;
    const post = posts().find(item => item.id === card.dataset.post);
    if (!post) return;
    if (button.dataset.action === 'support' || button.dataset.action === 'save') {
      const key = button.dataset.action === 'support' ? 'supported' : 'saved';
      if (commit(next => toggle(next[key], post.id))) {
        render();
        const updated = [...feed.querySelectorAll('[data-post]')].find(item => item.dataset.post === post.id);
        updated?.querySelector('[data-action="' + button.dataset.action + '"]')?.focus();
      }
    } else if (button.dataset.action === 'comments') {
      focusPost = focusPost === post.id ? '' : post.id;
      render();
      if (focusPost) document.getElementById('comment-' + post.id)?.focus();
    } else if (button.dataset.action === 'profile') {
      const related = posts().filter(item => post.anonymous ? item.id === post.id :
        post.mine ? item.mine && !item.anonymous : item.example && item.author === post.author);
      root.querySelector('#socialProfileContent').innerHTML = '<div class="social-profile-summary"><span class="social-avatar social-avatar-large">' +
        escape(post.initials || 'EU') + '</span><h3>' + escape(post.author) + '</h3><p>' +
        (post.anonymous ? 'A identidade desta pessoa está preservada.' : post.example ? 'Perfil fictício para experimentar a comunidade.' : 'Seu perfil nesta demonstração.') +
        '</p></div><h3>Publicações</h3>' + related.map(item => '<div class="social-profile-post"><small>' + escape(item.topic) + '</small><p>' + escape(item.body) + '</p></div>').join('');
      profileDialog.showModal();
    } else if (button.dataset.action === 'report') {
      reportedId = post.id;
      root.querySelector('#socialReportForm').reset();
      reportDialog.showModal();
    }
  });
  feed.addEventListener('submit', event => {
    if (!event.target.matches('.social-comment-form')) return;
    event.preventDefault();
    const id = event.target.closest('[data-post]').dataset.post;
    const body = event.target.elements.comment.value.trim();
    if (!body) return;
    if (commit(next => {
      if (!Array.isArray(next.comments[id])) next.comments[id] = [];
      next.comments[id].push({ author: myName(), body: body.slice(0, 400) });
    })) { render(); announce('Comentário salvo neste navegador.'); }
  });
  root.querySelector('#socialReportForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!reportedId) return;
    if (commit(next => { if (!next.hidden.includes(reportedId)) next.hidden.push(reportedId); })) {
      reportDialog.close();
      render();
      announce('Publicação ocultada neste navegador. Nenhuma denúncia foi enviada.');
    }
  });
  render();
})();
