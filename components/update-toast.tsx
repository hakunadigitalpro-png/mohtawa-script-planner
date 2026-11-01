"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Bandeau « Une nouvelle version de Kreatly est disponible ».
 *
 * La page reçoit l'identifiant du build qui l'a servie (`current`). Elle
 * demande `/api/version` toutes les minutes, quand l'onglet redevient
 * visible et quand la fenêtre reprend le focus. Dès que l'identifiant
 * diffère, on affiche le bandeau ; « Mettre à jour » recharge la page.
 *
 * Pourquoi pas le service worker : `public/sw.js` ne change pas d'un
 * déploiement à l'autre, donc le navigateur ne voit aucune mise à jour.
 * L'identifiant de build, lui, change à chaque `next build`.
 */
export function UpdateToast({ current }: { current: string }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (current === "dev") return;
    let stopped = false;

    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: string };
        if (!stopped && id && id !== current) setStale(true);
      } catch {
        /* hors-ligne ou serveur en cours de redéploiement : on réessaiera */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    const timer = window.setInterval(check, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [current]);

  if (!stale) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // bottom-20 sur mobile : au-dessus de la barre d'onglets du bas.
      className="fixed inset-x-4 bottom-20 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground shadow-[0_12px_40px_-12px_rgba(10,6,18,0.35)] md:inset-x-auto md:bottom-6 md:right-6"
    >
      <span>Une nouvelle version de Kreatly est disponible.</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-accent-foreground transition hover:brightness-110"
      >
        <RefreshCw className="size-4" aria-hidden />
        Mettre à jour
      </button>
    </div>
  );
}
