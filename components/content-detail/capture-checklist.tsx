"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Camera, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  createChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/app/(app)/contents/actions";
import type { ChecklistItem } from "@/lib/types";

/**
 * Checklist de capture d'un vlog — LE cœur du Mode Vlog. La liste des
 * moments à filmer pendant la journée, cochables sur mobile au fur et à
 * mesure (règle le problème n°1 du vlog : oublier de filmer un moment).
 *
 * Réutilise les actions atomiques de content_checklist_items (catégorie
 * 'capture' — migration 0027) : add / toggle / delete = save immédiat.
 * Wording dédié vlog (vs ChecklistItemSection qui sert matériel/préparation).
 */
export function CaptureChecklist({
  contentId,
  items,
}: {
  contentId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [optimistic, setOptimistic] = React.useState(items);
  const [value, setValue] = React.useState("");
  React.useEffect(() => setOptimistic(items), [items]);

  const toggle = (id: string, current: boolean) => {
    setOptimistic((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !current } : it)),
    );
    startTransition(async () => {
      await toggleChecklistItem(id, contentId, !current);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    setOptimistic((prev) => prev.filter((it) => it.id !== id));
    startTransition(async () => {
      await deleteChecklistItem(id, contentId);
      router.refresh();
    });
  };

  const add = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setValue("");
    startTransition(async () => {
      await createChecklistItem(contentId, "capture", trimmed);
      router.refresh();
    });
  };

  const done = optimistic.filter((it) => it.done).length;
  const total = optimistic.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-3 rounded-2xl border border-accent/20 bg-accent/[0.03] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Camera className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Checklist de capture</h3>
            <p className="text-[11px] text-muted">
              Les moments à filmer. Coche-les au fur et à mesure pendant ta
              journée.
            </p>
          </div>
        </div>
        {total > 0 && (
          <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">
            {done}/{total}
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {optimistic.length > 0 ? (
        <ul className="space-y-1.5">
          {optimistic.map((it) => (
            <li
              key={it.id}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-border/60 hover:bg-secondary/40",
                it.done && "opacity-70",
              )}
            >
              <Checkbox
                checked={it.done}
                onCheckedChange={() => toggle(it.id, it.done)}
                disabled={pending}
              />
              <span
                dir="auto"
                className={cn(
                  "flex-1 text-sm",
                  it.done && "text-muted line-through",
                )}
              >
                {it.label}
              </span>
              <button
                type="button"
                onClick={() => remove(it.id)}
                disabled={pending}
                aria-label="Supprimer ce moment"
                className="rounded-full p-1 text-muted opacity-60 transition hover:bg-destructive/10 hover:text-destructive focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-secondary/40 px-3 py-2 text-xs italic text-muted">
          Aucun moment pour l&apos;instant. Génère un plan de vlog ou ajoute
          les moments à filmer ci-dessous.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          add(value);
        }}
        className="flex gap-2"
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ajouter un moment à filmer…"
          className="h-9 text-sm"
          disabled={pending}
          dir="auto"
        />
        <Button
          type="submit"
          size="icon"
          variant="outline"
          disabled={pending || !value.trim()}
          aria-label="Ajouter"
        >
          <Plus className="size-4" />
        </Button>
      </form>
    </div>
  );
}
