"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { upsertReelDetails, updateContent } from "@/app/(app)/contents/actions";
import type { ReelDetails } from "@/lib/types";

const ITEMS = [
  { key: "script_ready", labelKey: "scriptReady" },
  { key: "scenes_ready", labelKey: "scenesReady" },
  { key: "filmed", labelKey: "filmed" },
  { key: "edited", labelKey: "edited" },
  { key: "published", labelKey: "published" },
] as const;

type Key = (typeof ITEMS)[number]["key"];

export function ChecklistTab({
  contentId,
  reel,
}: {
  contentId: string;
  reel: ReelDetails | null;
}) {
  const t = useTranslations("checklist");
  const [state, setState] = useState<Record<Key, boolean>>(() => {
    const c = (reel?.checklist ?? {}) as Record<string, boolean>;
    return {
      script_ready: !!c.script_ready,
      scenes_ready: !!c.scenes_ready,
      filmed: !!c.filmed,
      edited: !!c.edited,
      published: !!c.published,
    };
  });
  const [pending, startTransition] = useTransition();

  const toggle = (key: Key) => {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    startTransition(async () => {
      await upsertReelDetails(contentId, { checklist: next });
    });
  };

  const markPublished = () => {
    const next: Record<Key, boolean> = {
      script_ready: true,
      scenes_ready: true,
      filmed: true,
      edited: true,
      published: true,
    };
    setState(next);
    startTransition(async () => {
      await Promise.all([
        upsertReelDetails(contentId, { checklist: next }),
        updateContent(contentId, { status: "published" }),
      ]);
    });
  };

  const done = Object.values(state).filter(Boolean).length;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-base font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted">
          {t("subtitle", { done, total: ITEMS.length })}
        </p>
      </div>

      <ul className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <Checkbox
              id={item.key}
              checked={state[item.key]}
              onCheckedChange={() => toggle(item.key)}
            />
            <label htmlFor={item.key} className="cursor-pointer text-sm">
              {t(`items.${item.labelKey}`)}
            </label>
          </li>
        ))}
      </ul>

      <div>
        <Button onClick={markPublished} disabled={pending}>
          {t("markPublished")}
        </Button>
      </div>
    </Card>
  );
}
