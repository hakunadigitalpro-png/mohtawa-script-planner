"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook générique pour les formulaires "sauvegarde explicite" :
 *   - state local (modifié librement par l'user)
 *   - dirty = state diffère de la baseline (= dernier état confirmé save)
 *   - handleSave appelle l'action serveur, et si succès → met à jour la baseline
 *   - handleReset → revient à la baseline
 *   - beforeunload warning quand dirty (preuve standard SaaS)
 *
 * NB : la comparaison `isDirty` utilise JSON.stringify. C'est OK pour des
 * objets plats (strings, numbers, dates). Pour des structures imbriquées
 * complexes, prévoir une fonction de comparaison customisée.
 */
export function useExplicitSave<T>(
  initial: T,
  save: (v: T) => Promise<{ error?: string; ok?: boolean } | void>,
) {
  const [state, setState] = useState<T>(initial);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baselineRef = useRef<T>(initial);
  // Snapshot de l'`initial` reçu en prop : si le parent re-fetch (ex : router.refresh()
  // après une action atomique comme un upload image), on resync sans casser
  // le dirty tracking — la nouvelle baseline = la nouvelle donnée serveur.
  const initialSnapshotRef = useRef<string>(JSON.stringify(initial));

  useEffect(() => {
    const nextSnapshot = JSON.stringify(initial);
    if (nextSnapshot !== initialSnapshotRef.current) {
      initialSnapshotRef.current = nextSnapshot;
      baselineRef.current = initial;
      setState(initial);
    }
  }, [initial]);

  const isDirty =
    JSON.stringify(state) !== JSON.stringify(baselineRef.current);

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await save(state);
      // Si le serveur retourne une erreur explicite → on ne met PAS à jour
      // la baseline (l'user verra toujours le dirty state, peut retry) —
      // ET on affiche l'erreur (sinon "ça ne sauvegarde pas" sans aucune
      // explication, comme un vrai souci vécu avec la contrainte de statut).
      const hasError = res && "error" in res && res.error;
      if (!hasError) {
        baselineRef.current = state;
      } else {
        setError(res.error as string);
      }
    } finally {
      setIsSaving(false);
    }
  }, [state, isDirty, isSaving, save]);

  const handleReset = useCallback(() => {
    setState(baselineRef.current);
    setError(null);
  }, []);

  // Warning navigateur quand l'user a des modifs en cours et tente de fermer
  // l'onglet ou de recharger la page.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome / Edge n'affichent plus de message custom — juste le dialog natif.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Les navigations INTERNES (« Retour au calendrier », la barre latérale…)
  // ne déclenchent pas `beforeunload` : Next.js change de page sans recharger.
  // C'était le vrai trou — on cliquait, et le travail disparaissait sans un mot.
  //
  // Faute d'API de garde dans l'App Router, on intercepte le clic sur le lien
  // avant qu'il n'agisse. Volontairement conservateur : on ne se mêle que d'un
  // clic gauche simple, sur un lien du site qui mène ailleurs. Un clic au
  // milieu, un Ctrl+clic, un lien externe, un téléchargement ou une ancre
  // passent intacts — ils n'ont jamais fait perdre de travail.
  useEffect(() => {
    if (!isDirty) return;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Un autre site : `beforeunload` s'en charge déjà. La même page non plus
      // ne fait rien perdre.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      const leave = window.confirm(
        "Tu as des modifications non enregistrées.\n\n" +
          "Si tu quittes maintenant, elles seront perdues.\n" +
          "Quitter quand même ?",
      );
      if (!leave) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // En phase de capture : on passe avant le routeur de Next.js, sinon la
    // navigation serait déjà lancée quand on poserait la question.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [isDirty]);

  return { state, setState, isDirty, isSaving, error, handleSave, handleReset };
}
