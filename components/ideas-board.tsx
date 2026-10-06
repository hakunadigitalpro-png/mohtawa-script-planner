"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, Lightbulb, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CONTENT_TYPES,
  platformsForType,
  platformLabel,
  typeColor,
  typeLabel,
} from "@/lib/constants";
import { createIdea, moveIdea, scheduleIdea, type IdeaLane } from "@/app/(app)/calendar/ideas-actions";

const DRAG_MIME = "application/x-kreatly-idea";

export type IdeaCard = {
  id: string;
  title: string | null;
  type: string | null;
  pillar: string | null;
  status: string;
  /** L'angle, quand il a été écrit ou importé (0055). */
  notes?: string | null;
};

const LANES: { key: IdeaLane; label: string; hint: string }[] = [
  { key: "idea", label: "À trier", hint: "Tout ce qui tombe" },
  { key: "selected", label: "Retenues", hint: "Validées ensemble" },
  { key: "writing", label: "En écriture", hint: "On développe" },
];

/** La colonne où tombe un contenu, déduite de son statut réel. */
function laneOf(status: string): IdeaLane {
  if (status === "idea") return "idea";
  if (status === "selected") return "selected";
  return "writing";
}

export function IdeasBoard({ ideas }: { ideas: IdeaCard[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [over, setOver] = useState<IdeaLane | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Carte en cours de planification — ouvre le dialogue format + plateforme + date.
  const [scheduling, setScheduling] = useState<IdeaCard | null>(null);
  // Carte à qui il manque un format pour passer « En écriture ».
  const [needsFormat, setNeedsFormat] = useState<IdeaCard | null>(null);

  const byLane = useMemo(() => {
    const map: Record<IdeaLane, IdeaCard[]> = {
      idea: [],
      selected: [],
      writing: [],
    };
    for (const i of ideas) map[laneOf(i.status)].push(i);
    return map;
  }, [ideas]);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setError(null);
    setDraft(""); // on vide tout de suite : on en enchaîne souvent plusieurs
    startTransition(async () => {
      const res = await createIdea(title);
      if (!res.ok) {
        setError(res.error);
        setDraft(title);
        return;
      }
      router.refresh();
    });
  };

  const drop = (lane: IdeaLane, card: IdeaCard) => {
    if (laneOf(card.status) === lane) return;
    // Passer en écriture sans format : on demande le format plutôt que de
    // refuser. Le geste de l'utilisatrice est clair, c'est la donnée qui manque.
    if (lane === "writing" && !card.type) {
      setNeedsFormat(card);
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await moveIdea(card.id, lane);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {/* Saisie rapide : en atelier, on enchaîne les idées à la voix. Entrée
          valide et laisse le curseur en place pour la suivante. */}
      <div className="flex flex-wrap gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          dir="auto"
          placeholder="Une idée en une phrase…"
          aria-label="Nouvelle idée"
          className="min-w-56 flex-1"
        />
        <Button
          type="button"
          variant="accent"
          onClick={add}
          disabled={pending || !draft.trim()}
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      {error && (
        <p
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {LANES.map((lane) => {
          const cards = byLane[lane.key];
          return (
            <section
              key={lane.key}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes(DRAG_MIME)) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== lane.key) setOver(lane.key);
                }
              }}
              onDragLeave={() => {
                if (over === lane.key) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const raw = e.dataTransfer.getData(DRAG_MIME);
                if (!raw) return;
                try {
                  drop(lane.key, JSON.parse(raw) as IdeaCard);
                } catch {
                  /* données de glissement illisibles : on ignore */
                }
              }}
              className={cn(
                "rounded-3xl border bg-card/60 p-3 transition-colors",
                over === lane.key
                  ? "border-accent bg-accent/5"
                  : "border-border/60",
              )}
            >
              <header className="mb-3 px-1">
                <h3 className="flex items-baseline gap-2 text-sm font-bold">
                  {lane.label}
                  <span className="text-xs font-semibold tabular-nums text-muted">
                    {cards.length}
                  </span>
                </h3>
                <p className="text-xs text-muted">{lane.hint}</p>
              </header>

              <ul className="space-y-2">
                {cards.map((card) => (
                  <li key={card.id}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData(DRAG_MIME, JSON.stringify(card));
                      }}
                      className="group cursor-grab rounded-2xl border border-border/60 bg-card p-3 transition-colors hover:border-border active:cursor-grabbing"
                    >
                      <Link
                        href={`/content/${card.id}`}
                        dir="auto"
                        className="block break-words text-sm font-semibold leading-snug text-foreground hover:underline"
                      >
                        {card.title || "Sans titre"}
                      </Link>

                      {card.notes?.trim() && (
                        <p
                          dir="auto"
                          className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted"
                        >
                          {card.notes}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {card.type ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-foreground/70"
                            style={{ background: `${typeColor(card.type)}22` }}
                          >
                            {typeLabel(card.type)}
                          </span>
                        ) : (
                          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted">
                            Format à choisir
                          </span>
                        )}
                        {card.pillar && (
                          <span className="max-w-full truncate rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium text-foreground/70">
                            {card.pillar}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setScheduling(card)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
                      >
                        <CalendarPlus className="size-3.5" />
                        Planifier
                      </button>
                    </div>
                  </li>
                ))}

                {cards.length === 0 && (
                  <li className="rounded-2xl border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted">
                    {lane.key === "idea"
                      ? "Note ta première idée au-dessus."
                      : "Fais glisser une carte ici."}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {ideas.length === 0 && (
        <p className="flex items-start gap-2.5 rounded-2xl bg-secondary/40 px-4 py-3 text-sm text-muted">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
          Tout ce qui n&apos;a pas encore de date vit ici. Dès que tu en
          planifies une, elle part dans le calendrier — et revient ici si tu lui
          retires sa date.
        </p>
      )}

      <ScheduleDialog
        card={scheduling}
        onClose={() => setScheduling(null)}
        onDone={() => {
          setScheduling(null);
          router.refresh();
        }}
      />
      <FormatDialog
        card={needsFormat}
        onClose={() => setNeedsFormat(null)}
        onDone={() => {
          setNeedsFormat(null);
          router.refresh();
        }}
      />
    </div>
  );
}

/**
 * Planifier : format, plateforme et date d'un seul geste.
 *
 * Les trois vont ensemble et ce n'est pas un choix d'ergonomie — la date vit
 * sur une publication, qui exige une plateforme, laquelle dépend du format.
 */
function ScheduleDialog({
  card,
  onClose,
  onDone,
}: {
  card: IdeaCard | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState("");
  const [platform, setPlatform] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveType = card?.type ?? type;
  const platforms = platformsForType(effectiveType || null);

  const submit = () => {
    if (!card) return;
    setError(null);
    startTransition(async () => {
      const res = await scheduleIdea({
        contentId: card.id,
        type: card.type ? undefined : type,
        platform,
        date,
        time: time || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setType("");
      setPlatform("");
      setDate("");
      setTime("");
      onDone();
    });
  };

  return (
    <Dialog open={Boolean(card)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Planifier cette idée</DialogTitle>
          <DialogDescription>
            Elle quittera les idées pour rejoindre ton calendrier.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!card?.type && (
            <div className="space-y-1.5">
              <Label htmlFor="sched-type">Format</Label>
              <Select
                id="sched-type"
                value={type}
                onValueChange={(v) => {
                  setType(v);
                  setPlatform(""); // les plateformes dépendent du format
                }}
                placeholder="Choisis un format"
                options={CONTENT_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
              <p className="text-xs text-muted">
                Une fois choisi, le format ne change plus.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sched-platform">Plateforme</Label>
            <Select
              id="sched-platform"
              value={platform}
              onValueChange={setPlatform}
              placeholder={
                effectiveType ? "Choisis une plateforme" : "Choisis d'abord un format"
              }
              options={platforms.map((p) => ({
                value: p.value,
                label: platformLabel(p.value),
              }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sched-date">Date</Label>
              <Input
                id="sched-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sched-time">Heure (optionnel)</Label>
              <Input
                id="sched-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={pending || !platform || !date || (!card?.type && !type)}
          >
            {pending ? "Un instant…" : "Planifier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Le format manquant, demandé au moment où l'on commence à écrire — plutôt
 * que de refuser le glissement avec un message.
 */
function FormatDialog({
  card,
  onClose,
  onDone,
}: {
  card: IdeaCard | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [type, setType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!card || !type) return;
    setError(null);
    startTransition(async () => {
      // On passe par la planification sans date ? Non : ici on ne fait que
      // poser le format puis déplacer la carte. Deux actions, mais la seconde
      // ne peut pas réussir sans la première.
      const { setContentFormat } = await import("@/app/(app)/contents/actions");
      const posed = await setContentFormat(card.id, type);
      if (posed && "error" in posed && posed.error) {
        setError(posed.error);
        return;
      }
      const moved = await moveIdea(card.id, "writing");
      if (!moved.ok) {
        setError(moved.error);
        return;
      }
      setType("");
      onDone();
    });
  };

  return (
    <Dialog open={Boolean(card)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Quel format ?</DialogTitle>
          <DialogDescription>
            C&apos;est lui qui décide de l&apos;éditeur : un script pour une
            vidéo, des visuels et une légende pour un carrousel.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Select
            id="lane-type"
            value={type}
            onValueChange={setType}
            placeholder="Choisis un format"
            options={CONTENT_TYPES.map((t) => ({
              value: t.value,
              label: t.label,
            }))}
          />
          {error && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={submit}
            disabled={pending || !type}
          >
            {pending ? "Un instant…" : "Commencer à écrire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
