"use client";

import { useMemo, useState } from "react";
import { Copy, Check, Search, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HOOKS,
  HOOK_CATEGORIES,
  categoryEmoji,
  type HookCategory,
} from "@/lib/hooks-data";

export function HooksLibrary({
  onPick,
  pickLabel = "Utiliser",
}: {
  onPick?: (text: string) => void;
  pickLabel?: string;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<HookCategory | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return HOOKS.filter((h) => {
      if (cat !== "all" && h.category !== cat) return false;
      if (needle && !h.text.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [q, cat]);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // best-effort
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Rechercher une accroche..."
          className="pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryChip active={cat === "all"} onClick={() => setCat("all")}>
          ✨ Toutes ({HOOKS.length})
        </CategoryChip>
        {HOOK_CATEGORIES.map((c) => {
          const count = HOOKS.filter((h) => h.category === c.value).length;
          return (
            <CategoryChip
              key={c.value}
              active={cat === c.value}
              onClick={() => setCat(c.value)}
            >
              {c.emoji} {c.label} ({count})
            </CategoryChip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          Aucune accroche trouvée. Essaye d&apos;autres mots-clés.
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {filtered.map((h) => (
            <li key={h.id}>
              <Card className="flex h-full items-start gap-3 p-3">
                <div className="text-lg leading-none" aria-hidden>
                  {categoryEmoji(h.category)}
                </div>
                <p className="flex-1 text-sm leading-snug">{h.text}</p>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(h.id, h.text)}
                    aria-label="Copier"
                  >
                    {copiedId === h.id ? (
                      <Check className="size-3.5" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </Button>
                  {onPick && (
                    <Button
                      size="sm"
                      onClick={() => onPick(h.text)}
                      aria-label="Utiliser cette accroche"
                    >
                      <Wand2 className="size-3.5" />
                      {pickLabel}
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
        active
          ? "border-accent bg-accent text-accent-foreground shadow-sm"
          : "border-border bg-card/70 text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
