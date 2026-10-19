import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Film } from "lucide-react";
import {
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { ContentCommentsButton } from "@/components/comments";
import type { Content } from "@/lib/types";

/** Jour de la semaine abrégé en français (lun, mar…). */
function dayShortFr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
}

/**
 * Vue « Planning » — le tableau global du mois : tous les contenus (posts,
 * carrousels, vidéos) en lignes, groupés par semaine, avec Type / Plateforme /
 * Statut / Titre. La tour de contrôle éditoriale (équivalent du tableau Notion).
 */
export function PlanningTable({
  contents,
  commentCounts = {},
  thumbs = {},
  scopeQuery = "",
  groupBy = "week",
  emptyState,
}: {
  contents: Content[];
  /** contentId → nombre de commentaires non lus (badge). */
  commentCounts?: Record<string, number>;
  /** contentId → première image du contenu (lib/thumbnails). */
  thumbs?: Record<string, string>;
  /** Périmètre transporté vers la fiche (mois affiché). */
  scopeQuery?: string;
  /** Par semaine dans un mois ; par mois quand la liste traverse les mois. */
  groupBy?: "week" | "month";
  /** Ce que dit la boîte vide, quand « Aucun contenu ce mois-ci » serait faux. */
  emptyState?: ReactNode;
}) {
  const sorted = [...contents].sort((a, b) =>
    (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"),
  );

  // Groupe par semaine du mois (jours 1-7 = Semaine 1, 8-14 = Semaine 2…).
  const groups: { label: string; items: Content[] }[] = [];
  const idxByLabel = new Map<string, number>();
  for (const c of sorted) {
    // Plus de groupe « Sans date » : la requête parente filtre déjà sur le
    // mois, donc il était mort — et depuis l'onglet Idées, les contenus sans
    // date ont leur propre endroit. Deux listes pour la même chose, c'est
    // exactement ce qu'on cherche à éviter.
    const label =
      groupBy === "month"
        ? c.date
          ? new Date(c.date).toLocaleDateString("fr-FR", {
              month: "long",
              year: "numeric",
            })
          : "Sans date"
        : `Semaine ${Math.ceil(Number((c.date ?? "").slice(8, 10)) / 7)}`;
    let gi = idxByLabel.get(label);
    if (gi === undefined) {
      gi = groups.length;
      groups.push({ label, items: [] });
      idxByLabel.set(label, gi);
    }
    groups[gi].items.push(c);
  }

  if (contents.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted">
        {emptyState ?? "Aucun contenu ce mois-ci. Crée-en un avec « Nouveau »."}
      </div>
    );
  }

  // Jour · Date · Plateforme · Statut · Légende · Vidéo · Titre+Visuel
  // Colonnes fixes à gauche pour que les repères s'alignent entre lignes,
  // Légende et Titre élastiques pour prendre la place qui reste.
  const cols =
    "grid-cols-[60px_100px_110px_120px_minmax(0,1.5fr)_70px_minmax(0,1.6fr)]";

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <div className="min-w-[900px]">
        <div
          className={`grid ${cols} gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted`}
        >
          <div>Jour</div>
          <div>Date</div>
          <div>Plateforme</div>
          <div>Statut</div>
          <div>Légende</div>
          <div>Vidéo</div>
          <div>Titre</div>
        </div>

        {groups.map((g) => (
          <div key={g.label}>
            <div className="bg-secondary/20 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-muted">
              {g.label}
            </div>
            {g.items.map((c) => (
              <div key={c.id} className="relative">
                <Link
                  href={`/content/${c.id}${scopeQuery}`}
                  className={`grid ${cols} items-center gap-3 border-b border-border/40 px-4 py-3 pe-10 text-sm transition last:border-b-0 hover:bg-secondary/40`}
                >
                  <span className="font-medium capitalize text-foreground/80">
                    {dayShortFr(c.date)}
                  </span>
                  <span className="text-muted">
                    {c.date ? formatDateFr(c.date) : "—"}
                  </span>
                  <span className="truncate text-muted">
                    {c.platform ? platformLabel(c.platform) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: statusColor(c.status) }}
                    />
                    {statusLabel(c.status)}
                  </span>
                  <span
                    className="min-w-0 truncate text-foreground/70"
                    dir="auto"
                    title={c.caption ?? undefined}
                  >
                    {c.caption?.trim() || (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  {/* Icône cliquable → la vidéo externe. On intercepte le
                      clic pour qu'il ne déclenche pas aussi la navigation
                      vers la fiche. Vide : simple tiret, pas de bouton
                      fantôme. */}
                  <span className="inline-flex">
                    {c.preview_url ? (
                      <a
                        href={c.preview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex size-8 items-center justify-center rounded-full text-foreground/70 transition hover:bg-secondary hover:text-foreground"
                        title="Ouvrir la vidéo"
                        aria-label="Ouvrir la vidéo"
                      >
                        <Film className="size-4" />
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <span className="flex min-w-0 items-center gap-2.5">
                    {thumbs[c.id] ? (
                      <Image
                        src={thumbs[c.id]}
                        alt=""
                        width={72}
                        height={72}
                        className="size-9 shrink-0 rounded-md object-cover object-top"
                      />
                    ) : (
                      /* Réserve la place : sans ce carré, les titres des lignes
                         sans visuel ne seraient plus alignés avec les autres. */
                      <span className="size-9 shrink-0 rounded-md bg-secondary" />
                    )}
                    <span
                      className="truncate font-medium text-foreground"
                      dir="auto"
                    >
                      {c.title || "Sans titre"}
                    </span>
                  </span>
                </Link>
                {/* Sibling du Link (pas nesté dedans) pour commenter sans
                    quitter le Planning. */}
                <div className="absolute end-3 top-1/2 -translate-y-1/2">
                  <ContentCommentsButton
                    contentId={c.id}
                    unreadCount={commentCounts[c.id] ?? 0}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
