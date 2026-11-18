const reviewPanel = document.getElementById('communityReview');
const reviewFeed = document.getElementById('communityReviewFeed');
const reportsFeed = document.getElementById('communityReportsFeed');
const reviewStatus = document.getElementById('communityReviewStatus');

function ensureAdminDashboard() {
  let panel = document.getElementById('siteAdminDashboard');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'siteAdminDashboard';
  panel.className = 'community-card';
  panel.innerHTML = '<h3 class="panel-title">Painel administrativo</h3><p class="panel-sub">Indicadores gerais do site. Visitas são sessões aproximadas; uma pessoa pode gerar mais de uma.</p><div class="community-form-row"><div class="community-card"><strong id="siteVisitCount">—</strong><div class="community-review-meta">visitas aproximadas</div></div><div class="community-card"><strong id="siteRegistrationCount">—</strong><div class="community-review-meta">contas cadastradas</div></div></div><div class="community-status" id="siteAdminStatus" aria-live="polite"></div><div id="ownerAdminTools" hidden><h4>Administradores autorizados</h4><p class="panel-sub">Somente a conta responsável pode conceder ou retirar esse acesso. A pessoa precisa ter conta confirmada primeiro.</p><form id="addSiteAdminForm" class="community-form"><label>E-mail da conta<input type="email" id="newSiteAdminEmail" autocomplete="email" required></label><button class="select-small" type="submit">Autorizar como administrador</button></form><div id="siteAdminList" class="community-review-feed"></div><h4>Analistas e Suporte</h4><p class="panel-sub">Analistas podem revisar relatos e denúncias. Suporte recebe apenas orientações para ajudar na recuperação segura de contas.</p><form id="addStaffForm" class="community-form"><label>E-mail da conta<input type="email" id="newStaffEmail" autocomplete="email" required></label><label>Função<select id="newStaffRole"><option value="analyst">Analista</option><option value="support">Suporte</option></select></label><button class="select-small" type="submit">Adicionar à equipe</button></form><div id="staffList" class="community-review-feed"></div></div>';
  document.getElementById('staffAdminOverview').append(panel);
  return panel;
}

async function loadAdminDashboard() {
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'stats' } });
  if (error || !data?.ok) return;
  ensureAdminDashboard();
  document.getElementById('siteVisitCount').textContent = Number(data.visits).toLocaleString('pt-BR');
  document.getElementById('siteRegistrationCount').textContent = Number(data.registrations).toLocaleString('pt-BR');
  const tools = document.getElementById('ownerAdminTools');
  tools.hidden = data.role !== 'owner';
  if (data.role === 'owner') await loadSiteAdmins();
}

async function loadStaffMembers() {
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'list_staff' } });
  const list = document.getElementById('staffList');
  if (error || !data?.ok) { list.innerHTML = `<div class="empty">${esc(data?.error || 'Não consegui carregar a equipe.')}</div>`; return; }
  list.innerHTML = (data.staff || []).map(member => `<div class="community-review-card"><strong>${esc(member.email)}</strong><div class="community-review-meta">${member.role === 'analyst' ? 'Analista' : 'Suporte'}</div><button class="community-review-remove" type="button" data-remove-staff="${esc(member.user_id)}">Retirar da equipe</button></div>`).join('') || '<div class="empty">Nenhum analista ou suporte cadastrado.</div>';
}

