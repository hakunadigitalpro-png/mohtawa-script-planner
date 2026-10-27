"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { statusColor, statusLabel } from "@/lib/constants";
import { platformAccentColor } from "@/lib/platform-colors";
import { ContentCommentsButton } from "@/components/comments";
import { updateContent } from "@/app/(app)/contents/actions";
import type { Content } from "@/lib/types";

/**
 * Vue Kanban — colonnes = statuts, cartes = contenus. Glisser une
 * carte d'une colonne à l'autre change le statut (via updateContent,
 * revalidation côté serveur). Le viewer client voit la même grille
 * mais ne peut pas glisser : il lit et commente.
 *
 * Statuts affichés : les étapes du cycle de vie utile côté éditorial.
 * On garde volontairement les mêmes libellés que `/calendar?view=planning`
 * et la fiche — c'est la même donnée vue autrement.
 */

type KanbanContent = Content & {
  // Vignette pré-chargée côté serveur (comme pour planning-table).
  thumb?: string | null;
};

const COLUMNS: { value: string; label: string }[] = [
  { value: "idea", label: "Idée" },
  { value: "script", label: "Script" },
  { value: "design", label: "Design" },
  { value: "filming", label: "Tournage" },
  { value: "editing", label: "Montage" },
  { value: "pending_review", label: "À valider" },
  { value: "needs_revision", label: "À réviser" },
  { value: "approved", label: "Validé" },
  { value: "scheduled", label: "Programmée" },
  { value: "live", label: "Live" },
];

const DRAG_MIME = "application/x-kreatly-kanban";

export function KanbanView({
  contents,
  commentCounts = {},
  thumbs = {},
  canEdit = true,
}: {
  contents: Content[];
  commentCounts?: Record<string, number>;
  thumbs?: Record<string, string>;
  canEdit?: boolean;
}) {
  const router = useRouter();
  const [dragOver, setDragOver] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Grouper par statut. Les statuts inconnus (ex. 'selected' historique)
  // vont dans la colonne "idea" par défaut — pas de perte visuelle.
  const byStatus = new Map<string, KanbanContent[]>();
  for (const col of COLUMNS) byStatus.set(col.value, []);
  for (const c of contents) {
    const key = COLUMNS.find((col) => col.value === c.status)?.value ?? "idea";
    const list = byStatus.get(key)!;
    list.push({ ...c, thumb: thumbs[c.id] ?? null });
  }

  // Filtrer les colonnes vides pour alléger l'écran — on ne garde que
  // celles qui portent au moins un contenu, SAUF si on peut éditer, où
  // on garde tout pour qu'il y ait toujours une cible de drop.
  const visibleColumns = canEdit
    ? COLUMNS
    : COLUMNS.filter((col) => (byStatus.get(col.value)?.length ?? 0) > 0);

  const onDrop = (toStatus: string, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DRAG_MIME);
    setDragOver(null);
    if (!id || !canEdit) return;
    // Optimisme : on recharge la page après la mutation serveur ; dans
    // l'intervalle la carte semble bouger grâce au refresh.
    startTransition(async () => {
      const res = await updateContent(id, { status: toStatus });
      if ("ok" in res && res.ok) router.refresh();
    });
  };

  if (contents.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-10 text-center text-sm text-muted">
        Aucun contenu à afficher.
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto"
      aria-busy={pending}
    >
      <div className="flex min-w-max gap-3 pb-2">
        {visibleColumns.map((col) => {
          const items = byStatus.get(col.value) ?? [];
          const color = statusColor(col.value);
          return (
            <div
              key={col.value}
              className={`flex w-72 shrink-0 flex-col rounded-2xl border transition ${
                dragOver === col.value
                  ? "border-accent bg-accent/5"
                  : "border-border/60 bg-card/60"
              }`}
              onDragOver={(e) => {
                if (!canEdit) return;
                if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== col.value) setDragOver(col.value);
              }}
              onDragLeave={() => dragOver === col.value && setDragOver(null)}
              onDrop={(e) => onDrop(col.value, e)}
            >
              <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: color }}
                />
                <span className="text-sm font-semibold text-foreground">
                  {col.label}
                </span>
                <span className="ms-auto text-xs text-muted">
                  {items.length}
                </span>
              </div>
              <ul className="flex flex-col gap-2 p-2">
                {items.length === 0 && canEdit && (
                  <li className="rounded-xl border border-dashed border-foreground/10 p-3 text-center text-xs text-muted">
                    Dépose ici
                  </li>
                )}
                {items.map((c) => (
                  <KanbanCard
                    key={c.id}
                    content={c}
                    canEdit={canEdit}
                    unreadCount={commentCounts[c.id] ?? 0}
                  />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  content: c,
  canEdit,
  unreadCount,
}: {
  content: KanbanContent;
  canEdit: boolean;
  unreadCount: number;
}) {
  const router = useRouter();
  const platColor = platformAccentColor(c.platform);
  return (
    <li
      draggable={canEdit}
      onDragStart={(e) => {
        if (!canEdit) return;
        e.dataTransfer.setData(DRAG_MIME, c.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group rounded-xl border border-border/60 bg-card p-2 shadow-sm transition hover:border-accent/40"
    >
      <button
        type="button"
        onClick={() => router.push(`/content/${c.id}`)}
        className="block w-full text-start"
      >
        {c.thumb ? (
          <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-lg bg-secondary">
            <Image
              src={c.thumb}
              alt=""
              fill
              sizes="256px"
              className="object-cover"
            />
          </div>
        ) : null}
        <p className="line-clamp-2 text-sm font-medium text-foreground" dir="auto">
          {c.title || "Sans titre"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {c.platform && (
            <span
              className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `color-mix(in oklab, ${platColor} 15%, transparent)`,
                color: `color-mix(in oklab, ${platColor} 80%, var(--color-ink, #0A0612) 20%)`,
              }}
            >
              {c.platform}
            </span>
          )}
          {c.date && (
            <span className="text-muted">
              {new Date(c.date).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
        </div>
      </button>
      <div
        className="mt-1 flex items-center justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-[10px] uppercase text-muted">
          {statusLabel(c.status)}
        </span>
        <ContentCommentsButton contentId={c.id} unreadCount={unreadCount} />
      </div>
    </li>
  );
}
