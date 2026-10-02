/**
 * L'écran d'attente de toutes les pages de l'app.
 *
 * Il n'en existait aucun : pendant qu'une page se préparait côté serveur, le
 * navigateur restait sur la PRÉCÉDENTE, sans rien montrer. On cliquait, et il
 * ne se passait visiblement rien — d'où l'impression de lenteur, bien plus
 * forte que le temps réellement écoulé.
 *
 * Next.js affiche ce fichier dès le clic, avant même d'avoir interrogé la
 * base. La page ne va pas plus vite, mais elle répond tout de suite.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>

      {/* Le bandeau de titre, à la même place que le vrai. */}
      <div className="skeleton h-32 rounded-3xl bg-hero/90 sm:h-36" />

      {/* Trois blocs de contenu — assez pour occuper l'écran sans promettre
          une mise en page précise, qui changerait d'une page à l'autre. */}
      <div className="space-y-4">
        <div className="skeleton h-24 rounded-3xl bg-card" />
        <div className="skeleton h-48 rounded-3xl bg-card" />
        <div className="skeleton h-48 rounded-3xl bg-card" />
      </div>
    </div>
  );
}