async function loadStaffConsole() {
  const nav = document.getElementById('staffNav');
  const mobileNav = document.getElementById('staffNavMobile');
  const status = document.getElementById('staffAccessStatus');
  if (!authClient || !currentUser) { if (nav) nav.hidden = true; if (mobileNav) mobileNav.hidden = true; showPage('dashboard'); toast('Entre na sua conta para verificar o acesso da equipe.'); return; }
  status.textContent = 'Verificando sua função…';
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'access' } });
  if (error || !data?.ok) { if (nav) nav.hidden = true; if (mobileNav) mobileNav.hidden = true; showPage('dashboard'); toast(data?.error || 'Esta área é restrita à equipe autorizada.'); return; }
  const role = data.role;
  if (nav) nav.hidden = false; if (mobileNav) mobileNav.hidden = false;
  const allowed = role === 'owner' || role === 'admin' ? ['overview','review','support'] : role === 'analyst' ? ['overview','review'] : ['support'];
  document.querySelectorAll('[data-staff-view-button]').forEach(button => { button.hidden = !allowed.includes(button.dataset.staffViewButton); });
  if (allowed.includes('overview')) ensureAdminDashboard();
  const ownerTools = document.getElementById('ownerAdminTools');
  if (ownerTools) ownerTools.hidden = role !== 'owner';
  document.querySelector('[data-staff-view-button="team"]').hidden = role !== 'owner';
  document.getElementById('staffTeamView').innerHTML = role === 'owner' ? '<div class="panel community-card"><h3 class="panel-title">Equipe cadastrada</h3><p class="panel-sub">A inclusão e retirada de funções é feita na aba Painel.</p><div id="staffTeamListMirror" class="community-review-feed"></div></div>' : '';
  const defaultView = allowed.includes('overview') ? 'overview' : 'support';
  setStaffView(defaultView);
  status.textContent = role === 'owner' ? 'Conta responsável' : role === 'admin' ? 'Administrador' : role === 'analyst' ? 'Analista' : 'Suporte';
  if (allowed.includes('overview')) await loadAdminDashboard();
  if (allowed.includes('review')) await loadCommunityReview();
  if (role === 'owner') { await loadSiteAdmins(); await loadStaffMembers(); document.getElementById('staffTeamListMirror').innerHTML = document.getElementById('staffList').innerHTML; }
}

function setStaffView(view) {
  document.querySelectorAll('[data-staff-view]').forEach(section => { section.hidden = section.dataset.staffView !== view; });
  document.querySelectorAll('[data-staff-view-button]').forEach(button => button.classList.toggle('active', button.dataset.staffViewButton === view));
}

document.addEventListener('click', event => { const button = event.target.closest('[data-staff-view-button]'); if (button && !button.hidden) setStaffView(button.dataset.staffViewButton); });

async function loadSiteAdmins() {
  const status = document.getElementById('siteAdminStatus');
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'list_admins' } });
  if (error || !data?.ok) { status.textContent = data?.error || 'Não consegui carregar os administradores.'; return; }
  document.getElementById('siteAdminList').innerHTML = (data.admins || []).map(admin => `<div class="community-review-card"><strong>${esc(admin.email)}</strong><div class="community-review-meta">${admin.role === 'owner' ? 'Responsável principal' : 'Administrador autorizado'}</div>${Number(admin.badge_number) >= 1 && Number(admin.badge_number) <= 3 ? `<span class="admin-profile-badge" data-rank="${Number(admin.badge_number)}">Conta ADM ${Number(admin.badge_number)}</span>` : ''}${admin.role === 'admin' ? `<button class="community-review-remove" type="button" data-remove-admin="${esc(admin.user_id)}">Retirar acesso</button>` : ''}</div>`).join('') || '<div class="empty">Nenhum administrador autorizado.</div>';
}

document.addEventListener('submit', async event => {
  if (event.target.id === 'addStaffForm') {
    event.preventDefault();
    const email = document.getElementById('newStaffEmail').value.trim();
    const role = document.getElementById('newStaffRole').value;
    const status = document.getElementById('siteAdminStatus'); status.textContent = 'Adicionando à equipe…';
    const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'add_staff', email, role } });
    status.textContent = error || !data?.ok ? data?.error || 'Não consegui adicionar a conta.' : 'Conta adicionada à equipe.';
    if (data?.ok) { event.target.reset(); await loadStaffMembers(); }
    return;
  }
  if (event.target.id !== 'addSiteAdminForm') return;
  event.preventDefault();
  const status = document.getElementById('siteAdminStatus');
  const email = document.getElementById('newSiteAdminEmail').value.trim();
  status.textContent = 'Concedendo acesso…';
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'add_admin', email } });
  status.textContent = error || !data?.ok ? data?.error || 'Não consegui autorizar a conta.' : 'Conta autorizada como administradora.';
  if (data?.ok) { event.target.reset(); await loadSiteAdmins(); }
});

