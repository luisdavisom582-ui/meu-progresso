const CACHE_NAME = "meu-progresso-demo-v14";
const APP_SHELL = ["./", "./index.html", "./editorial.css", "./community-social.css", "./community-social.js", "./manifest.webmanifest", "./icon.svg", "./privacidade.html", "./termos.html", "./cookies.html", "./reembolsos.html"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (event.request.mode === "navigate") {
      try {
        const response = await fetch(event.request, { cache: "no-cache" });
        if (response.ok) await (await caches.open(CACHE_NAME)).put("./index.html", response.clone());
        return response;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    }
    try {
      const response = await fetch(event.request, { cache: "no-cache" });
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return (await caches.match(event.request)) || (await caches.match("./index.html")) || Response.error();
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
      if ("focus" in client) return client.focus();
    }
    return self.clients.openWindow(event.notification.data?.url || "./");
  })());
});
