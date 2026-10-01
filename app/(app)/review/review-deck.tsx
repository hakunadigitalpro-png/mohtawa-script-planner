"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, PartyPopper, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateFr } from "@/lib/utils";
import {
  clientStatusColor,
  clientStatusLabel,
  platformLabel,
  typeLabel,
} from "@/lib/constants";
import { reviewContent } from "./actions";

/** `Button` ne gère pas `asChild` dans ce projet — même motif qu'ailleurs. */
const LINK_BUTTON =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary";

export type ReviewItem = {
  id: string;
  title: string | null;
  type: string;
  date: string | null;
  platform: string | null;
  status: string;
  caption: string | null;
  visuals: { id: string; url: string }[];
  script: string | null;
};

export function ReviewDeck({
  items,
  startIndex,
}: {
  items: ReviewItem[];
  startIndex: number;
}) {
  const router = useRouter();
  // La file est figée à l'arrivée. `router.refresh()` après chaque décision
  // met à jour le reste de l'app (la bannière du calendrier, les badges),
  // mais s'il changeait aussi cette liste, l'index sauterait sur un autre
  // contenu entre le moment où le client valide et celui où il clique
  // « Suivant ».
  const [queue] = useState(() => items);
  const [index, setIndex] = useState(startIndex);
  const [done, setDone] = useState(false);
  const [decided, setDecided] = useState<Record<string, "approve" | "revise">>({});
  const [askingRevision, setAskingRevision] = useState(false);
  const [comment, setComment] = useState("");
  const [pickedVisual, setPickedVisual] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const item = queue[index];

  const pendingCount = useMemo(
    () =>
      queue.filter((i) => i.status === "pending_review" && !decided[i.id]).length,
    [queue, decided],
  );

  if (done || !item) {
    return <AllDone />;
  }

  const awaiting = item.status === "pending_review" && !decided[item.id];
  const myDecision = decided[item.id];

  /** Le prochain contenu qui attend encore une décision — sinon on reste. */
  const goNext = () => {
    const next = queue.findIndex(
      (i, n) => n > index && i.status === "pending_review" && !decided[i.id],
    );
    const fallback = queue.findIndex(
      (i) => i.status === "pending_review" && !decided[i.id],
    );
    const target = next >= 0 ? next : fallback;
    if (target >= 0) setIndex(target);
    else setDone(true);
    resetForm();
  };

  const resetForm = () => {
    setAskingRevision(false);
    setComment("");
    setPickedVisual(null);
    setError(null);
  };

  const decide = (decision: "approve" | "revise") => {
    setError(null);
    startTransition(async () => {
      const res = await reviewContent({
        contentId: item.id,
        decision,
        comment: decision === "revise" ? comment : undefined,
        mediaId: decision === "revise" ? (pickedVisual ?? undefined) : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDecided((d) => ({ ...d, [item.id]: decision }));
      resetForm();
      router.refresh();
    });
  };

  const remainingAfterThis = pendingCount - (awaiting ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Progression — un chiffre, jamais un reproche. Un contenu pas encore
          traité n'est pas un retard, c'est la file normale. */}
      {pendingCount > 0 && (
        <p className="text-sm font-medium text-muted">
          {pendingCount === 1
            ? "Un contenu attend ton avis."
            : `${pendingCount} contenus attendent ton avis.`}
        </p>
      )}

      <Card className="space-y-5 p-5 sm:p-6">
        {/* En-tête du contenu */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2
              dir="auto"
              className="text-xl font-bold leading-snug text-foreground"
            >
              {item.title || "Sans titre"}
            </h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              <span>{typeLabel(item.type)}</span>
              {item.platform && (
                <>
                  <span aria-hidden>·</span>
                  <span>{platformLabel(item.platform)}</span>
                </>
              )}
              {item.date && (
                <>
                  <span aria-hidden>·</span>
                  <span>{formatDateFr(item.date)}</span>
                </>
              )}
            </p>
          </div>
          <Badge
            className="text-white"
            style={{ background: clientStatusColor(myDecision ? (myDecision === "approve" ? "approved" : "needs_revision") : item.status) }}
          >
            {clientStatusLabel(
              myDecision
                ? myDecision === "approve"
                  ? "approved"
                  : "needs_revision"
                : item.status,
            )}
          </Badge>
        </div>

        {/* Les visuels. Cliquer une diapo, c'est dire « ma remarque porte
            sur celle-ci » — c'est la seule façon pour l'équipe de savoir
            quoi corriger sans deviner. */}
        {item.visuals.length > 0 && (
          <div className="space-y-2">
            {awaiting && item.visuals.length > 1 && (
              <p className="text-xs text-muted">
                Clique une diapo pour que ta remarque porte dessus.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {item.visuals.map((v, i) => {
                const picked = pickedVisual === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={!awaiting}
                    onClick={() => {
                      setPickedVisual(picked ? null : v.id);
                      if (!picked) setAskingRevision(true);
                    }}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border-2 bg-secondary/40 transition",
                      picked
                        ? "border-accent ring-2 ring-accent/30"
                        : "border-transparent",
                      awaiting && "cursor-pointer hover:border-accent/50",
                    )}
                    aria-pressed={picked}
                    aria-label={`Diapo ${i + 1}`}
                  >
                    {/* `h-auto w-full` laisse le navigateur appliquer le
                        vrai ratio une fois l'image chargée : les dimensions
                        déclarées ne servent qu'à réserver la place et à
                        calculer les tailles servies. Un carrousel 4:5 et une
                        infographie carrée s'affichent donc chacun correctement. */}
                    <Image
                      src={v.url}
                      alt={`Diapo ${i + 1}`}
                      width={1080}
                      height={1350}
                      sizes="(max-width: 640px) 100vw, 480px"
                      className="h-auto w-full"
                    />
                    <span
                      className={cn(
                        "absolute start-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold",
                        picked
                          ? "bg-accent text-accent-foreground"
                          : "bg-ink/70 text-white",
                      )}
                    >
                      {i + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* La légende : ce qui sera publié avec les visuels. */}
        {item.caption && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Légende
            </p>
            <p
              dir="auto"
              className="whitespace-pre-wrap rounded-2xl bg-secondary/40 p-4 text-sm leading-relaxed text-foreground"
            >
              {item.caption}
            </p>
          </div>
        )}

        {/* Les formats vidéo n'ont pas de visuel : c'est le script qu'on relit. */}
        {!item.visuals.length && item.script && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Script
            </p>
            <p
              dir="auto"
              className="whitespace-pre-wrap rounded-2xl bg-secondary/40 p-4 text-sm leading-relaxed text-foreground"
            >
              {item.script}
            </p>
          </div>
        )}

        {!item.visuals.length && !item.script && !item.caption && (
          <p className="rounded-2xl bg-secondary/40 p-4 text-sm text-muted">
            Ce contenu n&apos;a pas encore de visuel ni de texte à regarder.
          </p>
        )}
      </Card>

      {/* La zone de décision */}
      {awaiting ? (
        <Card className="space-y-4 p-5 sm:p-6">
          {askingRevision ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {pickedVisual
                    ? `Ta remarque sur la diapo ${
                        item.visuals.findIndex((v) => v.id === pickedVisual) + 1
                      }`
                    : "Qu'est-ce qu'il faut changer ?"}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                >
                  <X className="size-4" />
                  Annuler
                </Button>
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                dir="auto"
                autoFocus
                className="min-h-28 text-sm"
                placeholder="Par exemple : le titre est trop long, et la couleur de fond ne correspond pas à la charte."
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  disabled={pending || !comment.trim()}
                  onClick={() => decide("revise")}
                >
                  {pending ? "Envoi…" : "Envoyer ma remarque"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row-reverse">
              <Button
                type="button"
                variant="accent"
                size="lg"
                className="flex-1"
                disabled={pending}
                onClick={() => decide("approve")}
              >
                <Check className="size-4" />
                {pending ? "…" : "Je valide"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                disabled={pending}
                onClick={() => setAskingRevision(true)}
              >
                <MessageSquare className="size-4" />
                Je demande une modif&apos;
              </Button>
            </div>
          )}

          {error && (
            <p
              className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm font-medium text-foreground">
            {myDecision === "approve"
              ? "C'est validé. Merci !"
              : myDecision === "revise"
                ? "Ta remarque est partie à l'équipe."
                : "Ce contenu n'attend pas ton avis."}
          </p>
          {remainingAfterThis > 0 ? (
            <Button type="button" variant="accent" onClick={goNext}>
              Suivant
              {remainingAfterThis > 1 && ` (${remainingAfterThis})`}
            </Button>
          ) : (
            <Link href="/calendar" className={LINK_BUTTON}>
              Retour au calendrier
            </Link>
          )}
        </Card>
      )}
    </div>
  );
}

function AllDone() {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <PartyPopper className="size-8 text-accent" />
      <p className="text-lg font-bold text-foreground">
        Tout est passé en revue.
      </p>
      <p className="max-w-sm text-sm text-muted">
        Rien n&apos;attend ton avis pour le moment. On te prévient dès qu&apos;un
        nouveau contenu est prêt.
      </p>
      <Link href="/calendar" className={cn(LINK_BUTTON, "mt-1")}>
        Voir le calendrier
      </Link>
    </Card>
  );
}
