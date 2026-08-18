"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Zap } from "lucide-react";
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
import { updateScenePreset } from "@/app/(app)/contents/actions";
import type { ScenePreset } from "@/lib/types";

/**
 * Édition d'un setup existant — partagé entre la page de marque (section
 * « Setups de tournage ») et la barre « Mes setups » du storyboard, pour ne
 * pas maintenir deux formulaires qui divergeraient.
 *
 * Sert surtout à renseigner le MATÉRIEL de ce lieu (0051) : les setups créés
 * avant cette migration n'avaient aucun moyen d'être modifiés.
 */
export function ScenePresetEditDialog({
  preset,
  onOpenChange,
}: {
  preset: ScenePreset | null;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={preset !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {/* key={preset.id} : remonte le formulaire à chaque changement de
            setup édité, plutôt qu'un effet qui resynchroniserait l'état
            après coup (cascading renders). */}
        {preset && (
          <EditForm key={preset.id} preset={preset} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  preset,
  onOpenChange,
}: {
  preset: ScenePreset;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState(preset.label);
  const [camera, setCamera] = useState(preset.default_camera ?? "");
  const [equipment, setEquipment] = useState(preset.equipment ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!label.trim()) {
      setError("Le nom du setup est requis.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updateScenePreset(preset.id, {
        label,
        defaultCamera: camera.trim() || null,
        equipment: equipment.trim() || null,
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
    <>
      <DialogHeader>
        <DialogTitle>
          <span className="inline-flex items-center gap-2">
            <Pencil className="size-5 text-accent" />
            Modifier le setup
          </span>
        </DialogTitle>
        <DialogDescription>
          Le matériel est propre à CE lieu — laisse vide si tu n&apos;en
          utilises aucun ici (ex : face fenêtre, lumière naturelle). Krea s&apos;en
          sert pour te dire où le placer quand tu découpes un script.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="edit-preset-label">Nom du setup</Label>
          <Input
            id="edit-preset-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            dir="auto"
            autoFocus
            maxLength={60}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Cadrage par défaut (optionnel)
          </Label>
          <Input
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
            placeholder="Ex : Plan large fixe, légèrement plongé"
            dir="auto"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            <Zap className="size-3" />
            Matériel à ce lieu (optionnel)
          </Label>
          <Input
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            placeholder="Ex : anneau lumineux, trépied, micro-cravate"
            dir="auto"
          />
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
        <Button type="button" onClick={submit} disabled={pending || !label.trim()}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </>
  );
}
