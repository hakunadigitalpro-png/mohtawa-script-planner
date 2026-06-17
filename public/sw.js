// Service worker minimal pour Mohtawa.
//
// Rôle : rendre l'app "installable" (critère PWA) et permettre une
// installation propre via PWABuilder pour générer le .apk Android.
// On reste volontairement léger : pas de cache agressif des assets
// hashés de Next (qui changent à chaque build), juste un fallback
// réseau-d'abord pour les navigations.

const CACHE = "mohtawa-v1";

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
