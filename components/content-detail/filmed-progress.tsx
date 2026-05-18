"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { StoryboardScene, StorySlide } from "@/lib/types";

/**
 * Calcule le statut "filmé" pour un Reel (scenes) ou une Story (slides).
 *
 * Pour les Reels : on compte toutes les scènes (filmed/total = scenes.length).
 * Pour les Stories : on compte uniquement les slots "utilisés" (avec body ou
 * image_url), parce qu'un slot vide n'a rien à filmer.
 *
 * Si `hasItems` est false, ça veut dire que le concept de "filmé" ne s'applique
 * pas (pas de scènes côté Reel, pas de slots utilisés côté Story) — dans ce
 * cas le checklist macro "Filmed" reste en mode manuel.
 */
export function computeFilmedStatus(
  scenes: StoryboardScene[] | undefined,
  slides: StorySlide[] | undefined,
): { done: number; total: number; hasItems: boolean; allFilmed: boolean } {
  if (scenes !== undefined) {
    const total = scenes.length;
    const done = scenes.filter((s) => s.filmed).length;
    return {
      done,
      total,
      hasItems: total > 0,
      allFilmed: total > 0 && done === total,
    };
  }
  if (slides !== undefined) {
    const usedSlides = slides.filter(
      (s) => (s.body && s.body.trim()) || s.image_url,
    );
    const total = usedSlides.length;
    const done = usedSlides.filter((s) => s.filmed).length;
    return {
      done,
      total,
      hasItems: total > 0,
      allFilmed: total > 0 && done === total,
    };
  }
  return { done: 0, total: 0, hasItems: false, allFilmed: false };
}

/**
 * Barre de progression + texte "X sur Y filmées" pour le header de l'onglet
 * Storyboard (Reel) ou Stories (Story).
 *
 * Cachée quand il n'y a aucun item (rien à filmer pour le moment).
 */
export function FilmedProgress({
  done,
  total,
  hasItems,
  variant = "scenes",
}: {
  done: number;
  total: number;
  hasItems: boolean;
  variant?: "scenes" | "stories";
}) {
  const t = useTranslations(variant === "scenes" ? "storyboard" : "stories");

  if (!hasItems) return null;

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = done === total;

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            complete ? "bg-emerald-500" : "bg-accent",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          complete ? "text-emerald-600" : "text-muted-foreground",
        )}
      >
        {t("filmedProgress", { done, total })}
      </span>
    </div>
  );
}
