"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, Trash2, Clapperboard, Pencil, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { ScenePresetEditDialog } from "@/components/scene-preset-edit-dialog";
import {
  createScenePreset,
  deleteScenePreset,
} from "@/app/(app)/contents/actions";
import type { ScenePreset } from "@/lib/types";

/**
 * Gestion des SETUPS de tournage réutilisables au niveau de la marque
 * (table brand_scene_presets, migration 0021). Un setup = une PHOTO d'un
 * lieu/cadrage (ex : « Zone 1 », « Lieu 2 », « Coin bureau ») + un nom.
 *
 * L'image est stockée sous presets/{brand_id}/… (RLS migration 0029) et
 * apparaît ensuite en vignette dans la barre « Mes setups » du storyboard,
 * insérable en 1 clic.
 */
export function ScenePresetManager({
  brandId,
  presets,
}: {
  brandId: string;
  presets: ScenePreset[];
}) {
  const router = useRouter();
  const [label, setLabel] = React.useState("");
  const [equipment, setEquipment] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [editPreset, setEditPreset] = React.useState<ScenePreset | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Donne un nom au setup (ex : Zone 1).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createScenePreset({
        brandId,
        label,
        referenceImageUrl: imageUrl,
        equipment: equipment.trim() || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setLabel("");
      setEquipment("");
      setImageUrl(null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await deleteScenePreset(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {presets.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {presets.map((p) => (
            <li
              key={p.id}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card"
            >
              <div className="relative aspect-video w-full bg-secondary">
                {p.reference_image_url ? (
                  <Image
                    src={p.reference_image_url}
                    alt={p.label}
                    fill
                    sizes="(max-width:640px) 50vw, 200px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Clapperboard className="size-6" />
                  </div>
                )}
                <div className="absolute end-1.5 top-1.5 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditPreset(p)}
                    disabled={pending}
                    aria-label="Modifier le setup"
                    title="Modifier (nom, cadrage, matériel)"
                    className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    aria-label="Supprimer le setup"
                    className="flex size-7 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="space-y-1 px-2.5 py-2">
                <p dir="auto" className="truncate text-sm font-semibold">
                  {p.label}
                </p>
                {p.equipment?.trim() ? (
                  <p
                    dir="auto"
                    className="flex items-start gap-1 text-xs text-muted"
                  >
                    <Zap className="mt-0.5 size-3 shrink-0 text-accent" />
                    <span className="line-clamp-2">{p.equipment}</span>
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditPreset(p)}
                    className="flex items-center gap-1 text-xs text-muted underline-offset-2 hover:text-accent hover:underline"
                  >
                    <Plus className="size-3" />
                    Ajouter le matériel
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ScenePresetEditDialog
        preset={editPreset}
        onOpenChange={(v) => !v && setEditPreset(null)}
      />

      {/* Ajout d'un setup : photo + nom */}
      <form
        onSubmit={add}
        className="rounded-2xl border border-border/60 bg-secondary/20 p-3"
      >
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="w-full sm:w-44">
            <ImageUpload
              folder={`presets/${brandId}`}
              value={imageUrl}
              onChange={setImageUrl}
              aspectRatio="video"
              label="Photo du lieu"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Nom du setup (ex : Zone 1, Coin bureau)"
              dir="auto"
              maxLength={60}
              disabled={pending}
            />
            <Input
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
              placeholder="Matériel à ce lieu (ex : anneau lumineux, trépied) — optionnel"
              dir="auto"
              disabled={pending}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button
              type="submit"
              disabled={pending || !label.trim()}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              {pending ? "Ajout…" : "Ajouter le setup"}
            </Button>
            <p className="text-xs text-muted">
              Ajoute tes lieux récurrents (ex : les 4 coins du bureau). Tu les
              insères en 1 clic dans le storyboard d&apos;une vidéo. Le matériel
              est propre à chaque lieu — laisse vide si tu n&apos;en utilises
              aucun ici (ex : face fenêtre) ; Krea s&apos;en sert pour te dire où
              le placer.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
