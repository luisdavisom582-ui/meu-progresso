let communityProfile = readStore('mp_community_profile', {
  display_name: 'Pessoa da comunidade', avatar_emoji: '🌿', theme: 'sage', bio: '', username: '',
  avatar_path: null, banner_path: null, is_public: false, show_in_posts: false, accent_color: '#527a5b'
});
let communityObjectUrl = null;
let communityAvatarObjectUrl = null;
let communityBannerObjectUrl = null;
let communityCroppedFiles = { avatar: null, banner: null };
let removeCommunityAvatar = false;
let removeCommunityBanner = false;
let communityPosts = [];
let communityOwnPostIds = new Set();
let communityReactionCounts = new Map();

const communityMoods = {
  '': 'Prefere não dizer', bem: 'Bem', 'mais-ou-menos': 'Mais ou menos',
  ansioso: 'Ansioso(a)', triste: 'Triste', cansado: 'Cansado(a)'
};
const communityTopics = {
  'dia-a-dia': 'Meu dia a dia', 'pequena-vitoria': 'Pequena vitória',
  'dia-dificil': 'Dia difícil', 'quero-desabafar': 'Quero desabafar', rotina: 'Rotina e autocuidado'
};

function renderFilteredCommunityFeed() {
  const topic = document.getElementById('communityFilterTopic').value;
  const mood = document.getElementById('communityFilterMood').value;
  const posts = communityPosts.filter(post => (!topic || post.topic === topic) && (!mood || post.mood === mood));
  renderCommunityFeed(posts);
}

function reactionButton(postId, reaction, label) {
  const value = communityReactionCounts.get(`${postId}:${reaction}`);
  return `<button type="button" data-react-post="${esc(postId)}" data-reaction="${reaction}" aria-pressed="${!!value?.reacted}">${label} <span>${value?.count || 0}</span></button>`;
}

function renderCommunityProfile() {
  document.getElementById('communityAlias').value = communityProfile.display_name || 'Pessoa da comunidade';
  document.getElementById('communityEmoji').value = communityProfile.avatar_emoji || '🌿';
  document.getElementById('communityTheme').value = communityProfile.theme || 'sage';
  document.getElementById('communityUsername').value = communityProfile.username || '';
  document.getElementById('communityBio').value = communityProfile.bio || '';
  document.getElementById('communityAccent').value = communityProfile.accent_color || '#527a5b';
  document.querySelector('.profile-settings-page')?.style.setProperty('--profile-accent', communityProfile.accent_color || '#527a5b');
  document.getElementById('communityProfilePublic').checked = !!communityProfile.is_public;
  document.getElementById('communityProfilePosts').checked = communityProfile.show_in_posts !== false;
  const consentWrap = document.getElementById('profilePublicationConsentWrap'); if (consentWrap) consentWrap.hidden = !document.getElementById('communityProfilePublic').checked;
  document.getElementById('copyCommunityProfileLink').hidden = !communityProfile.is_public || !communityProfile.username;
  document.querySelector('[data-profile-remove="avatar"]').hidden = !communityProfile.avatar_path;
  document.querySelector('[data-profile-remove="banner"]').hidden = !communityProfile.banner_path;
}

async function loadCommunityProfile() {
  if (!authClient || !currentUser) return;
  const { data, error } = await authClient.from('community_profiles')
    .select('display_name,avatar_emoji,theme,username,bio,avatar_path,banner_path,is_public,show_in_posts,accent_color').eq('user_id', currentUser.id).maybeSingle();
  if (error) {
    document.getElementById('communityProfileStatus').textContent = 'Não consegui carregar sua personalização agora.';
    return;
  }
  if (data) communityProfile = data;
  else {
    communityProfile = { display_name: 'Pessoa da comunidade', avatar_emoji: '🌿', theme: 'sage', username: null, bio: '', avatar_path: null, banner_path: null, is_public: false, show_in_posts: false, accent_color: '#527a5b' };
  }
  window.mpAccountStorage.setItem('mp_community_profile', JSON.stringify(communityProfile));
  renderCommunityProfile();
  await renderOwnProfileMedia();
  const ownBadge = document.getElementById('ownProfileAdminBadge');
  ownBadge.hidden = true;
  ownBadge.removeAttribute('data-rank');
  const { data: badgeData } = await authClient.functions.invoke('admin-dashboard', { body: { action: 'badge' } });
  if (badgeData?.ok && badgeData.adminBadge) {
    ownBadge.textContent = badgeData.adminBadge.label;
    ownBadge.dataset.rank = String(badgeData.adminBadge.number);
    ownBadge.hidden = false;
  }
}

