(() => {
  const page = document.querySelector('.community-page');
  const legacy = document.createElement('div');
  legacy.hidden = true;
  legacy.className = 'community-legacy';
  while (page.firstChild) legacy.append(page.firstChild);
  page.append(legacy);
  const root = document.createElement('div');
  root.className = 'social-community';
  root.innerHTML = `<header class="social-header"><h2>Comunidade</h2>
    <button class="add-btn" type="button" id="liveCompose">Escrever relato</button></header>
    <p class="social-demo-note">Relatos em texto aparecem no mural após a análise automática. Use o modo anônimo se preferir e evite incluir dados pessoais.</p>
    <div class="social-dialog-actions">
      <button class="select-small" id="liveReload" type="button">Atualizar mural</button>
      <button class="select-small" id="liveReview" type="button" hidden>Revisar relatos</button>
    </div>
    <p class="social-status" id="liveStatus" role="status"></p>
    <section id="livePosts" class="social-community" aria-label="Relatos publicados"></section>
    <section id="liveQueue" class="social-community" aria-label="Fila de revisão" hidden></section>
    <dialog class="social-dialog" id="liveDialog" aria-labelledby="liveTitle">
      <form id="liveForm">
        <h2 id="liveTitle">Escreva seu relato</h2>
        <label>Relato<textarea name="body" rows="5" maxlength="1200" required></textarea></label>
        <label>Tema<select name="topic"><option value="dia-a-dia">Meu dia</option><option value="pequena-vitoria">Pequena vitória</option><option value="rotina">Rotina</option><option value="dia-dificil">Dia difícil</option><option value="quero-desabafar">Desabafo</option></select></label>
        <label><span><input type="checkbox" name="anonymous" checked> Publicar anonimamente</span></label>
        <label><span><input type="checkbox" name="consent" required> Concordo com o envio do texto à OpenAI para análise automática e com a publicação no mural se o texto for aceito.</span></label>
        <p id="liveError" class="social-error" role="status"></p>
        <div class="social-dialog-actions"><button type="button" class="select-small" id="liveCancel">Cancelar</button><button type="submit" class="add-btn">Publicar relato</button></div>
      </form>
    </dialog>`;
  page.append(root);
  const get = id => document.getElementById(id);
  const status = get('liveStatus');
  const posts = get('livePosts');
  const queue = get('liveQueue');
  const dialog = get('liveDialog');
  const form = get('liveForm');
  const request = window.mpCommunityRequest;
  const review = (action, extra = {}) => request('/functions/v1/community-review', {
    method: 'POST', body: JSON.stringify({ action, ...extra })
  });
  const button = (label, action) => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'select-small';
    node.textContent = label;
    node.addEventListener('click', async () => {
      node.disabled = true;
      try { await action(); } catch (error) { status.textContent = error.message; }
      finally { node.disabled = false; }
    });
    return node;
  };
  function card(post) {
    const article = document.createElement('article');
    article.className = 'panel social-post';
    const name = document.createElement('strong');
    name.textContent = post.is_anonymous ? 'Pessoa anônima' : (post.display_name || 'Pessoa da comunidade');
    const date = document.createElement('p');
    date.className = 'social-topic';
    date.textContent = post.created_at ? new Date(post.created_at).toLocaleDateString('pt-BR') : '';
    const body = document.createElement('p');
    body.className = 'social-body';
    body.textContent = post.body;
    article.append(name, date, body);
    return article;
  }
  function empty(message) {
    const node = document.createElement('p');
    node.className = 'panel social-empty';
    node.textContent = message;
    return node;
  }
  async function loadPosts() {
    const rows = await request('/rest/v1/community_posts?select=id,body,display_name,is_anonymous,created_at&status=eq.published&order=created_at.desc&limit=50');
    const ownIds = new Set();
    if (rows.length) {
      try {
        const ids = await request('/rest/v1/rpc/my_community_post_ids', { method: 'POST', body: '{}' });
        for (const row of ids || []) ownIds.add(typeof row === 'string' ? row : row.my_community_post_ids);
      } catch { status.textContent = 'Não consegui verificar quais relatos são seus.'; }
    }
    posts.replaceChildren(...(rows.length ? rows.map(post => {
      const article = card(post);
      if (ownIds.has(post.id)) {
        article.append(button('Excluir meu relato', async () => {
          if (!window.confirm('Excluir este relato? Ele sairá do mural para todos.')) return;
          const resource = '/rest/v1/community_posts?id=eq.' + encodeURIComponent(post.id);
          await request(resource, { method: 'DELETE' });
          const remaining = await request(resource + '&select=id');
          if (remaining.length) throw new Error('Não foi possível excluir o relato.');
          article.remove();
          if (!posts.childElementCount) posts.append(empty('Ainda não há relatos publicados. Que tal escrever o primeiro?'));
          status.textContent = 'Seu relato foi excluído do mural.';
        }));
      } else article.append(button('Denunciar', async () => {
        if (!window.confirm('Enviar este relato para revisão da equipe?')) return;
        await request('/rest/v1/community_reports', {
          method: 'POST', body: JSON.stringify({post_id:post.id,reporter_id:window.mpCommunityUserId,reason:'Conteúdo inadequado'})
        });
        status.textContent = 'Denúncia enviada para revisão.';
      }));
      return article;
    }) : [empty('Ainda não há relatos publicados. Que tal escrever o primeiro?')]));
  }
  function showQueue(rows) {
    queue.hidden = false;
    queue.replaceChildren(...(rows.length ? rows.map(post => {
      const article = card(post);
      for (const [label, action] of [['Aprovar', 'published'], ['Recusar', 'removed']]) {
        article.append(button(label, async () => {
          await review(action, { post_id: post.id });
          await loadPosts();
          await loadQueue();
          status.textContent = action === 'published' ? 'Relato aprovado e publicado.' : 'Relato recusado.';
        }));
      }
      return article;
    }) : [empty('Nenhum relato aguardando revisão.')]));
  }
  async function loadQueue() {
    const [pending, reported] = await Promise.all([review('list'), review('list_reports')]);
    showQueue(pending.posts || []);
    const heading = document.createElement('h3');
    heading.textContent = 'Denúncias';
    queue.append(heading);
    if (!reported.reports?.length) queue.append(empty('Nenhuma denúncia aberta.'));
    for (const report of reported.reports || []) {
      const article = card(report.post || { body: 'Relato indisponível.' });
      const reason = document.createElement('p');
      reason.textContent = report.reason;
      article.append(reason);
      if (report.post && report.post.status === 'published') {
        article.append(button('Remover relato', async () => {
          if (!window.confirm('Remover este relato do mural compartilhado?')) return;
          await review('remove_reported_post', { post_id: report.post_id });
          await loadPosts();
          await loadQueue();
        }));
      }
      article.append(button('Concluir denúncia', async () => {
        await review('resolve_report', { report_id: report.id });
        await loadQueue();
      }));
      queue.append(article);
    }
  }
  get('liveCompose').addEventListener('click', () => {
    get('liveError').textContent = '';
    dialog.showModal();
  });
  get('liveCancel').addEventListener('click', () => dialog.close());
  get('liveReload').addEventListener('click', () => refresh());
  get('liveReview').addEventListener('click', async () => {
    try { await loadQueue(); }
    catch (error) { status.textContent = error.message; }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = event.submitter;
    const error = get('liveError');
    const body = form.elements.body.value.trim();
    const displayName = (window.mpAccountName || '').trim().slice(0, 32);
    if (!body) { error.textContent = 'Escreva um relato antes de enviar.'; return; }
    submit.disabled = true;
    error.textContent = 'Publicando…';
    try {
      const result = await request('/functions/v1/community-submit', {
        method: 'POST',
        body: JSON.stringify({
          body, topic: form.elements.topic.value, is_anonymous: form.elements.anonymous.checked,
          display_name: displayName.length >= 2 ? displayName : 'Pessoa da comunidade',
          theme: 'sage', avatar_emoji: '🌿'
        })
      });
      if (!result?.ok) throw new Error(result?.error || 'Não foi possível enviar o relato.');
      form.reset();
      dialog.close();
      if (result.published) {
        status.textContent = 'Relato publicado no mural.';
        try { await loadPosts(); }
        catch { status.textContent = 'Relato publicado. Toque em Atualizar mural para vê-lo.'; }
      } else {
        status.textContent = 'Relato enviado para revisão.';
      }
    } catch (e) { error.textContent = e.message; }
    finally { submit.disabled = false; }
  });
  let loading = false;
  async function refresh() {
    if (loading) return;
    loading = true;
    status.textContent = 'Carregando mural…';
    try { await loadPosts(); status.textContent = ''; }
    catch (error) { status.textContent = error.message; }
    finally { loading = false; }
  }
  document.addEventListener('mp:page', event => {
    if (event.detail !== 'community') return;
    void refresh();
    void review('list').then(() => { get('liveReview').hidden = false; }).catch(() => {});
  });
  if (activePage === 'community') void refresh();
})();
