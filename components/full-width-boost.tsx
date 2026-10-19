"use client";

import * as React from "react";

/**
 * Élargit le conteneur `max-w-6xl` du layout parent pour la page qui
 * monte ce composant. On ne touche pas le layout global : on cherche le
 * premier ancêtre qui porte la classe `max-w-6xl` et on la remplace par
 * `max-w-[1600px]` le temps de la vie du composant. Démontage → on
 * remet la classe, pour ne pas déborder les autres pages.
 */
export function FullWidthBoost() {
  React.useEffect(() => {
    const el = document.querySelector<HTMLElement>(".max-w-6xl");
    if (!el) return;
    el.classList.remove("max-w-6xl");
    el.classList.add("max-w-[1600px]");
    return () => {
      el.classList.remove("max-w-[1600px]");
      el.classList.add("max-w-6xl");
    };
  }, []);
  return null;
}
