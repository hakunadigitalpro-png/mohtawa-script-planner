"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Des onglets « où je suis » qui naviguent par l'URL : les vues du calendrier,
 * « Cette marque / Toutes mes marques » sur les tâches. Un seul dessin, défini
 * ici — « même dessin » n'est garanti que s'il n'y en a qu'un.
 *
 * Composant client pour trois raisons :
 *
 *  1. Un clic d'onglet déclenche des requêtes serveur. Sans retour visuel,
 *     c'est un clic mort — perçu comme une panne, pas comme une attente.
 *     (`app/(app)/loading.tsx` ne suffit pas : il ne se redéclenche pas quand
 *     seule la recherche de l'URL change.)
 *
 *  2. L'état actif n'est pas orange. L'orange est réservé à l'action, et un
 *     bouton de création est souvent à l'autre bout de la même rangée : deux
 *     pastilles orange identiques, et on ne distingue plus « où je suis » de
 *     « ce que je fais ».
 *
 *  3. Les icônes disparaissent sous 640 px. Elles coûtent 22 px par onglet, et
 *     à trois onglets la rangée dépassait la largeur d'un téléphone. Les
 *     libellés restent : ce sont eux qui disent où l'on va.
 */
export function ViewTabs({ children }: { children: React.ReactNode }) {
  return (
    // `max-w-full` + défilement masqué : filet de sécurité si un libellé
    // s'allonge ou si la police tarde à charger. Même motif que `TabsList`.
    <div className="inline-flex max-w-full shrink-0 overflow-x-auto rounded-full border border-border bg-card p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}

export function ViewTab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  /**
   * Icône déjà rendue en JSX (`<LayoutGrid className="…" />`), PAS la
   * référence de composant. Depuis React 19, un Server Component ne peut
   * pas passer une fonction (donc un composant) à un Client Component ;
   * un `ReactNode` déjà rendu passe sans problème. Ajouter la classe
   * `max-sm:hidden` à l'appel pour conserver le comportement d'origine.
   */
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-3.5",
        active
          ? "bg-secondary text-foreground shadow-sm"
          : "text-muted hover:text-foreground",
      )}
    >
      <TabIcon icon={icon} />
      {children}
    </Link>
  );
}

/**
 * L'icône, et elle seule, porte l'attente — et elle est rendue DANS le
 * `<Link>`, seule position où le contexte de `useLinkStatus` existe. Appelé
 * au-dessus, le hook lit la valeur par défaut et ne change jamais.
 */
function TabIcon({ icon }: { icon?: React.ReactNode }) {
  const { pending } = useLinkStatus();
  if (pending) {
    return (
      <>
        <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="sr-only">Chargement…</span>
      </>
    );
  }
  return icon ? <>{icon}</> : null;
}
