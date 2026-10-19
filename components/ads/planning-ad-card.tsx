"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { MessageCircle, X, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addAdCampaignTargetedComment } from "@/app/(app)/ads/actions";

export type TargetedComment = {
  id: string;
  body: string;
  created_at: string;
  author_email: string;
};

export type PlanningAdCard = {
  id: string;
  name: string | null;
  hook: string | null;
  visual_url: string | null;
  slides: { visual_url: string | null; text: string | null }[];
};

/**
 * Carte « Ad » cliquable pour le Planning : photo s'agrandit en
 * lightbox, texte s'ouvre dans une popup lecture + commentaires. Les
 * commentaires sont stockés par cible (migration 0066) : chaque photo
 * et chaque texte ont leur propre fil visible immédiatement.
 */
export function PlanningAdCard({
  campaignId,
  ad,
  commentsByTarget,
}: {
  campaignId: string;
  ad: PlanningAdCard;
  /** Clé = `${campaignId}:photo|text:${targetId}`. */
  commentsByTarget: Record<string, TargetedComment[]>;
}) {
  const [lightbox, setLightbox] = React.useState<string | null>(null);
  // Popup lecture-commentaires ouverte sur une cible donnée.
  const [open, setOpen] = React.useState<{
    kind: "photo" | "text";
    id: string;
    label: string;
    photo?: string | null;
    text?: string | null;
  } | null>(null);

  // Carrousel = la liste de slides ; sinon la carte unique (visuel + hook
  // sur l'ad). Chaque carte expose photo et texte éditables séparément.
  const cards =
    ad.slides.length > 0
      ? ad.slides.map((s, i) => ({
          slideIndex: i,
          targetId: ad.id, // on utilise l'id de l'ad + index pour slides sans id ici
          photoTargetId: ad.id, // fallback (une seule photo par ad)
          textTargetId: ad.id,
          photo: s.visual_url,
          text: s.text,
          isSlide: true,
          label: `Diapo ${i + 1}`,
        }))
      : [
          {
            slideIndex: 0,
            targetId: ad.id,
            photoTargetId: ad.id,
            textTargetId: ad.id,
            photo: ad.visual_url,
            text: ad.hook,
            isSlide: false,
            label: ad.name ?? "Ad",
          },
        ];

  const isCarousel = ad.slides.length > 0;
  const countFor = (type: "photo" | "text", id: string) =>
    (commentsByTarget[`${campaignId}:${type}:${id}`] ?? []).length;

  React.useEffect(() => {
    if (!lightbox && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setOpen(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, open]);

  return (
    <li className="space-y-2 rounded-lg bg-card p-2">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate font-semibold text-foreground">
          {ad.name ?? "Ad"}
        </span>
        {isCarousel && (
          <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-medium text-foreground/70">
            Carrousel · {cards.length} diapos
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {cards.map((card, ci) => {
          // Pour les slides, on compose un targetId unique par diapo
          // basé sur son index (les slides ne sont pas chargées avec
          // leur id dans le Planning — on cible via "adId:index").
          const photoId = card.isSlide ? `${ad.id}#${ci}` : card.photoTargetId;
          const textId = card.isSlide ? `${ad.id}#${ci}` : card.textTargetId;
          const photoCount = countFor("photo", photoId);
          const textCount = countFor("text", textId);
          return (
            <li key={ci} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => card.photo && setLightbox(card.photo)}
                className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md transition hover:ring-2 hover:ring-accent disabled:opacity-50"
                disabled={!card.photo}
                title="Agrandir la photo"
                aria-label="Agrandir la photo"
              >
                {card.photo ? (
                  <>
                    <Image
                      src={card.photo}
                      alt=""
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                    {photoCount > 0 && (
                      <span className="absolute end-1 top-1 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        <MessageCircle className="h-2.5 w-2.5" />
                        {photoCount}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="grid h-full w-full place-items-center bg-foreground/5 text-[9px] text-muted-foreground">
                    —
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() =>
                  setOpen({
                    kind: "text",
                    id: textId,
                    label: `${card.label} · texte`,
                    photo: card.photo,
                    text: card.text,
                  })
                }
                className="min-w-0 flex-1 rounded-md p-1 text-start transition hover:bg-secondary/40"
                title="Lire et commenter"
              >
                {card.isSlide && (
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Diapo {ci + 1}
                  </p>
                )}
                <p
                  className="line-clamp-3 whitespace-pre-wrap text-[11px] text-foreground/70"
                  dir="auto"
                >
                  {card.text?.trim() || (
                    <span className="text-muted-foreground">
                      Pas encore de texte
                    </span>
                  )}
                </p>
                {textCount > 0 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MessageCircle className="h-3 w-3" /> {textCount}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Lightbox pour la photo */}
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
            className="absolute end-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
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

      {/* Popup lecture + commentaires pour un texte */}
      {open && (
        <CommentDialog
          campaignId={campaignId}
          target={{ type: open.kind, id: open.id }}
          label={open.label}
          text={open.text ?? ""}
          existing={
            commentsByTarget[`${campaignId}:${open.kind}:${open.id}`] ?? []
          }
          onClose={() => setOpen(null)}
        />
      )}
    </li>
  );
}

function CommentDialog({
  campaignId,
  target,
  label,
  text,
  existing,
  onClose,
}: {
  campaignId: string;
  target: { type: "photo" | "text"; id: string };
  label: string;
  text: string;
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
          <h2 className="text-base font-semibold">{label}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {text ? (
          <p
            dir="auto"
            className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-xl bg-secondary/40 p-3 text-sm leading-relaxed text-foreground"
          >
            {text}
          </p>
        ) : (
          <p className="rounded-xl bg-secondary/40 p-3 text-xs italic text-muted-foreground">
            Pas de texte sur cette carte.
          </p>
        )}

        <div className="flex-1 overflow-y-auto">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Commentaires
          </h3>
          {existing.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              Pas encore de commentaire.
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
