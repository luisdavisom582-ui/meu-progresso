(() => {
  const endpoint = "https://aydwfcmxegcucmmspvib.supabase.co";
  const key = "sb_publishable_PxgmhZDEQLjUsLQT6Bw6Ww_hDGeYgJh";
  const scripts = ["./app-core.js","./mobile-access.js","./help-controls.js","./help-position.js","./page-motion.js","./area-dialog.js","./evolution.js","./evolution-portal.js","community-live.js?v=20","./first-visit-guides.js?v=20","community.js?v=profile3","community-review.js?v=5"];
  const sessionKey = 'mp:entry:session:v1';
  const gate = document.getElementById('entryGate');
  const form = document.getElementById('entryForm');
  const fields = form.querySelector('fieldset');
  const status = document.getElementById('entryStatus');
  const toggle = document.getElementById('entryToggle');
  const logout = document.getElementById('entryLogout');
  const home = new URL('./', location.href).href;
  let session;
  let remember = false;
  let creating = false;

  async function auth(path, { body, token, keepalive = false } = {}) {
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(endpoint + '/auth/v1/' + path, {
      method: body || keepalive ? 'POST' : 'GET', headers,
      body: body ? JSON.stringify(body) : undefined, keepalive, cache: 'no-store',
      signal: keepalive ? undefined : AbortSignal.timeout(12000)
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      const error = new Error('Não foi possível conectar à conta agora.');
      error.code = detail.code;
      error.status = response.status;
      throw error;
    }
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  function setMode(signup) {
    creating = signup;
    document.getElementById('entryRemember').hidden = signup;
    document.getElementById('entryTitle').textContent = signup ? 'Crie sua conta' : 'Entre na sua conta';
    document.getElementById('entryIntro').textContent = signup ? 'Seu nome e e-mail ficam vinculados à conta no Supabase. Seu diário e suas metas ficam neste navegador.' : 'Entre para acessar seu espaço.';
    document.getElementById('nameField').hidden = !signup;
    document.getElementById('entryTerms').hidden = !signup;
    form.elements.displayName.required = signup;
    form.elements.terms.required = signup;
    form.elements.password.autocomplete = signup ? 'new-password' : 'current-password';
    form.elements.password.minLength = signup ? 8 : 0;
    form.querySelector('button[type=submit]').textContent = signup ? 'Criar conta' : 'Entrar';
    toggle.textContent = signup ? 'Já tenho conta' : 'Criar uma conta';
  }

  function readSession(storage) {
    try {
      const saved = JSON.parse(storage.getItem(sessionKey) || 'null');
      return saved?.access_token && saved?.refresh_token ? saved : null;
    } catch { return null; }
  }
  function clearSaved(storage) {
    try { storage.removeItem(sessionKey); } catch {}
  }
  function storeSession() {
    const tokens = JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (remember) {
      try {
        localStorage.setItem(sessionKey, tokens);
        clearSaved(sessionStorage);
        return;
      } catch {}
    }
    try { sessionStorage.setItem(sessionKey, tokens); } catch {}
  }
  function forgetSession() {
    const token = session?.access_token;
    session = undefined;
    clearSaved(sessionStorage);
    if (remember) clearSaved(localStorage);
    return token;
  }
  window.addEventListener('storage', event => {
    if (remember && event.storageArea === localStorage && event.key === sessionKey && !event.newValue) {
      session = undefined;
      location.replace(home);
    }
  });
  async function enter(user) {
    if (typeof user?.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error('Sessão inválida.');
    const prefix = 'mp:account:' + user.id + ':';
    window.mpCommunityRequest = async (path, options = {}) => {
      const send = token => fetch(endpoint + path, {
        ...options,
        cache: 'no-store',
        headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (!session) throw new Error('Entre novamente para acessar a comunidade.');
      const usedToken = session.access_token;
      let response = await send(usedToken);
      if (response.status === 401) {
        const refresh = async () => {
          if (remember) session = readSession(localStorage);
          if (!session) throw new Error('Entre novamente para acessar a comunidade.');
          if (session.access_token === usedToken) {
            session = await auth('token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
            storeSession();
          }
        };
        if (remember && navigator.locks) await navigator.locks.request('mp-entry-session', refresh);
        else await refresh();
        response = await send(session.access_token);
      }
      const content = await response.text();
      const data = content ? JSON.parse(content) : null;
      if (!response.ok) {
        const error = new Error(data?.error || 'Não foi possível acessar a comunidade agora.');
        error.status = response.status;
        throw error;
      }
      return data;
    };
    window.mpCommunityUserId = user.id;
    window.mpAccountName = typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : '';
    window.mpAccountStorage = Object.freeze({
      getItem: key => localStorage.getItem(prefix + key),
      setItem: (key, value) => localStorage.setItem(prefix + key, value),
      removeItem: key => localStorage.removeItem(prefix + key)
    });
    form.hidden = true;
    toggle.hidden = true;
    status.textContent = 'Abrindo seu espaço…';
    for (const source of scripts) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = './' + source.replace(/^\.\//, '');
        script.onload = resolve;
        script.onerror = reject;
        document.body.append(script);
      });
    }
    gate.hidden = true;
    document.body.classList.remove('entry-locked');
  }
  function showLogin() {
    fields.disabled = false;
    form.hidden = false;
    toggle.hidden = false;
  }
  toggle.addEventListener('click', () => {
    setMode(!creating);
    status.textContent = '';
    (creating ? form.elements.displayName : form.elements.email).focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (fields.disabled) return;
    const signup = creating;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const displayName = form.elements.displayName.value.trim();
    if (signup && !displayName) {
      status.textContent = 'Digite como quer ser chamado.';
      return;
    }
    fields.disabled = true;
    toggle.disabled = true;
    status.textContent = signup ? 'Criando conta…' : 'Entrando…';
    form.elements.password.value = '';
    try {
      const body = { email, password };
      if (signup) {
        await auth('signup?redirect_to=' + encodeURIComponent(home), {
          body: { ...body, data: { display_name: displayName } }
        });
        setMode(false);
        form.elements.terms.checked = false;
        status.textContent = 'Confira seu e-mail para confirmar o cadastro. Depois, volte aqui e entre com sua senha.';
      } else {
        remember = form.elements.remember.checked;
        session = await auth('token?grant_type=password', { body });
        const user = await auth('user', { token: session.access_token });
        if (!remember) clearSaved(localStorage);
        storeSession();
        await enter(user);
      }
    } catch (error) {
      if (form.hidden) {
        status.textContent = 'Não consegui carregar o aplicativo. Recarregue a página para tentar de novo.';
        return;
      }
      status.textContent = error.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.'
        : error.code === 'over_email_send_rate_limit' || error.status === 429 ? 'Muitas tentativas. Aguarde e tente novamente.'
        : error.code === 'weak_password' ? 'Escolha uma senha mais forte.'
        : !signup && error.status === 400 ? 'Confira seu e-mail e sua senha.'
        : 'Não foi possível concluir agora. Tente novamente em instantes.';
    } finally {
      fields.disabled = false;
      toggle.disabled = false;
    }
  });
  logout.addEventListener('click', () => {
    const token = forgetSession();
    clearSaved(localStorage);
    if (token) void auth('logout?scope=local', { token, keepalive: true }).catch(() => {});
    location.replace(home);
  });

  async function start() {
    const callback = new URLSearchParams(location.hash.slice(1));
    const fromEmail = callback.has('access_token') || callback.has('error') ||
      new URL(location.href).searchParams.has('code');
    if (fromEmail) history.replaceState(null, '', home);
    const persistent = readSession(localStorage);
    remember = Boolean(persistent);
    session = persistent || readSession(sessionStorage);
    if (session) {
      let user;
      const validate = async () => {
        if (remember) {
          session = readSession(localStorage);
          if (!session) return null;
        }
        try { return await auth('user', { token: session.access_token }); }
        catch (error) {
          if (error.status !== 401 && error.status !== 403) throw error;
          session = await auth('token?grant_type=refresh_token', {
            body: { refresh_token: session.refresh_token }
          });
          storeSession();
          return auth('user', { token: session.access_token });
        }
      };
      try {
        user = remember && navigator.locks
          ? await navigator.locks.request('mp-entry-session', validate)
          : await validate();
      } catch (error) {
        if ([400, 401, 403].includes(error.status)) {
          forgetSession();
          status.textContent = 'Sua sessão expirou. Entre novamente.';
        } else {
          status.textContent = 'Não consegui verificar sua sessão agora. Você pode recarregar para tentar de novo.';
        }
        showLogin();
        return;
      }
      if (!user) {
        showLogin();
        status.textContent = '';
        return;
      }
      try { await enter(user); }
      catch { status.textContent = 'Não consegui carregar o aplicativo. Recarregue para tentar de novo.'; }
      return;
    }
    status.textContent = fromEmail ? 'Depois de confirmar seu e-mail, entre com sua senha.' : '';
    showLogin();
  }
  void start();
})();
