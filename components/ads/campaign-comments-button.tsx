"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MessageCircle, X, Send } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { addAdCampaignTargetedComment } from "@/app/(app)/ads/actions";
import type { TargetedComment } from "@/components/ads/planning-ad-card";

/**
 * Bouton « Commentaires de la campagne » : s'ouvre en popup au clic.
 * Même composant pour les remarques globales (target null) ; les
 * remarques ciblées restent gérées par `PlanningAdCard`.
 */
export function CampaignCommentsButton({
  campaignId,
  campaignTitle,
  comments,
}: {
  campaignId: string;
  campaignTitle: string;
  comments: TargetedComment[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-card px-2 py-0.5 text-xs font-medium text-foreground/80 transition hover:border-accent/40 hover:text-accent"
        title="Commentaires de toute la campagne"
      >
        <MessageCircle className="h-3 w-3" />
        {comments.length}
      </button>
      {open && (
        <CampaignCommentDialog
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          existing={comments}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function CampaignCommentDialog({
  campaignId,
  campaignTitle,
  existing,
  onClose,
}: {
  campaignId: string;
  campaignTitle: string;
  existing: TargetedComment[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      // target null = commentaire global à la campagne.
      const res = await addAdCampaignTargetedComment(campaignId, body, null);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setDraft("");
      router.refresh();
    });
  };

  // Portal : la popup est montée au niveau de <body>, donc elle n'est
  // plus un enfant DOM du <Link> parent (la carte campagne). Sans ça,
  // chaque clic dans la popup bubble jusqu'au Link et navigue vers la
  // fiche campagne — y compris le clic pour poser le curseur dans la
  // textarea. stopPropagation est quand même gardé par ceinture-bretelles
  // au cas où un ancêtre React (hors du Link) écouterait aussi.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Sur toute la campagne
            </p>
            <h2 className="text-base font-semibold">{campaignTitle}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
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
    </div>,
    document.body,
  );
}