async function renderOwnProfileMedia() {
  const avatar = document.getElementById('communityAvatarPreview');
  const banner = document.getElementById('communityBannerPreview');
  if (communityAvatarObjectUrl) URL.revokeObjectURL(communityAvatarObjectUrl);
  if (communityBannerObjectUrl) URL.revokeObjectURL(communityBannerObjectUrl);
  communityAvatarObjectUrl = communityBannerObjectUrl = null;
  avatar.style.backgroundImage = '';
  avatar.textContent = communityProfile.avatar_emoji || '🌿';
  banner.style.backgroundImage = '';
  banner.textContent = 'Seu banner aparece aqui';
  if (!authClient || !currentUser) return;
  const bucket = authClient.storage.from('community-profile-media');
  if (communityProfile.avatar_path) {
    const { data } = await bucket.createSignedUrl(communityProfile.avatar_path, 3600);
    if (data?.signedUrl) { avatar.style.backgroundImage = `url("${data.signedUrl}")`; avatar.textContent = ''; }
  }
  if (communityProfile.banner_path) {
    const { data } = await bucket.createSignedUrl(communityProfile.banner_path, 3600);
    if (data?.signedUrl) { banner.style.backgroundImage = `url("${data.signedUrl}")`; banner.textContent = ''; }
  }
}

async function normalizeProfileImage(file, kind) {
  const bitmap = await createImageBitmap(file);
  const maxEdge = kind === 'avatar' ? 1200 : 1920;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não consegui preparar esta imagem. Tente outra.')), 'image/webp', 0.86));
}

async function normalizeCommunityPhoto(file) {
  const bitmap = await createImageBitmap(file);
  try {
    const maxEdge = 1920;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não consegui preparar esta imagem. Tente outra.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const normalized = await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não consegui preparar esta imagem. Tente outra.')), 'image/webp', 0.84));
    if (normalized.size > 4 * 1024 * 1024) throw new Error('A foto preparada ainda passa de 4 MB. Escolha uma imagem menor.');
    return normalized;
  } finally {
    bitmap.close();
  }
}

let profileCropBitmap = null;
let profileCropState = null;

function drawProfileCrop() {
  if (!profileCropBitmap || !profileCropState) return;
  const { kind, zoom, centerX, centerY } = profileCropState;
  const ratio = kind === 'avatar' ? 1 : 8 / 3;
  let baseWidth, baseHeight;
  if (profileCropBitmap.width / profileCropBitmap.height > ratio) {
    baseHeight = profileCropBitmap.height; baseWidth = baseHeight * ratio;
  } else {
    baseWidth = profileCropBitmap.width; baseHeight = baseWidth / ratio;
  }
  const width = baseWidth / zoom, height = baseHeight / zoom;
  const x = Math.max(width / 2, Math.min(profileCropBitmap.width - width / 2, centerX));
  const y = Math.max(height / 2, Math.min(profileCropBitmap.height - height / 2, centerY));
  profileCropState.centerX = x; profileCropState.centerY = y;
  const canvas = document.getElementById('profileCropCanvas');
  canvas.width = kind === 'avatar' ? 640 : 1600;
  canvas.height = kind === 'avatar' ? 640 : 600;
  canvas.getContext('2d').drawImage(profileCropBitmap, x - width / 2, y - height / 2, width, height, 0, 0, canvas.width, canvas.height);
}

async function openProfileCrop(file, kind) {
  try {
    profileCropBitmap?.close();
    profileCropBitmap = await createImageBitmap(file);
    profileCropState = { kind, zoom: 1, centerX: profileCropBitmap.width / 2, centerY: profileCropBitmap.height / 2 };
    document.getElementById('profileCropTitle').textContent = kind === 'avatar' ? 'Recorte da foto de perfil' : 'Recorte do banner';
    document.getElementById('profileCropZoom').value = '1';
    drawProfileCrop();
    document.getElementById('profileCropModal').hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('profileCropCanvas').focus();
  } catch (error) {
    document.getElementById(kind === 'avatar' ? 'communityAvatarFile' : 'communityBannerFile').value = '';
    document.getElementById('communityProfileStatus').textContent = 'Não consegui abrir essa imagem. Escolha outra e tente novamente.';
    void renderOwnProfileMedia();
  }
}

function closeProfileCrop() {
  const lastCropKind = profileCropState?.kind;
  document.getElementById('profileCropModal').hidden = true;
  document.body.style.overflow = '';
  profileCropBitmap?.close(); profileCropBitmap = null; profileCropState = null;
  if (lastCropKind) document.getElementById(lastCropKind === 'avatar' ? 'communityAvatarFile' : 'communityBannerFile').focus();
}

