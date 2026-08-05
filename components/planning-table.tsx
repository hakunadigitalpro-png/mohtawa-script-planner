import Link from "next/link";
import {
  typeColor,
  typeLabel,
  statusColor,
  statusLabel,
  platformLabel,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { ContentCommentsButton } from "@/components/comments";
import type { Content } from "@/lib/types";

/**
 * Vue « Planning » — le tableau global du mois : tous les contenus (posts,
 * carrousels, vidéos) en lignes, groupés par semaine, avec Type / Plateforme /
 * Statut / Titre. La tour de contrôle éditoriale (équivalent du tableau Notion).
 */
export function PlanningTable({
  contents,
  commentCounts = {},
}: {
  contents: Content[];
  /** contentId → nombre de commentaires non lus (badge). */
  commentCounts?: Record<string, number>;
}) {
  const sorted = [...contents].sort((a, b) =>
    (a.date ?? "9999-99-99").localeCompare(b.date ?? "9999-99-99"),
  );

  // Groupe par semaine du mois (jours 1-7 = Semaine 1, 8-14 = Semaine 2…).
  const groups: { label: string; items: Content[] }[] = [];
  const idxByLabel = new Map<string, number>();
  for (const c of sorted) {
    const label = c.date
      ? `Semaine ${Math.ceil(Number(c.date.slice(8, 10)) / 7)}`
      : "Sans date";
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
        Aucun contenu ce mois-ci. Crée-en un avec « Nouveau ».
      </div>
    );
  }

  const cols = "grid-cols-[110px_120px_110px_140px_130px_1fr]";

  return (
    <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card">
      <div className="min-w-[760px]">
        <div
          className={`grid ${cols} gap-3 border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted`}
        >
          <div>Date</div>
          <div>Type</div>
          <div>Plateforme</div>
          <div>Statut</div>
          <div>Pilier</div>
          <div>Titre</div>
        </div>

        {groups.map((g) => (
          <div key={g.label}>
            <div className="bg-secondary/20 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              {g.label}
            </div>
            {g.items.map((c) => (
              <div key={c.id} className="relative">
                <Link
                  href={`/content/${c.id}`}
                  className={`grid ${cols} items-center gap-3 border-b border-border/40 px-4 py-3 pe-10 text-sm transition last:border-b-0 hover:bg-secondary/40`}
                >
                  <span className="text-muted">
                    {c.date ? formatDateFr(c.date) : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: typeColor(c.type) }}
                    />
                    {typeLabel(c.type)}
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
                  <span dir="auto">
                    {c.pillar ? (
                      <span className="inline-block max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 align-middle text-xs font-medium text-foreground/70">
                        {c.pillar}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                  <span className="truncate font-medium text-foreground" dir="auto">
                    {c.title || "Sans titre"}
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
