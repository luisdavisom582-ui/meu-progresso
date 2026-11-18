const CACHE_PREFIX = 'meu-progresso-demo-';
const CACHE_NAME = CACHE_PREFIX + 'v29';
const APP_SHELL = ["./","./index.html","./entrada.js?v=29","./entrada.css","./editorial.css","./community-social.css?v=22","./community-live.js?v=25","./community.js?v=profile4","./community-review.js?v=5","./manifest.webmanifest","./icon.svg","./privacidade.html","./termos.html","./cookies.html","./reembolsos.html","./app-core.js","./mobile-access.js","./help-controls.js","./help-position.js","./page-motion.js","./area-dialog.js","./evolution.js?v=29","./evolution-portal.js","./first-visit-guides.js?v=20"];
const SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (event.request.mode === 'navigate') url.search = '';
  if (!SHELL_URLS.has(url.href)) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-cache' });
      if (response.ok && response.type === 'basic' && !response.redirected) {
        try { await (await caches.open(CACHE_NAME)).put(url.href, response.clone()); }
        catch { /* The online response is still usable. */ }
      }
      return response;
    } catch {
      return (await (await caches.open(CACHE_NAME)).match(url.href)) || Response.error();
    }
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "Uma pausa para você." }; }
  const title = typeof payload.title === "string" ? payload.title.slice(0, 80) : "Um momento para você 🌿";
  const body = typeof payload.body === "string" ? payload.body.slice(0, 180) : "Se quiser, faça seu check-in de hoje.";
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: "./icon.svg",
    badge: "./icon.svg",
    tag: "meu-progresso-lembrete",
    data: { url: "./" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.registration.scope) && "focus" in client) return client.focus();
    }
    return self.clients.openWindow(self.registration.scope);
  })());
});
