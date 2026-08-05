"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { platformsForType } from "@/lib/constants";
import {
  addPublication,
  removePublication,
  updatePublication,
} from "@/app/(app)/contents/actions";
import type { ContentPublication } from "@/lib/types";

/**
 * Éditeur multi-plateformes côté PLANIFICATION (Idée 10, migration 0020).
 *
 * Plan tab uniquement — sert à programmer où la vidéo va sortir. Une ligne
 * par plateforme : plateforme (read-only) + date prévue + delete.
 *
 * L'URL de la vidéo en ligne ne vit PAS ici (la vidéo n'existe pas encore
 * au stade planning). Elle est gérée séparément dans l'onglet Performance
 * via <PerformancePublications />, une fois la vidéo publiée.
 *
 * Actions atomiques : auto-save sur blur, pas intégrées au form parent.
 */
export function PublicationsEditor({
  contentId,
  contentType,
  publications,
}: {
  contentId: string;
  contentType: string;
  publications: ContentPublication[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(false);

  const usedPlatforms = new Set(publications.map((p) => p.platform));
  const availablePlatforms = platformsForType(contentType).filter(
    (p) => !usedPlatforms.has(p.value),
  );

  const handleRemove = (publicationId: string) => {
    startTransition(async () => {
      await removePublication(publicationId, contentId);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Globe className="size-4 text-muted" />
        <Label className="text-sm font-semibold">Publications</Label>
        <span className="text-[10px] text-muted">
          · Une vidéo peut sortir sur plusieurs plateformes à des dates différentes
        </span>
      </div>

      {publications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted">
          Aucune plateforme programmée. Clique sur « Ajouter » pour en
          associer une.
        </div>
      ) : (
        <ul className="space-y-2">
          {publications.map((pub) => (
            <PublicationRow
              key={pub.id}
              publication={pub}
              contentId={contentId}
              onRemove={() => handleRemove(pub.id)}
              removeDisabled={pending}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        disabled={availablePlatforms.length === 0 || pending}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-2xl",
          "border-2 border-dashed border-border/60 px-4 py-2.5 text-sm font-semibold text-muted transition",
          "hover:border-accent/60 hover:bg-accent/5 hover:text-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        title={
          availablePlatforms.length === 0
            ? "Toutes les plateformes compatibles sont déjà associées."
            : "Ajouter une plateforme de publication"
        }
      >
        <Plus className="size-4" />
        {availablePlatforms.length === 0
          ? "Toutes les plateformes sont associées"
          : "Ajouter une plateforme"}
      </button>

      <AddPublicationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contentId={contentId}
        availablePlatforms={availablePlatforms}
      />
    </div>
  );
}

/** Une ligne dans la liste — plateforme + date + heure prévues + delete. */
function PublicationRow({
  publication,
  contentId,
  onRemove,
  removeDisabled,
}: {
  publication: ContentPublication;
  contentId: string;
  onRemove: () => void;
  removeDisabled: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();

  // État local pour permettre d'éditer sans flicker avant le save.
  const [date, setDate] = React.useState(publication.scheduled_date ?? "");
  // Le time input attend "HH:MM" — on tronque le "HH:MM:SS" renvoyé par Postgres.
  const [time, setTime] = React.useState(
    publication.scheduled_time?.slice(0, 5) ?? "",
  );

  // Resync si les props changent (server refresh après autre modif)
  React.useEffect(() => {
    setDate(publication.scheduled_date ?? "");
  }, [publication.scheduled_date]);
  React.useEffect(() => {
    setTime(publication.scheduled_time?.slice(0, 5) ?? "");
  }, [publication.scheduled_time]);

  const saveDate = (next: string) => {
    if ((publication.scheduled_date ?? "") === next) return;
    startTransition(async () => {
      await updatePublication(
        publication.id,
        { scheduled_date: next || null },
        contentId,
      );
      router.refresh();
    });
  };

  const saveTime = (next: string) => {
    if ((publication.scheduled_time?.slice(0, 5) ?? "") === next) return;
    startTransition(async () => {
      await updatePublication(
        publication.id,
        { scheduled_time: next || null },
        contentId,
      );
      router.refresh();
    });
  };

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="inline-flex shrink-0 items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold capitalize text-accent">
          {publication.platform}
        </span>

        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => saveDate(date)}
          className="h-9 flex-1 text-sm sm:max-w-44"
          aria-label={`Date de publication sur ${publication.platform}`}
        />

        <Input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => saveTime(time)}
          className="h-9 flex-1 text-sm sm:max-w-32"
          aria-label={`Heure de publication sur ${publication.platform}`}
        />

        <span className="flex-1 text-[10px] text-muted sm:text-right">
          L&apos;URL de la vidéo se renseigne après publication, dans l&apos;onglet
          Performance.
        </span>

        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
          aria-label={`Retirer ${publication.platform}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </li>
  );
}

function AddPublicationDialog({
  open,
  onOpenChange,
  contentId,
  availablePlatforms,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contentId: string;
  availablePlatforms: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [platform, setPlatform] = React.useState(
    availablePlatforms[0]?.value ?? "",
  );
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [scheduledTime, setScheduledTime] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Resync la valeur par défaut quand la liste change (nouvelles options dispo)
  React.useEffect(() => {
    if (open && availablePlatforms.length > 0) {
      setPlatform(availablePlatforms[0].value);
      setScheduledDate("");
      setScheduledTime("");
      setError(null);
    }
  }, [open, availablePlatforms]);

  const handleAdd = () => {
    if (!platform) return;
    setError(null);
    startTransition(async () => {
      const res = await addPublication({
        contentId,
        platform,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une plateforme</DialogTitle>
          <DialogDescription>
            Sélectionne la plateforme et indique sa date de publication
            prévue. Tu pourras ajouter l&apos;URL plus tard.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="add-pub-platform">Plateforme</Label>
            <Select
              id="add-pub-platform"
              value={platform}
              onValueChange={setPlatform}
              options={availablePlatforms}
              placeholder="—"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="add-pub-date">Date (optionnel)</Label>
              <Input
                id="add-pub-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-pub-time">Heure (optionnel)</Label>
              <Input
                id="add-pub-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" onClick={handleAdd} disabled={pending || !platform}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