document.addEventListener('click', async event => {
  const staffButton = event.target.closest('[data-remove-staff]');
  if (staffButton && authClient) {
    if (!await confirmAction('A conta perderá o acesso de analista ou suporte.', 'Retirar da equipe?', 'Retirar acesso')) return;
    staffButton.disabled = true;
    const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'remove_staff', user_id: staffButton.dataset.removeStaff } });
    document.getElementById('siteAdminStatus').textContent = error || !data?.ok ? data?.error || 'Não consegui retirar o acesso.' : 'Acesso retirado.';
    if (data?.ok) await loadStaffMembers(); else staffButton.disabled = false;
    return;
  }
  const button = event.target.closest('[data-remove-admin]');
  if (!button || !authClient) return;
  if (!await confirmAction('Essa conta perderá acesso à revisão e ao painel administrativo.', 'Retirar acesso de administrador?', 'Retirar acesso')) return;
  button.disabled = true;
  const { data, error } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'remove_admin', user_id: button.dataset.removeAdmin } });
  document.getElementById('siteAdminStatus').textContent = error || !data?.ok ? data?.error || 'Não consegui retirar o acesso.' : 'Acesso de administrador retirado.';
  if (data?.ok) await loadSiteAdmins(); else button.disabled = false;
});

function renderCommunityReview(posts) {
  if (!posts.length) {
    reviewFeed.innerHTML = '<div class="empty">Nenhum relato aguardando revisão.</div>';
    return;
  }
  reviewFeed.innerHTML = posts.map(post => `<article class="community-review-card" data-review-id="${esc(post.id)}">
    <div class="community-review-meta">${esc(new Date(post.created_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }))} · ${esc(post.topic || 'Relato')} · ${esc(post.mood || 'Sem sentimento informado')}${post.city ? ' · ' + esc(post.city) : ''}</div>
    <div class="community-post-body">${esc(post.body)}</div>
    ${post.image_url ? `<img src="${esc(post.image_url)}" alt="Foto anexada ao relato">` : '<div class="community-review-meta">Este relato não tem foto.</div>'}
    <div class="community-review-actions"><button class="community-review-approve" type="button" data-review-action="published">Aprovar e publicar</button><button class="community-review-remove" type="button" data-review-action="removed">Remover relato</button></div>
  </article>`).join('');
}

function renderCommunityReports(reports) {
  if (!reports.length) {
    reportsFeed.innerHTML = '<div class="empty">Nenhuma denúncia aguardando análise.</div>';
    return;
  }
  reportsFeed.innerHTML = reports.map(report => `<article class="community-review-card" data-report-id="${esc(report.id)}" data-post-id="${esc(report.post?.id || '')}">
    <div class="community-review-meta">Denunciado em ${esc(new Date(report.created_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }))} · Motivo: ${esc(report.reason)}</div>
    ${report.post ? `<div class="community-review-meta">${esc(report.post.status === 'published' ? 'Publicado' : 'Status: ' + report.post.status)} · ${esc(report.post.topic || 'Relato')}${report.post.city ? ' · ' + esc(report.post.city) : ''}</div><div class="community-post-body">${esc(report.post.body)}</div>${report.post.image_url ? `<img src="${esc(report.post.image_url)}" alt="Foto do relato denunciado">` : ''}` : '<div class="empty">O relato associado não está mais disponível.</div>'}
    <div class="community-review-actions">${report.post && report.post.status !== 'removed' ? '<button class="community-review-remove" type="button" data-report-action="remove_reported_post">Remover relato do mural</button>' : ''}<button class="select-small" type="button" data-report-action="resolve_report">Marcar denúncia como revisada</button></div>
  </article>`).join('');
}

