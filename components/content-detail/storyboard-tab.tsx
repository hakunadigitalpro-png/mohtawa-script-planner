"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SCENE_TAGS } from "@/lib/constants";
import { addScene, deleteScene, updateScene } from "@/app/(app)/contents/actions";
import type { StoryboardScene } from "@/lib/types";

export function StoryboardTab({
  contentId,
  scenes: initialScenes,
}: {
  contentId: string;
  scenes: StoryboardScene[];
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Storyboard</h2>
          <p className="text-xs text-muted">Découpe ta vidéo comme un mini film.</p>
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

      {initialScenes.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">
          Aucune scène pour le moment.
        </p>
      ) : (
        <ul className="space-y-3">
          {initialScenes.map((scene) => (
            <SceneRow key={scene.id} scene={scene} contentId={contentId} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function SceneRow({
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
    tag: scene.tag ?? "",
  });
  const [pending, startTransition] = useTransition();

  const save = (next: typeof state) => {
    startTransition(async () => {
      await updateScene(scene.id, next, contentId);
    });
  };

  return (
    <li className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">Scène {scene.scene_number}</span>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await deleteScene(scene.id, contentId);
            })
          }
          disabled={pending}
          className="rounded-md p-1 text-muted hover:bg-destructive/10 hover:text-destructive"
          aria-label="Supprimer la scène"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Texte / Dialogue</Label>
          <Textarea
            value={state.description}
            onChange={(e) => setState((s) => ({ ...s, description: e.target.value }))}
            onBlur={() => save(state)}
          />
        </div>
        <div className="space-y-2">
          <Label>Angle caméra / Plan</Label>
          <Input
            value={state.camera_angle}
            onChange={(e) => setState((s) => ({ ...s, camera_angle: e.target.value }))}
            onBlur={() => save(state)}
            placeholder="Ex : Gros plan, plongée..."
          />
        </div>
        <div className="space-y-2">
          <Label>Texte à l&apos;écran</Label>
          <Input
            value={state.on_screen_text}
            onChange={(e) => setState((s) => ({ ...s, on_screen_text: e.target.value }))}
            onBlur={() => save(state)}
          />
        </div>
        <div className="space-y-2">
          <Label>Type de scène</Label>
          <Select
            value={state.tag}
            onChange={(e) => {
              const next = { ...state, tag: e.target.value };
              setState(next);
              save(next);
            }}
          >
            <option value="">—</option>
            {SCENE_TAGS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
      </div>
    </li>
  );
}
