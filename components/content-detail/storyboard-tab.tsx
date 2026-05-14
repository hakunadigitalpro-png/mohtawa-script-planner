"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImageUpload } from "@/components/ui/image-upload";
import { addScene, deleteScene, updateScene } from "@/app/(app)/contents/actions";
import type { StoryboardScene } from "@/lib/types";

export function StoryboardTab({
  contentId,
  scenes,
}: {
  contentId: string;
  scenes: StoryboardScene[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Storyboard</h2>
          <p className="text-xs text-muted">
            Dessine les plans avant de tourner. Un visuel par scène.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => startTransition(async () => { await addScene(contentId); })}
          disabled={pending}
        >
          <Plus className="size-4" />
          Ajouter une scène
        </Button>
      </div>

      {scenes.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <p className="text-sm font-medium">Aucune scène pour le moment.</p>
          <p className="mt-1 text-xs text-muted">Clique sur « Ajouter une scène » pour commencer.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((scene) => (
            <SceneCard key={scene.id} scene={scene} contentId={contentId} />
          ))}
        </div>
      )}
    </Card>
  );
}

function SceneCard({
  scene,
  contentId,
}: {
  scene: StoryboardScene;
  contentId: string;
}) {
  const [state, setState] = useState({
    description: scene.description ?? "",
    camera_angle: scene.camera_angle ?? "",
    on_screen_text: scene.on_screen_text ?? "",
    image_url: scene.image_url ?? null,
  });
  const [pending, startTransition] = useTransition();

  const save = (next: typeof state) => {
    startTransition(async () => {
      await updateScene(scene.id, next, contentId);
    });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Plan {String(scene.scene_number).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => { await deleteScene(scene.id, contentId); })
          }
          disabled={pending}
          className="rounded-md p-1 text-muted hover:bg-destructive/10 hover:text-destructive"
          aria-label="Supprimer la scène"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      <div className="space-y-3 p-3">
        <ImageUpload
          contentId={contentId}
          value={state.image_url}
          aspectRatio="video"
          onChange={(url) => {
            const next = { ...state, image_url: url };
            setState(next);
            save(next);
          }}
          label="Image du plan"
        />

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Action / Dialogue
          </Label>
          <Textarea
            className="min-h-16 text-sm"
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            onBlur={() => save(state)}
            placeholder="Ce qui se passe / ce qui est dit"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Caméra / Plan
          </Label>
          <Input
            className="h-8 text-sm"
            value={state.camera_angle}
            onChange={(e) => setState((s) => ({ ...s, camera_angle: e.target.value }))}
            onBlur={() => save(state)}
            placeholder="Plan large, Gros plan, Travelling..."
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Texte affiché
          </Label>
          <Input
            className="h-8 text-sm"
            value={state.on_screen_text}
            onChange={(e) => setState((s) => ({ ...s, on_screen_text: e.target.value }))}
            onBlur={() => save(state)}
            placeholder="Texte qui apparaît à l'écran"
          />
        </div>
      </div>
    </div>
  );
}
