"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (public/sw.js) côté client.
 * Monté une fois dans le root layout. Silencieux : si l'enregistrement
 * échoue (navigateur sans support, contexte non sécurisé en dev), on
 * ignore — l'app fonctionne normalement sans.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
