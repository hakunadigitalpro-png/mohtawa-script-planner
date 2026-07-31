"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Clapperboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createScenePreset,
  deleteScenePreset,
} from "@/app/(app)/contents/actions";
import type { ScenePreset } from "@/lib/types";

/**
 * Gestion des SETUPS de tournage réutilisables au niveau de la marque
 * (table brand_scene_presets, migration 0021). L'utilisatrice définit ici ses
 * lieux/cadrages récurrents (ex : les 4 coins du bureau) ; ils apparaissent
 * ensuite dans la barre « Mes setups » du storyboard, insérables en 1 clic.
 *
 * Version marque = nom + cadrage (pas d'image, car le stockage est scoped par
 * vidéo). La photo de référence s'ajoute depuis le storyboard (« enregistrer
 * comme setup »).
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
  const [camera, setCamera] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Donne un nom au setup (ex : Coin bureau).");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createScenePreset({
        brandId,
        label,
        defaultCamera: camera.trim() || null,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      setLabel("");
      setCamera("");
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
    <div className="space-y-3">
      {presets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-secondary/40 px-4 py-3 text-sm text-muted">
          Aucun setup pour l&apos;instant. Ajoute tes lieux/cadrages récurrents
          (ex : « Coin bureau », « Face fenêtre »…) — tu les retrouveras en 1
          clic dans le storyboard d&apos;une vidéo.
        </p>
      ) : (
        <ul className="space-y-2">
          {presets.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Clapperboard className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold" dir="auto">
                    {p.label}
                  </p>
                  {p.default_camera && (
                    <p className="truncate text-xs text-muted" dir="auto">
                      {p.default_camera}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={pending}
                aria-label="Supprimer le setup"
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={add}
        className="space-y-2 rounded-2xl border border-border/60 bg-secondary/20 p-3"
      >
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nom (ex : Coin bureau)"
            dir="auto"
            maxLength={60}
            disabled={pending}
          />
          <Input
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
            placeholder="Cadrage (optionnel)"
            dir="auto"
            disabled={pending}
          />
          <Button type="submit" disabled={pending || !label.trim()}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}
