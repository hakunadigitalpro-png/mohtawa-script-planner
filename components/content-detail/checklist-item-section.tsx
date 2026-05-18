"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Trash2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  createChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/app/(app)/contents/actions";
import { useRouter } from "next/navigation";
import type { ChecklistItem, ChecklistItemCategory } from "@/lib/types";

/**
 * Section réutilisable pour les checklists "Matériel" / "Préparation".
 *
 * Comportement :
 *   - Add / toggle / delete sont atomiques (chaque action = save immédiat,
 *     cohérent avec la règle qu'on a fixée pour les actions atomiques).
 *   - Le champ d'ajout propose un dropdown de suggestions basé sur les items
 *     des 3 dernières vidéos de la marque (migration 0011, RPC dédiée).
 */
export function ChecklistItemSection({
  contentId,
  category,
  title,
  emptyHint,
  items,
  suggestions,
  icon,
}: {
  contentId: string;
  category: ChecklistItemCategory;
  title: string;
  emptyHint: string;
  items: ChecklistItem[];
  suggestions: { label: string; usage_count: number }[];
  icon: React.ReactNode;
}) {
  const t = useTranslations("checklist");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  // Optimistic state local pour éviter le flash quand l'user toggle / delete.
  // Resync via router.refresh() après chaque mutation.
  const [optimisticItems, setOptimisticItems] = React.useState(items);
  React.useEffect(() => setOptimisticItems(items), [items]);

  const handleToggle = (id: string, current: boolean) => {
    setOptimisticItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, done: !current } : it)),
    );
    startTransition(async () => {
      await toggleChecklistItem(id, contentId, !current);
      router.refresh();
    });
  };

  const handleDelete = (id: string) => {
    setOptimisticItems((prev) => prev.filter((it) => it.id !== id));
    startTransition(async () => {
      await deleteChecklistItem(id, contentId);
      router.refresh();
    });
  };

  const done = optimisticItems.filter((it) => it.done).length;
  const total = optimisticItems.length;

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        {total > 0 && (
          <span className="text-xs font-semibold tabular-nums text-muted">
            {done}/{total}
          </span>
        )}
      </div>

      {optimisticItems.length > 0 ? (
        <ul className="space-y-1.5">
          {optimisticItems.map((it) => (
            <li
              key={it.id}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-1.5 transition-colors hover:border-border/60 hover:bg-secondary/40",
                it.done && "opacity-70",
              )}
            >
              <Checkbox
                checked={it.done}
                onCheckedChange={() => handleToggle(it.id, it.done)}
                disabled={pending}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  it.done && "text-muted line-through",
                )}
              >
                {it.label}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(it.id)}
                disabled={pending}
                aria-label={t("deleteItem")}
                className="rounded-full p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-secondary/40 px-3 py-2 text-xs italic text-muted">
          {emptyHint}
        </p>
      )}

      <AddItemForm
        contentId={contentId}
        category={category}
        suggestions={suggestions}
        existingLabels={optimisticItems.map((it) => it.label)}
      />
    </div>
  );
}

/* ============================== Add form ============================== */

function AddItemForm({
  contentId,
  category,
  suggestions,
  existingLabels,
}: {
  contentId: string;
  category: ChecklistItemCategory;
  suggestions: { label: string; usage_count: number }[];
  /** Pour filtrer les suggestions déjà ajoutées à cette vidéo. */
  existingLabels: string[];
}) {
  const t = useTranslations("checklist");
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Click hors → ferme la dropdown
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const existingSet = new Set(
    existingLabels.map((l) => l.trim().toLowerCase()),
  );

  // Filtre les suggestions :
  //   1. Exclure les items déjà présents sur cette vidéo
  //   2. Si l'user a tapé du texte, filtrer par préfixe/substring
  const filteredSuggestions = suggestions.filter((s) => {
    if (existingSet.has(s.label.trim().toLowerCase())) return false;
    if (value.trim() === "") return true;
    return s.label.toLowerCase().includes(value.toLowerCase());
  });

  const addLabel = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    setValue("");
    setOpen(false);
    startTransition(async () => {
      await createChecklistItem(contentId, category, trimmed);
      router.refresh();
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addLabel(value);
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={t("addItemPlaceholder")}
          className="h-9 text-sm"
          disabled={pending}
        />
      </form>

      {open && filteredSuggestions.length > 0 && (
        <div className="absolute start-0 end-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_12px_40px_-10px_rgba(10,6,18,0.18)]">
          <div className="flex items-center gap-1.5 border-b border-border/60 bg-secondary/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted">
            <Sparkles className="size-3" />
            {t("recentItems")}
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filteredSuggestions.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => addLabel(s.label)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  <span className="truncate">{s.label}</span>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted">
                    ×{s.usage_count}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
