"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Copy, Check, Search, Wand2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  HOOKS,
  HOOK_CATEGORIES,
  categoryEmoji,
  hookText,
  type HookCategory,
} from "@/lib/hooks-data";
import type { Locale } from "@/i18n/config";

export function HooksLibrary({
  onPick,
  pickLabel,
}: {
  onPick?: (text: string) => void;
  pickLabel?: string;
}) {
  const t = useTranslations("hooks");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<HookCategory | "all">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const safeT = (key: string, fallback: string) => {
    try {
      return t(`categories.${key}`);
    } catch {
      return fallback;
    }
  };

  const finalPickLabel = pickLabel ?? t("use");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return HOOKS.filter((h) => {
      if (cat !== "all" && h.category !== cat) return false;
      // Search applies to the localized text only — what the user sees.
      if (needle && !hookText(h, locale).toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [q, cat, locale]);

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
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="ps-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <CategoryChip active={cat === "all"} onClick={() => setCat("all")}>
          {t("allCategories", { count: HOOKS.length })}
        </CategoryChip>
        {HOOK_CATEGORIES.map((c) => {
          const count = HOOKS.filter((h) => h.category === c.value).length;
          return (
            <CategoryChip
              key={c.value}
              active={cat === c.value}
              onClick={() => setCat(c.value)}
            >
              {c.emoji} {safeT(c.value, c.label)} ({count})
            </CategoryChip>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          {t("noResults")}
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {filtered.map((h) => {
            const text = hookText(h, locale);
            return (
              <li key={h.id}>
                <Card className="flex h-full items-start gap-3 p-3">
                  <div className="text-lg leading-none" aria-hidden>
                    {categoryEmoji(h.category)}
                  </div>
                  <p className="flex-1 text-sm leading-snug">{text}</p>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(h.id, text)}
                      aria-label={tCommon("copy")}
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
                        onClick={() => onPick(text)}
                        aria-label={finalPickLabel}
                      >
                        <Wand2 className="size-3.5" />
                        {finalPickLabel}
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
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
