"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AD_STATUS_LABEL, AD_STATUS_PICKER } from "@/lib/types-ads";
import { adReadiness } from "@/lib/ad-campaigns";
import { updateCampaignField } from "@/app/(app)/ads/actions";
import type { CampaignRow } from "@/components/ads/ads-views";

type KanbanAdSet = {
  ads: {
    hook?: string | null;
    visual_url?: string | null;
    video_url?: string | null;
    slides: { visual_url?: string | null; video_url?: string | null; text?: string | null }[];
  }[];
};

const DRAG_MIME = "application/x-kreatly-ad-kanban";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/**
 * Les campagnes par statut. Glisser une carte change le statut, avec les mêmes
 * droits que le menu de la fiche. Le client invité lit, il ne glisse pas.
 *
 * Le statut change tout de suite à l'écran : la page ne se recharge qu'après
 * la réponse, et une erreur remet la carte à sa place en le disant.
 */
export function AdsKanbanView({
  campaigns,
  adSetsByCampaign,
  canEdit,
  teamLabels,
  legacyVisuals,
  backQs = "",
}: {
  /** D'où l'on vient, pour que la fiche ramène à cette vue et ces filtres. */
  backQs?: string;
  campaigns: CampaignRow[];
  adSetsByCampaign: Record<string, KanbanAdSet[]>;
  canEdit: boolean;
  teamLabels?: Record<string, string>;
  /** Visuels d'avant les annonces, en secours pour la couverture. */
  legacyVisuals: Record<string, string>;
}) {
  const router = useRouter();
  const [moved, setMoved] = React.useState<Record<string, string>>({});
  const [over, setOver] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Les données fraîches font foi : le statut a pu être recalculé selon les
  // dates, ou changé par un collègue.
  React.useEffect(() => setMoved({}), [campaigns]);

  // « Programmée » n'est plus proposée, mais d'anciennes campagnes la portent :
  // la colonne n'apparaît que pour elles.
  const statusOf = (c: CampaignRow) => moved[c.id] ?? c.status;
  const columns = [
    ...AD_STATUS_PICKER,
    ...(campaigns.some((c) => statusOf(c) === "scheduled") ? (["scheduled"] as const) : []),
  ];

  const drop = async (id: string, status: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c || statusOf(c) === status) return;
    setError(null);
    setMoved((m) => ({ ...m, [id]: status }));
    let failure: string | null = null;
    try {
      const res = await updateCampaignField(id, { status });
      failure = res.error ?? null;
    } catch {
      failure = "Le statut n'a pas pu être enregistré. Réessaie.";
    }
    if (failure) {
      setMoved(({ [id]: _dropped, ...rest }) => rest);
      setError(failure);
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((status) => {
          const items = campaigns.filter((c) => statusOf(c) === status);
          return (
            <section
              key={status}
              onDragOver={(e) => {
                if (!canEdit || !e.dataTransfer.types.includes(DRAG_MIME)) return;
                e.preventDefault();
                setOver(status);
              }}
              onDragLeave={() => setOver((o) => (o === status ? null : o))}
              onDrop={(e) => {
                setOver(null);
                const id = e.dataTransfer.getData(DRAG_MIME);
                if (id) drop(id, status);
              }}
              className={cn(
                "w-64 shrink-0 rounded-2xl border border-foreground/10 bg-secondary/30 p-2.5 transition",
                over === status && "border-foreground/40 bg-secondary/60",
              )}
            >
              <header className="mb-2 flex items-center justify-between px-1 text-sm font-semibold text-foreground">
                {AD_STATUS_LABEL[status]}
                <span className="text-xs font-medium text-muted-foreground">{items.length}</span>
              </header>
              <ul className="space-y-2">
                {items.map((c) => (
                  <KanbanCard
                    key={c.id}
                    campaign={c}
                    adSets={adSetsByCampaign[c.id] ?? []}
                    canEdit={canEdit}
                    lead={(c.lead_id && teamLabels?.[c.lead_id]) || null}
                    legacyVisual={legacyVisuals[c.id] ?? null}
                    backQs={backQs}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KanbanCard({
  campaign: c,
  adSets,
  canEdit,
  lead,
  legacyVisual,
  backQs,
}: {
  backQs: string;
  campaign: CampaignRow;
  adSets: KanbanAdSet[];
  canEdit: boolean;
  lead: string | null;
  legacyVisual: string | null;
}) {
  const { ready, total } = adReadiness(adSets);
  const firstAd = adSets.flatMap((s) => s.ads)[0];
  const cover = firstAd?.slides[0]?.visual_url || firstAd?.visual_url || legacyVisual;

  return (
    <li
      draggable={canEdit}
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_MIME, c.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "rounded-xl border border-foreground/10 bg-card shadow-sm transition hover:border-foreground/30",
        canEdit && "cursor-grab active:cursor-grabbing",
      )}
    >
      <Link href={`/ads/${c.id}${backQs}`} draggable={false} className="block p-2">
        {cover && (
          <div className="relative mb-2 aspect-video overflow-hidden rounded-lg bg-secondary">
            <Image
              src={cover}
              alt=""
              fill
              sizes="256px"
              draggable={false}
              className="object-cover"
            />
          </div>
        )}
        <p className="line-clamp-2 text-sm font-semibold text-foreground" dir="auto">
          {c.title}
        </p>
        {c.review_state === "pending_review" && (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-foreground dark:bg-amber-500/20">
            En attente du client
          </span>
        )}
        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {c.date_start && (
            <p className="flex items-center gap-1">
              <CalendarDays className="size-3.5 shrink-0" aria-hidden />
              {formatDay(c.date_start)}
              {c.date_end && c.date_end !== c.date_start ? ` → ${formatDay(c.date_end)}` : ""}
            </p>
          )}
          {c.budget_global && <p>Budget {c.budget_global}</p>}
          {canEdit && total > 0 && (
            <p className={cn(ready < total && "font-medium text-foreground")}>
              {ready} annonce{ready > 1 ? "s" : ""} prête{ready > 1 ? "s" : ""} sur {total}
            </p>
          )}
          {lead && (
            <p className="flex items-center gap-1 text-foreground/80">
              <User className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{lead}</span>
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}