async function loadCommunityReview() {
  if (!reviewPanel || !authClient || !currentUser) { if (reviewPanel) reviewPanel.hidden = true; return; }
  reviewStatus.textContent = 'Verificando acesso à revisão…';
  const { data, error } = await authClient.functions.invoke('community-review', { body: { action: 'list' } });
  if (error || !data?.ok) {
    reviewPanel.hidden = true;
    if (data?.not_moderator) return;
    console.error('Fila de revisão:', error || data?.error);
    return;
  }
  reviewPanel.hidden = false;
  renderCommunityReview(data.posts || []);
  const { data: reportData, error: reportError } = await authClient.functions.invoke('community-review', { body: { action: 'list_reports' } });
  if (reportError || !reportData?.ok) {
    reportsFeed.innerHTML = '<div class="empty">Não consegui carregar as denúncias. Tente atualizar a fila.</div>';
    reviewStatus.textContent = `${(data.posts || []).length} relato(s) aguardando revisão. A fila de denúncias não carregou.`;
    return;
  }
  renderCommunityReports(reportData.reports || []);
  reviewStatus.textContent = `${(data.posts || []).length} relato(s) e ${(reportData.reports || []).length} denúncia(s) aguardando revisão. Textos e fotos são visíveis somente para a conta de moderação.`;
}

document.getElementById('communityReviewRefresh')?.addEventListener('click', () => void loadCommunityReview());
reviewPanel?.addEventListener('click', async event => {
  const button = event.target.closest('[data-review-action], [data-report-action]');
  if (!button || !currentUser || !authClient) return;
  const postCard = button.closest('[data-review-id]');
  const reportCard = button.closest('[data-report-id]');
  const action = button.dataset.reviewAction || button.dataset.reportAction;
  if (action === 'published' && !await confirmAction('Este relato ficará visível para as pessoas no mural. Confira o texto e a foto antes de decidir.', 'Aprovar e publicar?', 'Aprovar e publicar')) return;
  if (action === 'removed' && !await confirmAction('Este relato será removido da fila e não aparecerá no mural.', 'Remover relato?', 'Remover relato')) return;
  if (action === 'resolve_report' && !await confirmAction('A denúncia será retirada da fila após sua análise.', 'Marcar como revisada?', 'Marcar como revisada')) return;
  if (action === 'remove_reported_post' && !await confirmAction('Este relato deixará de aparecer no mural. Você ainda poderá concluir a denúncia depois.', 'Remover relato denunciado?', 'Remover relato')) return;
  button.disabled = true;
  reviewStatus.textContent = 'Salvando decisão…';
  const body = action === 'resolve_report' ? { action, report_id: reportCard?.dataset.reportId } : action === 'remove_reported_post' ? { action, post_id: reportCard?.dataset.postId } : { action, post_id: postCard?.dataset.reviewId };
  const { data, error } = await authClient.functions.invoke('community-review', { body });
  if (error || !data?.ok) {
    button.disabled = false;
    reviewStatus.textContent = data?.error || 'Não consegui salvar. Tente novamente.';
    return;
  }
  reviewStatus.textContent = action === 'published' ? 'Relato publicado.' : action === 'removed' ? 'Relato removido da fila.' : action === 'remove_reported_post' ? 'Relato denunciado removido do mural.' : 'Denúncia marcada como revisada.';
  await Promise.all([loadCommunityReview(), loadCommunityFeed()]);
});

async function updateStaffNavigation() {
  if (!authClient || !currentUser) return;
  const { data } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'access' } });
  const allowed = data?.ok && ['owner','admin','analyst','support'].includes(data.role);
  ['staffNav','staffNavMobile'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = !allowed; });
}
if (authClient) authClient.auth.onAuthStateChange(() => setTimeout(() => { void updateStaffNavigation(); if (activePage === 'staff') void loadStaffConsole(); }, 0));
if (currentUser) void updateStaffNavigation();