function previewProfileFile(input, preview, kind) {
  const file = input.files?.[0];
  if (!file) return;
  const limit = kind === 'avatar' ? 2 * 1024 * 1024 : 4 * 1024 * 1024;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > limit) {
    input.value = '';
    document.getElementById('communityProfileStatus').textContent = `Escolha uma imagem JPG, PNG ou WebP de até ${kind === 'avatar' ? '2' : '4'} MB.`;
    return;
  }
  communityCroppedFiles[kind] = null;
  if (kind === 'avatar' && communityAvatarObjectUrl) { URL.revokeObjectURL(communityAvatarObjectUrl); communityAvatarObjectUrl = null; }
  if (kind === 'banner' && communityBannerObjectUrl) { URL.revokeObjectURL(communityBannerObjectUrl); communityBannerObjectUrl = null; }
  void renderOwnProfileMedia();
  void openProfileCrop(file, kind);
}

document.getElementById('communityAvatarFile').addEventListener('change', event => previewProfileFile(event.target, document.getElementById('communityAvatarPreview'), 'avatar'));
document.getElementById('communityBannerFile').addEventListener('change', event => previewProfileFile(event.target, document.getElementById('communityBannerPreview'), 'banner'));
document.getElementById('communityAccent').addEventListener('input', event => {
  document.querySelector('.profile-settings-page')?.style.setProperty('--profile-accent', event.target.value);
  document.getElementById('communityAvatarPreview').style.backgroundColor = event.target.value;
  document.getElementById('communityBannerPreview').style.backgroundColor = event.target.value;
});
document.getElementById('profileCropZoom').addEventListener('input', event => {
  if (!profileCropState) return;
  profileCropState.zoom = Number(event.target.value); drawProfileCrop();
});
const profileCropCanvas = document.getElementById('profileCropCanvas');
profileCropCanvas.addEventListener('keydown', event => {
  if (!profileCropState || !profileCropBitmap) return;
  const { kind, zoom } = profileCropState;
  const ratio = kind === 'avatar' ? 1 : 8 / 3;
  let baseWidth, baseHeight;
  if (profileCropBitmap.width / profileCropBitmap.height > ratio) { baseHeight = profileCropBitmap.height; baseWidth = baseHeight * ratio; }
  else { baseWidth = profileCropBitmap.width; baseHeight = baseWidth / ratio; }
  const step = Math.max(1, (kind === 'avatar' ? baseWidth : baseHeight) / zoom * 0.04);
  if (event.key === 'ArrowLeft') profileCropState.centerX -= step;
  else if (event.key === 'ArrowRight') profileCropState.centerX += step;
  else if (event.key === 'ArrowUp') profileCropState.centerY -= step;
  else if (event.key === 'ArrowDown') profileCropState.centerY += step;
  else return;
  event.preventDefault(); drawProfileCrop();
});profileCropCanvas.addEventListener('pointerdown', event => {
  if (!profileCropState || !profileCropBitmap) return;
  profileCropCanvas.setPointerCapture(event.pointerId);
  profileCropState.drag = { x: event.clientX, y: event.clientY };
});
profileCropCanvas.addEventListener('pointermove', event => {
  if (!profileCropState?.drag || !profileCropBitmap) return;
  const rect = profileCropCanvas.getBoundingClientRect();
  const { kind, zoom } = profileCropState;
  const ratio = kind === 'avatar' ? 1 : 8 / 3;
  let baseWidth, baseHeight;
  if (profileCropBitmap.width / profileCropBitmap.height > ratio) { baseHeight = profileCropBitmap.height; baseWidth = baseHeight * ratio; }
  else { baseWidth = profileCropBitmap.width; baseHeight = baseWidth / ratio; }
  const cropWidth = baseWidth / zoom, cropHeight = baseHeight / zoom;
  profileCropState.centerX -= (event.clientX - profileCropState.drag.x) * cropWidth / rect.width;
  profileCropState.centerY -= (event.clientY - profileCropState.drag.y) * cropHeight / rect.height;
  profileCropState.drag = { x: event.clientX, y: event.clientY };
  drawProfileCrop();
});
profileCropCanvas.addEventListener('pointerup', event => { if (profileCropState) profileCropState.drag = null; try { profileCropCanvas.releasePointerCapture(event.pointerId); } catch {} });
profileCropCanvas.addEventListener('pointercancel', () => { if (profileCropState) profileCropState.drag = null; });
async function applyProfileCrop() {
  if (!profileCropState) return;
  const kind = profileCropState.kind;
  const canvas = document.getElementById('profileCropCanvas');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) { document.getElementById('communityProfileStatus').textContent = 'Não consegui preparar o recorte. Tente outra imagem.'; return; }
  const input = document.getElementById(kind === 'avatar' ? 'communityAvatarFile' : 'communityBannerFile');
  communityCroppedFiles[kind] = new File([blob], `${input.files?.[0]?.name || kind}.webp`, { type: 'image/webp' });
  if (kind === 'avatar' && communityAvatarObjectUrl) URL.revokeObjectURL(communityAvatarObjectUrl);
  if (kind === 'banner' && communityBannerObjectUrl) URL.revokeObjectURL(communityBannerObjectUrl);
  const preview = document.getElementById(kind === 'avatar' ? 'communityAvatarPreview' : 'communityBannerPreview');
  const url = URL.createObjectURL(blob);
  if (kind === 'avatar') communityAvatarObjectUrl = url; else communityBannerObjectUrl = url;
  preview.style.backgroundImage = `url("${url}")`; preview.textContent = '';
  preview.style.backgroundColor = document.getElementById('communityAccent').value;
  document.querySelector(`[data-profile-remove="${kind}"]`).hidden = false;
  removeCommunityAvatar = kind === 'avatar' ? false : removeCommunityAvatar;
  removeCommunityBanner = kind === 'banner' ? false : removeCommunityBanner;
  closeProfileCrop();
}
document.getElementById('profileCropApply').addEventListener('click', () => void applyProfileCrop());
function cancelProfileCrop() {
  if (!profileCropState) return;
  const kind = profileCropState.kind;
  document.getElementById(kind === 'avatar' ? 'communityAvatarFile' : 'communityBannerFile').value = '';
  closeProfileCrop(); void renderOwnProfileMedia();
}
document.getElementById('profileCropCancel').addEventListener('click', cancelProfileCrop);
document.getElementById('profileCropClose').addEventListener('click', cancelProfileCrop);
document.getElementById('profileCropModal').addEventListener('click', event => { if (event.target.id === 'profileCropModal') cancelProfileCrop(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && profileCropState) cancelProfileCrop(); });
document.querySelectorAll('[data-profile-remove]').forEach(button => button.addEventListener('click', () => {
  const kind = button.dataset.profileRemove;
  if (kind === 'avatar') { removeCommunityAvatar = true; communityCroppedFiles.avatar = null; document.getElementById('communityAvatarFile').value = ''; if (communityAvatarObjectUrl) URL.revokeObjectURL(communityAvatarObjectUrl); communityAvatarObjectUrl = null; }
  else { removeCommunityBanner = true; communityCroppedFiles.banner = null; document.getElementById('communityBannerFile').value = ''; if (communityBannerObjectUrl) URL.revokeObjectURL(communityBannerObjectUrl); communityBannerObjectUrl = null; }
  document.getElementById(kind === 'avatar' ? 'communityAvatarPreview' : 'communityBannerPreview').style.backgroundImage = '';
  document.getElementById(kind === 'avatar' ? 'communityAvatarPreview' : 'communityBannerPreview').textContent = kind === 'avatar' ? (communityProfile.avatar_emoji || '🌿') : 'Seu banner aparece aqui';
  button.hidden = true;
}));

