import type { MetadataRoute } from "next";

/**
 * Web App Manifest (Next metadata route → sert /manifest.webmanifest).
 *
 * C'est le coeur de la "vraie app" : il déclare le nom, les icônes,
 * et surtout `display: "standalone"` qui fait que l'app s'ouvre en
 * PLEIN ÉCRAN (sans barre d'URL Chrome) une fois installée.
 *
 * C'est aussi le prérequis obligatoire pour empaqueter l'app en .apk
 * Android (TWA via PWABuilder) : PWABuilder lit ce manifeste pour
 * générer l'application.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mohtawa — Script Planner",
    short_name: "Mohtawa",
    description:
      "Planifie tes Reels et Stories, structure tes scripts et analyse tes résultats.",
    // "/" gère la redirection vers /dashboard (connecté) ou /login.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDF6EF",
    theme_color: "#FF6B35",
    lang: "fr",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Icône "maskable" : Android la recadre dans sa forme (cercle,
      // squircle…). Plein cadre orange + glyphe centré dans la zone sûre.
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
