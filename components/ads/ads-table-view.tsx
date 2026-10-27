"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AD_STATUS_LABEL } from "@/lib/types-ads";
import { addAdCampaignTargetedComment } from "@/app/(app)/ads/actions";
import type { CampaignRow } from "@/components/ads/ads-views";

/**
 * Vue « Tableau » des campagnes — 4 colonnes seulement :
 * Campagne · Statut · Texte principal · Visuel. Clic sur le texte OU
 * sur le visuel ouvre une popup commune avec : l'aperçu, la liste des
 * remarques déjà posées sur CETTE cible (plan 0066), et une zone pour
 * en poster une nouvelle. Même pattern que planning-ad-card, pour que
 * les remarques du Tableau et du Planning soient une seule et même
 * discussion visible dans les deux vues.
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

type TargetedComment = {
  id: string;
  body: string;
  created_at: string;
  author_email: string;
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
  commentsByTarget = {},
}: {
  campaigns: CampaignRow[];
  adSetsByCampaign?: Record<string, AdSetWithAds[]>;
  /** Clé : `${campaignId}:photo|text:${adId}#0` — identique au Planning. */
  commentsByTarget?: Record<string, TargetedComment[]>;
}) {
  // Popup ouverte sur une cible donnée : affiche l'aperçu + les remarques.
  const [open, setOpen] = React.useState<{
    campaignId: string;
    kind: "photo" | "text";
    targetId: string;
    title: string;
    photo?: string | null;
    text?: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-foreground/15 bg-card p-8 text-center text-sm text-muted-foreground">
        Pas de campagne pour l&apos;instant.
      </p>
    );
  }

  const cols =
    "grid-cols-[minmax(220px,1.5fr)_140px_minmax(320px,2.5fr)_100px]";

  const countFor = (campaignId: string, type: "photo" | "text", id: string) =>
    (commentsByTarget[`${campaignId}:${type}:${id}`] ?? []).length;

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
            // Même convention de target que le Planning (0066) : chaque
            // ad porte ses commentaires sur `${adId}#0` (index 0 = l'ad
            // sans carrousel, sinon la 1re diapo).
            const targetId = firstAd ? `${firstAd.id}#0` : "";
            const textCount = targetId ? countFor(c.id, "text", targetId) : 0;
            const photoCount = targetId ? countFor(c.id, "photo", targetId) : 0;
            return (
              <div
                key={c.id}
                className={`grid ${cols} items-center gap-3 border-b border-foreground/5 px-4 py-3 text-sm last:border-b-0`}
              >
                <Link
                  href={`/ads/${c.id}`}
                  className="truncate font-medium text-foreground hover:text-accent"
                >
                  {c.title || "Sans titre"}
                </Link>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(c.status)}`}
                  >
                    {AD_STATUS_LABEL[c.status as keyof typeof AD_STATUS_LABEL] ??
                      c.status}
                  </span>
                </div>

                {/* Colonne Texte : clic → popup lecture + commentaires. */}
                {hook && firstAd ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpen({
                        campaignId: c.id,
                        kind: "text",
                        targetId,
                        title: `${c.title || "Sans titre"} · texte`,
                        text: hook,
                        photo: visual,
                      })
                    }
                    className="relative min-w-0 rounded-md p-1 text-start text-foreground/80 transition hover:bg-secondary/40 hover:text-foreground"
                    title="Lire et commenter"
                  >
                    <span
                      className="line-clamp-2 whitespace-pre-wrap"
                      dir="auto"
                    >
                      {hook}
                    </span>
                    {textCount > 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MessageCircle className="h-3 w-3" /> {textCount}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}

                {/* Colonne Visuel : clic → popup aperçu + commentaires. */}
                {visual && firstAd ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpen({
                        campaignId: c.id,
                        kind: "photo",
                        targetId,
                        title: `${c.title || "Sans titre"} · visuel`,
                        text: hook,
                        photo: visual,
                      })
                    }
                    className="relative size-16 shrink-0 overflow-hidden rounded-md transition hover:ring-2 hover:ring-accent"
                    title="Agrandir et commenter"
                    aria-label="Agrandir et commenter"
                  >
                    <Image
                      src={visual}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                    {photoCount > 0 && (
                      <span className="absolute end-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {photoCount}
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {open && (
        <CommentDialog
          campaignId={open.campaignId}
          target={{ type: open.kind, id: open.targetId }}
          title={open.title}
          photo={open.photo ?? null}
          text={open.text ?? null}
          existing={
            commentsByTarget[`${open.campaignId}:${open.kind}:${open.targetId}`] ?? []
          }
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/**
 * Popup lecture + commentaires sur une cible (photo ou texte). Même
 * pattern que planning-ad-card : affiche l'aperçu, la liste des
 * commentaires existants, et un formulaire d'envoi.
 */
function CommentDialog({
  campaignId,
  target,
  title,
  photo,
  text,
  existing,
  onClose,
}: {
  campaignId: string;
  target: { type: "photo" | "text"; id: string };
  title: string;
  photo: string | null;
  text: string | null;
  existing: TargetedComment[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      const res = await addAdCampaignTargetedComment(campaignId, body, target);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {target.type === "photo" && photo ? (
          <div className="relative mx-auto h-72 w-full max-w-md overflow-hidden rounded-xl bg-black">
            <Image src={photo} alt="" fill sizes="400px" className="object-contain" />
          </div>
        ) : text ? (
          <p
            dir="auto"
            className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-sm leading-relaxed text-foreground"
          >
            {text}
          </p>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Remarques
          </h3>
          {existing.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              Pas encore de remarque.
            </p>
          ) : (
            <ul className="space-y-2">
              {existing.map((c) => (
                <li
                  key={c.id}
                  className="rounded-xl border border-foreground/10 bg-card p-2 text-sm"
                >
                  <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.author_email}
                  </p>
                  <p className="whitespace-pre-wrap text-foreground/80" dir="auto">
                    {c.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ta remarque…"
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="accent"
              onClick={send}
              disabled={pending || !draft.trim()}
            >
              <Send className="h-4 w-4" />
              Envoyer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