function renderCommunityFeed(posts) {
  const feed = document.getElementById('communityFeed');
  if (!posts.length) {
    feed.innerHTML = '<div class="empty">Ainda não há relatos publicados. Se quiser, você pode compartilhar o seu.</div>';
    return;
  }
  feed.innerHTML = posts.map(post => {
    const when = new Date(post.created_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' });
    const who = post.is_anonymous ? 'Anônimo' : post.profile_username
      ? `<a href="?perfil=${encodeURIComponent(post.profile_username)}">${esc(post.display_name || 'Pessoa da comunidade')}</a>`
      : esc(post.display_name || 'Pessoa da comunidade');
    const mood = communityMoods[post.mood] || '';
    return `<article class="community-post" data-post-id="${esc(post.id)}" data-theme="${esc(post.theme)}">
      <div class="community-post-head"><span class="community-post-avatar">${esc(post.avatar_emoji || '🌿')}</span><div><div class="community-post-name">${who}</div><div class="community-post-meta">${esc(when)}${post.city ? ' · ' + esc(post.city) : ''}</div></div>${post.status === 'pending' ? '<span class="community-pending">Aguardando revisão</span>' : ''}</div>
      <div class="community-post-body">${esc(post.body)}</div>
      <div class="community-post-tags"><span class="community-tag">${esc(communityTopics[post.topic] || communityTopics['dia-a-dia'])}</span>${mood ? `<span class="community-tag">${esc(mood)}</span>` : ''}${post.status === 'pending' ? '<span class="community-tag">Visível só para você até a aprovação</span>' : ''}</div>
      ${post.image_path ? '<div class="community-image-slot" aria-live="polite"></div>' : ''}
      ${post.status === 'published' || communityOwnPostIds.has(post.id) ? `<div class="community-post-actions">${post.status === 'published' ? `${reactionButton(post.id, 'with_you', '💛 Estou com você')}${reactionButton(post.id, 'thanks', '🌿 Obrigado por compartilhar')}${reactionButton(post.id, 'strength', '✨ Você é forte')}<button type="button" data-report-post="${esc(post.id)}">Denunciar</button>` : ''}${communityOwnPostIds.has(post.id) ? `<button type="button" data-delete-post="${esc(post.id)}">Apagar meu relato</button>` : ''}</div>` : ''}
    </article>`;
  }).join('');

  posts.filter(post => post.image_path).forEach(async post => {
    const card = feed.querySelector(`[data-post-id="${CSS.escape(post.id)}"] .community-image-slot`);
    if (!card) return;
    const { data, error } = await authClient.storage.from('community-photos').download(post.image_path);
    if (error || !data) {
      card.textContent = post.status === 'pending' ? 'A foto ficará disponível após a revisão.' : 'Não foi possível carregar esta foto.';
      return;
    }
    const imageUrl = URL.createObjectURL(data);
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = 'Foto compartilhada no relato';
    card.replaceChildren(image);
  });
}

async function loadCommunityFeed() {
  const feed = document.getElementById('communityFeed');
  if (!authClient) {
    feed.innerHTML = '<div class="empty">Os relatos online ainda estão indisponíveis nesta demonstração.</div>';
    return;
  }
  feed.innerHTML = '<div class="empty">Carregando relatos...</div>';
  const { data, error } = await authClient.from('community_posts')
    .select('id,body,topic,city,mood,image_path,display_name,avatar_emoji,theme,is_anonymous,status,created_at,profile_username')
    .in('status', currentUser ? ['published', 'pending'] : ['published'])
    .order('created_at', { ascending: false }).limit(24);
  if (error) {
    feed.innerHTML = '<div class="empty">Não consegui carregar o mural. Confira se as tabelas da comunidade foram configuradas.</div>';
    console.error('Mural da comunidade:', error.message);
    return;
  }
  communityPosts = data || [];
  communityOwnPostIds = new Set();
  communityReactionCounts = new Map();
  if (currentUser) {
    const { data: ownIds } = await authClient.rpc('my_community_post_ids');
    communityOwnPostIds = new Set((ownIds || []).map(row => typeof row === 'string' ? row : row.my_community_post_ids));
  }
  const publishedIds = communityPosts.filter(post => post.status === 'published').map(post => post.id);
  if (publishedIds.length) {
    const { data: counts } = await authClient.rpc('community_reaction_counts', { p_post_ids: publishedIds });
    (counts || []).forEach(row => communityReactionCounts.set(`${row.post_id}:${row.reaction}`, { count: Number(row.reaction_count), reacted: !!row.reacted }));
  }
  renderFilteredCommunityFeed();
}

document.getElementById('communityFilterTopic').addEventListener('change', renderFilteredCommunityFeed);
document.getElementById('communityFilterMood').addEventListener('change', renderFilteredCommunityFeed);

document.getElementById('communityProfilePublic').addEventListener('change', event => { const wrap = document.getElementById('profilePublicationConsentWrap'); wrap.hidden = !event.target.checked; if (!event.target.checked) document.getElementById('profilePublicationConsent').checked = false; });
document.getElementById('communityProfileForm').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.getElementById('communityProfileStatus');
  const username = document.getElementById('communityUsername').value.trim().toLowerCase();
  const publicProfile = document.getElementById('communityProfilePublic').checked;
  if (username && !/^[a-z0-9_]{3,20}$/.test(username)) { status.textContent = 'Use 3 a 20 letras minúsculas, números ou _. '; return; }
  if (publicProfile && !username) { status.textContent = 'Escolha um nome de usuário para publicar e compartilhar sua página.'; return; }
  if (publicProfile && !document.getElementById('profilePublicationConsent').checked) { status.textContent = 'Confirme que seu perfil ficará visível publicamente antes de salvar.'; return; }
  const next = {
    ...communityProfile,
    display_name: document.getElementById('communityAlias').value.trim().slice(0, 32),
    avatar_emoji: document.getElementById('communityEmoji').value,
    theme: document.getElementById('communityTheme').value,
    username: username || null,
    bio: document.getElementById('communityBio').value.trim().slice(0, 240),
    is_public: publicProfile,
    show_in_posts: document.getElementById('communityProfilePosts').checked,
    accent_color: document.getElementById('communityAccent').value
  };
  if (removeCommunityAvatar) next.avatar_path = null;
  if (removeCommunityBanner) next.banner_path = null;
  if (next.display_name.length < 2) {
    status.textContent = 'Escolha um apelido com pelo menos 2 caracteres.';
    return;
  }
  if (!currentUser || !authClient) {
    const localProfile = { ...next, is_public: false, show_in_posts: false, avatar_path: null, banner_path: null };
    try {
      window.mpAccountStorage.setItem('mp_community_profile', JSON.stringify(localProfile));
      communityProfile = localProfile;
      renderCommunityProfile();
      status.textContent = 'Perfil salvo para sua conta neste navegador.';
    } catch {
      status.textContent = 'Não consegui salvar o perfil neste navegador.';
    }
    return;
  }
  const saveButton = event.submitter;
  if (saveButton) saveButton.disabled = true;
  status.textContent = 'Salvando seu perfil…';
  const bucket = authClient.storage.from('community-profile-media');
  const uploaded = [];
  const oldPaths = [communityProfile.avatar_path, communityProfile.banner_path].filter(Boolean);
  try {
    for (const [inputId, field, maxBytes] of [['communityAvatarFile', 'avatar_path', 2 * 1024 * 1024], ['communityBannerFile', 'banner_path', 4 * 1024 * 1024]]) {
      const kind = field === 'avatar_path' ? 'avatar' : 'banner';
      const file = communityCroppedFiles[kind] || document.getElementById(inputId).files?.[0];
      if (!file) continue;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > maxBytes) throw new Error(`Confira o formato e o limite de tamanho da imagem (${maxBytes === 2097152 ? '2' : '4'} MB).`);
      const safeFile = await normalizeProfileImage(file, field === 'avatar_path' ? 'avatar' : 'banner');
      const extension = 'webp';
      const path = `${currentUser.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await bucket.upload(path, safeFile, { contentType: 'image/webp', cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      uploaded.push(path);
      next[field] = path;
    }
    const { data: saved, error } = await authClient.functions.invoke('community-profile-save', { body: next });
    if (error) {
      let message = saved?.error || '';
      try { const details = await error?.context?.clone?.().json(); message = details?.error || message; } catch { /* response body unavailable */ }
      throw new Error(message || 'Não consegui salvar o perfil. Confira sua conexão e tente de novo.');
    }
    if (!saved?.ok) throw new Error(saved?.error || 'Não consegui salvar o perfil.');
    communityProfile = next;
    removeCommunityAvatar = removeCommunityBanner = false;
    window.mpAccountStorage.setItem('mp_community_profile', JSON.stringify(communityProfile));
    for (const path of oldPaths) if (![next.avatar_path, next.banner_path].includes(path)) await bucket.remove([path]);
    document.getElementById('communityAvatarFile').value = '';
    document.getElementById('communityBannerFile').value = '';
    communityCroppedFiles = { avatar: null, banner: null };
    renderCommunityProfile();
    await renderOwnProfileMedia();
    await loadCommunityFeed();
    status.textContent = 'Seu perfil foi salvo.';
  } catch (error) {
    if (uploaded.length) await bucket.remove(uploaded);
    status.textContent = error.message || 'Não consegui salvar o perfil. Tente novamente.';
  } finally { if (saveButton) saveButton.disabled = false; }
});

document.getElementById('copyCommunityProfileLink').addEventListener('click', async () => {
  if (!communityProfile.username || !communityProfile.is_public) return;
  const link = new URL(window.location.pathname, window.location.origin);
  link.searchParams.set('perfil', communityProfile.username);
  try { await navigator.clipboard.writeText(link.href); document.getElementById('communityProfileStatus').textContent = 'Link do perfil copiado.'; }
  catch { document.getElementById('communityProfileStatus').textContent = link.href; }
});

async function loadPublicCommunityProfile(username) {
  const status = document.getElementById('publicProfileStatus');
  status.textContent = 'Carregando página…';
  const { data, error } = await authClient.functions.invoke('community-public-profile', { body: { username } });
  if (error || !data?.ok) {
    document.getElementById('publicProfileName').textContent = 'Perfil indisponível';
    status.textContent = data?.error || 'Não consegui carregar este perfil.';
    return;
  }
  const profile = data.profile;
  const banner = document.getElementById('publicProfileBanner');
  const avatar = document.getElementById('publicProfileAvatar');
  banner.style.backgroundImage = profile.banner_url ? `url("${profile.banner_url}")` : '';
  banner.style.backgroundColor = profile.accent_color || '#527a5b';
  avatar.style.backgroundImage = profile.avatar_url ? `url("${profile.avatar_url}")` : '';
  avatar.style.backgroundColor = profile.accent_color || '#527a5b';
  avatar.textContent = profile.avatar_url ? '' : '🌿';
  const profileCard = document.querySelector('.public-profile-card');
  profileCard.style.setProperty('--profile-accent', profile.accent_color || '#527a5b');
  profileCard.dataset.theme = profile.theme || 'sage';
  document.getElementById('publicProfileName').textContent = profile.display_name || profile.username;
  document.getElementById('publicProfileHandle').textContent = `@${profile.username}`;
  const adminBadge = document.getElementById('publicProfileAdminBadge');
  adminBadge.hidden = !profile.admin_badge;
  if (profile.admin_badge) {
    adminBadge.textContent = profile.admin_badge.label;
    adminBadge.dataset.rank = String(profile.admin_badge.number);
  } else adminBadge.removeAttribute('data-rank');
  document.getElementById('publicProfileBio').textContent = profile.bio || '';
  status.textContent = '';
}

document.getElementById('returnCommunity').addEventListener('click', () => { history.replaceState(null, '', window.location.pathname); showPage('community'); });

const requestedPublicProfile = new URLSearchParams(window.location.search).get('perfil');
if (requestedPublicProfile) {
  showPage('profile');
  void loadPublicCommunityProfile(requestedPublicProfile);
}

document.getElementById('communityPhoto').addEventListener('change', event => {
  const file = event.target.files?.[0];
  const preview = document.getElementById('communityPhotoPreview');
  const photoConsent = document.getElementById('communityPhotoConsent');
  const photoConsentWrap = document.getElementById('communityPhotoConsentWrap');
  if (communityObjectUrl) URL.revokeObjectURL(communityObjectUrl);
  communityObjectUrl = null;
  preview.replaceChildren();
  preview.hidden = true;
  photoConsent.checked = false;
  photoConsent.required = !!file;
  photoConsentWrap.hidden = !file;
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
    event.target.value = '';
    photoConsent.checked = false; photoConsent.required = false; photoConsentWrap.hidden = true;
    document.getElementById('communityStatus').textContent = 'Escolha uma foto JPG, PNG ou WebP de até 4 MB.';
    return;
  }
  communityObjectUrl = URL.createObjectURL(file);
  const image = document.createElement('img'); image.src = communityObjectUrl; image.alt = 'Prévia da foto';
  const cancel = document.createElement('button');
  cancel.type = 'button'; cancel.className = 'community-photo-cancel'; cancel.textContent = '×';
  cancel.setAttribute('aria-label', 'Cancelar envio da foto');
  cancel.title = 'Remover foto';
  cancel.addEventListener('click', () => {
    event.target.value = '';
    if (communityObjectUrl) URL.revokeObjectURL(communityObjectUrl);
    communityObjectUrl = null;
    preview.replaceChildren();
    preview.hidden = true;
    photoConsent.checked = false; photoConsent.required = false; photoConsentWrap.hidden = true;
    document.getElementById('communityStatus').textContent = 'Foto removida. Ela não será enviada.';
  });
  preview.replaceChildren(image, cancel); preview.hidden = false;
});

document.getElementById('communityForm').addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.getElementById('communityStatus');
  if (!currentUser || !authClient) {
    status.textContent = 'Entre ou crie uma conta para enviar um relato.';
    return;
  }
  if (!document.getElementById('communityConsent').checked) {
    status.textContent = 'Marque a autorização antes de enviar.';
    return;
  }
  const body = document.getElementById('communityBody').value.trim();
  if (!body) return;
  const file = document.getElementById('communityPhoto').files?.[0];
  const submit = document.getElementById('communitySubmit');
  submit.disabled = true;
  status.textContent = 'Verificando o texto e a foto antes do envio...';
  try {
    let photoBase64 = null;
    let normalizedPhoto = null;
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
        throw new Error('A foto precisa ser JPG, PNG ou WebP e ter até 4 MB.');
      }
      normalizedPhoto = await normalizeCommunityPhoto(file);
      photoBase64 = (await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(new Error('Não consegui ler a foto. Tente escolher o arquivo novamente.'));
        reader.readAsDataURL(normalizedPhoto);
      }));
    }
    const anonymous = document.getElementById('communityAnonymous').checked;
    const { data, error } = await authClient.functions.invoke('community-submit', {
      body: {
        body, topic: document.getElementById('communityTopic').value,
        city: document.getElementById('communityCity').value.trim(), mood: document.getElementById('communityMood').value,
        is_anonymous: anonymous, display_name: communityProfile.display_name,
        avatar_emoji: communityProfile.avatar_emoji, theme: communityProfile.theme,
        photo_base64: photoBase64, photo_type: normalizedPhoto ? 'image/webp' : null,
        photo_no_minors_confirmed: !file || document.getElementById('communityPhotoConsent').checked
      }
    });
    if (error) throw error;
    if (data?.blocked) {
      status.textContent = data.error || 'O texto ou a foto pode não ser adequado. Revise o conteúdo ou remova a foto.';
      return;
    }
    if (!data?.ok) throw new Error(data?.error || 'Não consegui enviar agora.');
    event.target.reset();
    document.getElementById('communityAnonymous').checked = true;
    document.getElementById('communityPhotoPreview').hidden = true;
    document.getElementById('communityPhotoConsent').required = false;
    document.getElementById('communityPhotoConsent').checked = false;
    document.getElementById('communityPhotoConsentWrap').hidden = true;
    if (communityObjectUrl) URL.revokeObjectURL(communityObjectUrl);
    communityObjectUrl = null;
    status.textContent = 'Texto e foto passaram pela verificação automática. O relato está aguardando revisão humana.';
    await loadCommunityFeed();
  } catch (error) {
    status.textContent = error.context?.status === 429
      ? 'Você chegou ao limite de 3 tentativas de envio por dia. O limite inclui relatos bloqueados pela análise automática. Tente novamente amanhã.'
      : error.context?.status === 403
        ? 'Confirme seu e-mail para enviar relatos.'
        : error.context?.status === 503
      ? 'A verificação automática ainda não está pronta ou não respondeu. O relato não foi enviado. Confira a configuração.'
      : (error.message || 'Não consegui enviar agora. Confira sua conexão e tente novamente.');
    console.error('Envio para o mural:', error);
  } finally {
    submit.disabled = false;
  }
});

document.getElementById('communityRefresh').addEventListener('click', loadCommunityFeed);
document.getElementById('communityFeed').addEventListener('click', async event => {
  const report = event.target.closest('[data-report-post]');
  const react = event.target.closest('[data-react-post]');
  const deleteButton = event.target.closest('[data-delete-post]');
  if (!report && !react && !deleteButton) return;
  if (!currentUser || !authClient) {
    document.getElementById('communityStatus').textContent = 'Use os botões do mural atual para interagir.';
    return;
  }
  const button = report || react || deleteButton;
  button.disabled = true;
  if (react) {
    const { error } = await authClient.rpc('toggle_community_reaction', { p_post_id: react.dataset.reactPost, p_reaction: react.dataset.reaction });
    if (error) { react.disabled = false; react.title = 'Não consegui salvar a reação. Tente novamente.'; return; }
    await loadCommunityFeed();
    return;
  }
  if (deleteButton) {
    const post = communityPosts.find(item => item.id === deleteButton.dataset.deletePost);
    if (!post || !communityOwnPostIds.has(post.id)) { deleteButton.disabled = false; return; }
    if (!await confirmAction('Este relato e a foto anexada serão apagados permanentemente.', 'Apagar meu relato?')) { deleteButton.disabled = false; return; }
    if (post.image_path) {
      const { error: photoError } = await authClient.storage.from('community-photos').remove([post.image_path]);
      if (photoError) { deleteButton.disabled = false; deleteButton.title = 'Não consegui apagar a foto. Tente novamente.'; return; }
    }
    const { error } = await authClient.from('community_posts').delete().eq('id', post.id);
    if (error) { deleteButton.disabled = false; deleteButton.title = 'Não consegui apagar. Tente novamente.'; return; }
    await loadCommunityFeed();
    return;
  }
  const { error } = await authClient.from('community_reports').insert({ post_id: report.dataset.reportPost, reason: 'Conteúdo inadequado' });
  report.textContent = error?.code === '23505' ? 'Já foi denunciada' : error ? 'Tente novamente' : 'Denúncia enviada';
});

if (authClient) authClient.auth.onAuthStateChange(() => {
  if (currentUser) void loadCommunityProfile();
  if (activePage === 'community') void loadCommunityFeed();
});

function resetCommunityProfileForSignedOut() {
  communityProfile = { display_name: 'Pessoa da comunidade', avatar_emoji: '🌿', theme: 'sage', username: '', bio: '', avatar_path: null, banner_path: null, is_public: false, show_in_posts: false, accent_color: '#527a5b' };
  document.getElementById('communityAvatarFile').value = '';
  document.getElementById('communityBannerFile').value = '';
  communityCroppedFiles = { avatar: null, banner: null };
  removeCommunityAvatar = removeCommunityBanner = false;
  window.mpAccountStorage.setItem('mp_community_profile', JSON.stringify(communityProfile));
  renderCommunityProfile();
  const ownBadge = document.getElementById('ownProfileAdminBadge');
  ownBadge.hidden = true; ownBadge.removeAttribute('data-rank');
  void renderOwnProfileMedia();
}
