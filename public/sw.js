// Service worker minimal pour Kreatly.
//
// Rôle : rendre l'app "installable" (critère PWA) et permettre une
// installation propre via PWABuilder pour générer le .apk Android.
// On reste volontairement léger : pas de cache agressif des assets
// hashés de Next (qui changent à chaque build), juste un fallback
// réseau-d'abord pour les navigations.

const CACHE = "kreatly-v1";

self.addEventListener("install", (event) => {
  // Active immédiatement la nouvelle version sans attendre.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Nettoie les anciens caches.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// --- Web Push ----------------------------------------------------------
//
// Un push arrive avec un JSON { title, body, url?, tag? }. On affiche la
// notification et au clic on ouvre l'URL demandée (ou l'app par défaut),
// en évitant d'ouvrir un deuxième onglet si l'utilisatrice a déjà Kreatly
// dans sa PWA — on bascule dessus à la place.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Kreatly", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Kreatly";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url || "/calendar" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/calendar";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.navigate(target);
          } catch {
            /* navigate interdit cross-origin : focus simple suffira */
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // On ne touche qu'aux navigations (pages HTML). Réseau d'abord, et si
  // hors-ligne on tente une réponse en cache. Le reste (API, assets) passe
  // directement au réseau — l'app a besoin de Supabase en ligne de toute façon.
  if (req.mode !== "navigate") return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match(req);
        return cached ?? Response.error();
      }
    })(),
  );
});
