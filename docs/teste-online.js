const endpoint = "https://aydwfcmxegcucmmspvib.supabase.co";
const publishableKey = "sb_publishable_PxgmhZDEQLjUsLQT6Bw6Ww_hDGeYgJh";
const login = document.querySelector('#login');
const panel = document.querySelector('#records');
const notice = document.querySelector('#status');
const list = document.querySelector('#list');
let session;

async function request(path, options = {}, authenticated = true) {
  const headers = { apikey: publishableKey, 'Content-Type': 'application/json' };
  if (authenticated) headers.Authorization = 'Bearer ' + session.access_token;
  const response = await fetch(endpoint + path, { ...options, headers, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 401 ? 'A sessão expirou ou os dados de acesso estão incorretos.' : 'O Supabase retornou um erro (' + response.status + ').');
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
function showSession() {
  login.hidden = Boolean(session);
  panel.hidden = !session;
  if (!session) list.replaceChildren();
}
async function refresh() {
  const rows = await request('/rest/v1/online_test_records?select=id,created_at&order=created_at.desc&limit=30');
  list.replaceChildren(...rows.map(row => {
    const item = document.createElement('li');
    item.textContent = 'Registro fictício · ' + new Date(row.created_at).toLocaleString('pt-BR') + ' ';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Apagar';
    remove.addEventListener('click', () => run(remove, async () => {
      await request('/rest/v1/online_test_records?id=eq.' + encodeURIComponent(row.id), { method: 'DELETE' });
      await refresh();
    }));
    item.append(remove);
    return item;
  }));
  notice.textContent = rows.length ? 'Registros carregados do banco.' : 'Você ainda não tem registros de teste.';
}
async function run(button, action) {
  button.disabled = true;
  try { await action(); }
  catch (error) { notice.textContent = error.message; }
  finally { button.disabled = false; }
}
login.addEventListener('submit', event => {
  event.preventDefault();
  run(event.submitter, async () => {
    const email = login.elements.email.value.trim();
    const password = login.elements.password.value;
    try {
      session = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
    } finally { login.elements.password.value = ''; }
    showSession();
    await refresh();
  });
});
document.querySelector('#save').addEventListener('click', event => run(event.currentTarget, async () => {
  await request('/rest/v1/online_test_records', { method: 'POST', body: JSON.stringify({ user_id: session.user.id }) });
  await refresh();
  notice.textContent = 'Registro fictício salvo no Supabase.';
}));
document.querySelector('#logout').addEventListener('click', async () => {
  if (!session) return;
  const token = session.access_token;
  session = undefined;
  showSession();
  notice.textContent = 'Sessão encerrada nesta página.';
  try { await fetch(endpoint + '/auth/v1/logout?scope=local', { method: 'POST', headers: { apikey: publishableKey, Authorization: 'Bearer ' + token } }); } catch {}
});
login.querySelector('fieldset').disabled = false;
