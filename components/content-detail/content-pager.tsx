import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Neighbours } from "@/lib/content-neighbours";

/**
 * « 4 / 17 » avec deux flèches, dans l'en-tête de la fiche.
 *
 * Traiter ses contenus par lots est la situation normale : relire les
 * carrousels d'un atelier, compléter les scripts d'une série. Sans ça, on
 * repasse par le calendrier entre chaque — retrouver la case, recliquer —
 * et c'est le geste le plus répété de la journée.
 *
 * Une flèche sans voisin reste VISIBLE mais inerte : la faire disparaître
 * déplacerait les boutons sous le curseur d'un contenu à l'autre.
 */
export function ContentPager({ nav }: { nav: Neighbours }) {
  if (nav.total < 2) return null;

  const base =
    "inline-flex size-9 items-center justify-center rounded-full border border-white/20 text-white transition";
  const on = "hover:bg-white/15";
  const off = "cursor-default opacity-30";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {nav.prevId ? (
        <Link
          href={`/content/${nav.prevId}${nav.query}`}
          className={cn(base, on)}
          aria-label="Contenu précédent dans le planning"
        >
          <ChevronLeft className="size-4 rtl-flip" />
        </Link>
      ) : (
        <span className={cn(base, off)} aria-hidden>
          <ChevronLeft className="size-4 rtl-flip" />
        </span>
      )}

      {/* « 4 / 17 » seul ne dit pas 17 QUOI. Le compte porte sur tous les
          contenus de la marque, dans l'ordre du planning — pas sur le mois
          ni le filtre affichés. Autant l'écrire que laisser deviner. */}
      <span
        className="min-w-14 text-center text-sm font-semibold tabular-nums text-white/70"
        title="Dans l'ordre de la liste d'où tu viens"
      >
        <span className="sr-only">Contenu </span>
        {nav.position} / {nav.total}
      </span>

      {nav.nextId ? (
        <Link
          href={`/content/${nav.nextId}${nav.query}`}
          className={cn(base, on)}
          aria-label="Contenu suivant dans le planning"
        >
          <ChevronRight className="size-4 rtl-flip" />
        </Link>
      ) : (
        <span className={cn(base, off)} aria-hidden>
          <ChevronRight className="size-4 rtl-flip" />
        </span>
      )}
    </div>
  );
}
