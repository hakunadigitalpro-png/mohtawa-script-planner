"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MessageSquare, PartyPopper, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ColorDot } from "@/components/ui/badge";
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

/** La clé du brouillon qui ne vise aucun visuel en particulier. */
const OVERALL = "__overall__";

/** Une remarque déjà écrite — la sienne, ou la réponse de l'équipe. */
export type ReviewNote = {
  id: string;
  /** Null : elle porte sur l'ensemble du contenu. */
  mediaId: string | null;
  body: string;
  mine: boolean;
  createdAt: string;
};

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
  notes: ReviewNote[];
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
  // Les brouillons, par visuel. Une entrée par diapo commentée, plus
  // éventuellement `OVERALL` pour un mot sur l'ensemble.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  // Un message d'aide n'est PAS une erreur : il a cliqué le bon bouton, il
  // manque juste une phrase. Les deux étaient confondus, donc habillés en
  // rouge — on reprochait au client de ne pas avoir deviné.
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // QUEL bouton attend. Un booléen partagé faisait clignoter « … » sur
  // « Je valide » alors qu'on venait de cliquer « Je demande une modif' ».
  const [inFlight, setInFlight] = useState<"approve" | "revise" | null>(null);
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
  const many = item.visuals.length > 1;
  const shownStatus = myDecision
    ? myDecision === "approve"
      ? "approved"
      : "needs_revision"
    : item.status;

  const written = Object.entries(drafts).filter(([, v]) => v.trim().length > 0);

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
    setDrafts({});
    setOpenKey(null);
    setHint(null);
    setError(null);
    setInFlight(null);
  };

  const setDraft = (key: string, value: string) =>
    setDrafts((d) => ({ ...d, [key]: value }));

  const decide = (decision: "approve" | "revise") => {
    setHint(null);
    setError(null);

    // Demander une modification sans dire laquelle laisse l'équipe sans rien
    // à corriger. Plutôt qu'un refus, on ouvre le champ qui manque et on dit
    // ce qui va se passer.
    if (decision === "revise" && written.length === 0) {
      setOpenKey(OVERALL);
      setHint(
        many
          ? "Écris ce qu'il faut changer — sur une diapo, ou sur l'ensemble — puis renvoie-le-nous."
          : "Écris ce qu'il faut changer, puis renvoie-le-nous.",
      );
      return;
    }

    setInFlight(decision);
    startTransition(async () => {
      const res = await reviewContent({
        contentId: item.id,
        decision,
        notes: written.map(([key, body]) => ({
          mediaId: key === OVERALL ? null : key,
          body,
        })),
      });
      if (!res.ok) {
        setInFlight(null);
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
          {/* La couleur du statut est un REPÈRE, pas un support de texte :
              « À valider » en blanc sur l'ambre `#fbbf24` tombait à 1,7:1,
              c'est-à-dire deviné plutôt que lu. Même motif que le calendrier
              — une pastille, et le libellé en texte normal. */}
          <span className="inline-flex shrink-0 items-center gap-2">
            <ColorDot color={clientStatusColor(shownStatus)} />
            <span className="text-sm font-semibold text-foreground">
              {clientStatusLabel(shownStatus)}
            </span>
          </span>
        </div>

        {/* Les visuels, chacun avec son fil. Une remarque par diapo : sur un
            carrousel, « le titre de la 1 est trop long » et « la couleur de
            la 4 n'est pas la charte » ne tenaient pas dans la même phrase. */}
        {item.visuals.length > 0 && (
          <div className="space-y-3">
            {awaiting && many && (
              <p className="text-sm text-muted">
                Tu peux laisser une remarque sur chaque diapo.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {item.visuals.map((v, i) => (
                <VisualCard
                  key={v.id}
                  url={v.url}
                  number={many ? i + 1 : null}
                  notes={item.notes.filter((n) => n.mediaId === v.id)}
                  draft={drafts[v.id] ?? ""}
                  open={openKey === v.id}
                  editable={awaiting}
                  pending={pending}
                  onToggle={() => setOpenKey(openKey === v.id ? null : v.id)}
                  onDraft={(value) => setDraft(v.id, value)}
                />
              ))}
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

        {/* Le mot sur l'ensemble : ce qui ne vise aucune diapo en particulier,
            et le seul endroit possible quand il n'y a pas de visuel du tout. */}
        <NoteBlock
          title={
            item.visuals.length > 0 ? "Sur l'ensemble" : "Ta remarque"
          }
          notes={item.notes.filter((n) => n.mediaId === null)}
          draft={drafts[OVERALL] ?? ""}
          open={openKey === OVERALL}
          editable={awaiting}
          pending={pending}
          addLabel={
            item.visuals.length > 0
              ? "Un mot sur l'ensemble"
              : "Écrire une remarque"
          }
          placeholder="Par exemple : le ton est bon, mais la dernière phrase est à raccourcir."
          onToggle={() => setOpenKey(openKey === OVERALL ? null : OVERALL)}
          onDraft={(value) => setDraft(OVERALL, value)}
        />
      </Card>

      {/* La zone de décision */}
      {awaiting ? (
        /* Collante sur téléphone : un carrousel de dix diapos fait cinq
           écrans de haut, et la décision se retrouvait tout en bas — on
           faisait défiler des images sans jamais voir qu'on nous demandait
           quelque chose. `bottom-16` dégage la barre d'onglets. */
        <Card className="sticky bottom-16 z-30 space-y-3 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] max-md:bg-card max-md:shadow-lift sm:p-6 md:static md:pb-6">
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
              {inFlight === "approve" ? "Envoi…" : "Je valide"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              disabled={pending}
              onClick={() => decide("revise")}
            >
              <MessageSquare className="size-4" />
              {inFlight === "revise" ? "Envoi…" : "Je demande une modif'"}
            </Button>
          </div>

          {/* Ses remarques partent avec les deux décisions : valider en
              disant « parfait, la 3 est ma préférée » ne doit pas obliger à
              demander une modification dont il ne veut pas. C'est la phrase
              qui rassure, elle n'a rien à faire en gris pâle. */}
          {written.length > 0 && (
            <p className="text-sm font-semibold text-foreground">
              {written.length === 1
                ? "Ta remarque partira avec ta réponse."
                : `Tes ${written.length} remarques partiront avec ta réponse.`}
            </p>
          )}

          {hint && (
            <p
              className="rounded-2xl border border-border bg-secondary/60 px-4 py-3 text-sm text-foreground"
              role="status"
            >
              {hint}
            </p>
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
                ? "Ta réponse est partie à l'équipe."
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

/** Une diapo : l'image, ce qui s'est déjà dit dessus, et de quoi ajouter. */
function VisualCard({
  url,
  number,
  notes,
  draft,
  open,
  editable,
  pending,
  onToggle,
  onDraft,
}: {
  url: string;
  /** Null quand le contenu n'a qu'un visuel : « Diapo 1 » n'y veut rien dire. */
  number: number | null;
  notes: ReviewNote[];
  draft: string;
  open: boolean;
  editable: boolean;
  pending: boolean;
  onToggle: () => void;
  onDraft: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
        {/* `h-auto w-full` laisse le navigateur appliquer le vrai ratio une
            fois l'image chargée : les dimensions déclarées ne servent qu'à
            réserver la place et à calculer les tailles servies. Un carrousel
            4:5 et une infographie carrée s'affichent donc chacun bien. */}
        <Image
          src={url}
          alt={number ? `Diapo ${number}` : "Le visuel"}
          width={1080}
          height={1350}
          sizes="(max-width: 640px) 100vw, 480px"
          className="h-auto w-full"
        />
        {number !== null && (
          <span className="absolute start-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-bold text-white">
            {number}
          </span>
        )}
      </div>

      <NoteBlock
        notes={notes}
        draft={draft}
        open={open}
        editable={editable}
        pending={pending}
        addLabel={number ? `Commenter la diapo ${number}` : "Commenter"}
        placeholder={
          number
            ? `Ce qu'il faut changer sur la diapo ${number}…`
            : "Ce qu'il faut changer…"
        }
        onToggle={onToggle}
        onDraft={onDraft}
      />
    </div>
  );
}

/**
 * Le fil d'une cible : les messages déjà échangés, puis de quoi en ajouter un.
 *
 * Les réponses de l'équipe s'affichent ICI, à côté de ce qu'elles répondent.
 * Avant, le client recevait une notification « on t'a répondu » qui le
 * ramenait sur cette page — où rien ne s'affichait.
 */
function NoteBlock({
  title,
  notes,
  draft,
  open,
  editable,
  pending,
  addLabel,
  placeholder,
  onToggle,
  onDraft,
}: {
  title?: string;
  notes: ReviewNote[];
  draft: string;
  open: boolean;
  editable: boolean;
  pending: boolean;
  addLabel: string;
  placeholder: string;
  onToggle: () => void;
  onDraft: (value: string) => void;
}) {
  // Rien à lire et rien à écrire : on n'affiche pas un cadre vide.
  if (!editable && notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {title && notes.length > 0 && (
        <p className="text-xs font-bold uppercase tracking-wider text-muted">
          {title}
        </p>
      )}

      {notes.map((n) => (
        <div
          key={n.id}
          dir="auto"
          // Qui parle se lit à la FORME, pas à la couleur : ce qui vient de
          // l'équipe est décalé et porte un filet, ce qu'il a écrit lui-même
          // reste à plat. C'est le message NOUVEAU qui doit peser — pas le
          // sien, qu'il connaît déjà. Et ça tient dans les deux thèmes,
          // là où deux fonds voisins se confondaient en sombre.
          className={cn(
            "text-sm leading-relaxed text-foreground",
            n.mine
              ? "px-0.5"
              : "ms-4 rounded-e-2xl border-s-2 border-border bg-secondary px-3.5 py-2.5",
          )}
        >
          <p
            className={cn(
              "mb-0.5 text-xs font-semibold",
              n.mine ? "text-muted" : "text-foreground",
            )}
          >
            {n.mine ? "Toi" : "L'équipe"}
          </p>
          <p className="whitespace-pre-wrap">{n.body}</p>
        </div>
      ))}

      {editable &&
        (open ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => onDraft(e.target.value)}
              dir="auto"
              autoFocus
              disabled={pending}
              className="min-h-20 text-sm"
              placeholder={placeholder}
            />
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-foreground"
            >
              <X className="size-3" />
              Replier
            </button>
          </div>
        ) : draft.trim() ? (
          // Une remarque écrite puis repliée doit rester visible : sinon on
          // envoie sans savoir qu'elle part.
          // Volontairement SANS orange : il y en aurait un par diapo
          // commentée, et l'orange serait dépensé sur ce qui est déjà fait
          // plutôt que sur ce qu'il reste à faire. Le seul orange de l'écran
          // est « Je valide ».
          <button
            type="button"
            onClick={onToggle}
            dir="auto"
            className="block w-full rounded-2xl border border-border bg-secondary/60 px-3.5 py-2.5 text-start text-sm leading-relaxed text-foreground transition hover:border-foreground/25"
          >
            <span className="mb-0.5 block text-xs font-semibold text-muted">
              Ta remarque — modifier
            </span>
            <span className="line-clamp-3 whitespace-pre-wrap">{draft}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary"
          >
            <MessageSquare className="size-3.5" />
            {addLabel}
          </button>
        ))}
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
