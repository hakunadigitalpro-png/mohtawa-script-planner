"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { upsertReelDetails, updateContent } from "@/app/(app)/contents/actions";
import { computeFilmedStatus } from "./filmed-progress";
import { cn } from "@/lib/utils";
import type { ReelDetails, StoryboardScene, StorySlide } from "@/lib/types";

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
  scenes,
  slides,
}: {
  contentId: string;
  reel: ReelDetails | null;
  /** Pour les Reels : scènes du storyboard. Permet de calculer auto "filmed". */
  scenes?: StoryboardScene[];
  /** Pour les Stories : slots existants. Permet de calculer auto "filmed". */
  slides?: StorySlide[];
}) {
  const t = useTranslations("checklist");

  // Statut "filmed" calculé depuis les scènes/slots (migration 0010).
  // Si pas de scènes ni de slots utilisés → on retombe sur le boolean manuel.
  const filmedStatus = computeFilmedStatus(scenes, slides);
  const filmedIsAuto = filmedStatus.hasItems;

  const [state, setState] = useState<Record<Key, boolean>>(() => {
    const c = (reel?.checklist ?? {}) as Record<string, boolean>;
    return {
      script_ready: !!c.script_ready,
      scenes_ready: !!c.scenes_ready,
      // Si auto → la valeur vient des scènes/slots, on ignore reel.checklist.filmed
      filmed: filmedIsAuto ? filmedStatus.allFilmed : !!c.filmed,
      edited: !!c.edited,
      published: !!c.published,
    };
  });

  // Resync `filmed` quand les scènes/slots changent (ex : user coche une case
  // dans le Storyboard → la case macro doit se mettre à jour automatiquement
  // au prochain re-render).
  useEffect(() => {
    if (filmedIsAuto) {
      setState((s) => ({ ...s, filmed: filmedStatus.allFilmed }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmedIsAuto, filmedStatus.allFilmed]);

  const [pending, startTransition] = useTransition();

  const toggle = (key: Key) => {
    // La case "filmed" est lecture seule quand calculée — on bloque le toggle.
    if (key === "filmed" && filmedIsAuto) return;
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
      // filmed reste celui calculé si auto, sinon force à true
      filmed: filmedIsAuto ? filmedStatus.allFilmed : true,
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
        {ITEMS.map((item) => {
          const isFilmedItem = item.key === "filmed";
          const isReadOnly = isFilmedItem && filmedIsAuto;
          return (
            <li
              key={item.key}
              className={cn(
                "flex items-center gap-3",
                isReadOnly && "rounded-xl bg-secondary/40 px-3 py-2",
              )}
            >
              <Checkbox
                id={item.key}
                checked={state[item.key]}
                onCheckedChange={() => toggle(item.key)}
                disabled={isReadOnly}
              />
              <label
                htmlFor={item.key}
                className={cn(
                  "text-sm",
                  isReadOnly ? "cursor-default" : "cursor-pointer",
                )}
              >
                {t(`items.${item.labelKey}`)}
              </label>
              {isReadOnly && (
                <div className="ms-auto flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums text-muted">
                    {t("filmedAutoFraction", {
                      done: filmedStatus.done,
                      total: filmedStatus.total,
                    })}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent"
                    title={t("filmedAutoHint")}
                  >
                    <Sparkles className="size-3" />
                    auto
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div>
        <Button onClick={markPublished} disabled={pending}>
          {t("markPublished")}
        </Button>
      </div>
    </Card>
  );
}
