"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { X } from "lucide-react";
import { AD_STATUS_LABEL } from "@/lib/types-ads";
import type { CampaignRow } from "@/components/ads/ads-views";

/**
 * Vue « Tableau » des campagnes — version réduite demandée par Mariam :
 * Campagne · Statut · Texte principal · Visuel. Pas de thématique, pas
 * de budget : la colonne « quand » se devine au nom et au statut.
 *
 * Clic sur le nom = ouvre la fiche. Clic sur le TEXTE (hook) ouvre
 * une popup lecture avec le texte en grand. Clic sur le VISUEL ouvre
 * une lightbox. On reprend la même interaction que le Planning pour
 * éviter d'apprendre deux chemins différents.
 */
type AdSetWithAds = {
  id: string;
  ads: {
    id: string;
    name: string | null;
    hook: string | null;
    visual_url: string | null;
  }[];
};

function statusTone(status: string): string {
  const text = "!text-foreground";
  switch (status) {
    case "live":
      return `bg-emerald-200 dark:bg-emerald-500/30 ${text}`;
    case "completed":
      return `bg-teal-200 dark:bg-teal-500/30 ${text}`;
    case "stopped":
      return `bg-rose-200 dark:bg-rose-500/30 ${text}`;
    case "approved":
      return `bg-amber-200 dark:bg-amber-500/30 ${text}`;
    case "scheduled":
      return `bg-violet-200 dark:bg-violet-500/30 ${text}`;
    default:
      return `bg-foreground/10 ${text}`;
  }
}

export function AdsTableView({
  campaigns,
  adSetsByCampaign = {},
}: {
  campaigns: CampaignRow[];
  adSetsByCampaign?: Record<string, AdSetWithAds[]>;
}) {
  // Popups : texte en grand ou visuel en lightbox.
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  const [reader, setReader] = React.useState<{
    title: string;
    body: string;
  } | null>(null);

  React.useEffect(() => {
    if (!lightbox && !reader) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setReader(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, reader]);

  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-foreground/15 bg-card p-8 text-center text-sm text-muted-foreground">
        Pas de campagne pour l&apos;instant.
      </p>
    );
  }

  const cols =
    "grid-cols-[minmax(220px,1.5fr)_140px_minmax(320px,2.5fr)_100px]";

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-foreground/10 bg-card">
        <div className="min-w-[820px]">
          <div
            className={`grid ${cols} gap-3 border-b border-foreground/10 bg-foreground/[0.03] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground`}
          >
            <div>Campagne</div>
            <div>Statut</div>
            <div>Texte principal</div>
            <div>Visuel</div>
          </div>
          {campaigns.map((c) => {
            const sets = adSetsByCampaign[c.id] ?? [];
            const firstAd = sets.flatMap((s) => s.ads)[0];
            const hook = firstAd?.hook?.trim() || "";
            const visual = firstAd?.visual_url || null;
            return (
              <div
                key={c.id}
                className={`grid ${cols} items-center gap-3 border-b border-foreground/5 px-4 py-3 text-sm last:border-b-0`}
              >
                {/* Colonne Campagne : clic ouvre la fiche. */}
                <Link
                  href={`/ads/${c.id}`}
                  className="truncate font-medium text-foreground hover:text-accent"
                >
                  {c.title || "Sans titre"}
                </Link>

                {/* Colonne Statut : pastille colorée. */}
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(c.status)}`}
                  >
                    {AD_STATUS_LABEL[c.status as keyof typeof AD_STATUS_LABEL] ??
                      c.status}
                  </span>
                </div>

                {/* Colonne Texte principal : clic ouvre une popup avec
                    le texte en entier. */}
                {hook ? (
                  <button
                    type="button"
                    onClick={() =>
                      setReader({
                        title: c.title || "Sans titre",
                        body: hook,
                      })
                    }
                    className="min-w-0 rounded-md p-1 text-start text-foreground/80 transition hover:bg-secondary/40 hover:text-foreground"
                    title="Lire le texte en entier"
                  >
                    <span
                      className="line-clamp-2 whitespace-pre-wrap"
                      dir="auto"
                    >
                      {hook}
                    </span>
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}

                {/* Colonne Visuel : clic ouvre la lightbox. */}
                {visual ? (
                  <button
                    type="button"
                    onClick={() => setLightbox(visual)}
                    className="relative size-16 shrink-0 overflow-hidden rounded-md transition hover:ring-2 hover:ring-accent"
                    title="Agrandir le visuel"
                    aria-label="Agrandir le visuel"
                  >
                    <Image
                      src={visual}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox visuel */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
          <div
            className="relative h-[88vh] w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 640px"
              className="object-contain"
            />
          </div>
        </div>
      )}

      {/* Popup lecture du texte principal */}
      {reader && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setReader(null)}
          role="dialog"
          aria-modal
        >
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold">{reader.title}</h2>
              <button
                type="button"
                onClick={() => setReader(null)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p
              dir="auto"
              className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/40 p-4 text-sm leading-relaxed text-foreground"
            >
              {reader.body}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
