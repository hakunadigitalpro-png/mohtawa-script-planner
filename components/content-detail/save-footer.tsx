"use client";

import { useTranslations } from "next-intl";
import { Save, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Footer "sticky" affiché en bas de chaque onglet éditable.
 *  - À gauche : indicateur d'état (Modifications non sauvegardées / Tout est à jour)
 *  - À droite : bouton Annuler (visible si dirty) + bouton Enregistrer
 *
 * Le footer reste visible même en scroll (sticky bottom-4) pour que le bouton
 * Save soit toujours accessible sans descendre / remonter dans la page.
 */
export function SaveFooter({
  isDirty,
  isSaving,
  error,
  onSave,
  onReset,
}: {
  isDirty: boolean;
  isSaving: boolean;
  /** Message d'erreur du dernier essai de sauvegarde (null = pas d'erreur). */
  error?: string | null;
  onSave: () => void;
  onReset?: () => void;
}) {
  const t = useTranslations("common");

  return (
    // bottom-20 sur mobile : au-dessus de la barre d'onglets du bas (h-16).
    // Dès md (pas de barre du bas) → bottom-4 comme avant.
    <div className="sticky bottom-20 z-30 mt-4 space-y-2 md:bottom-4 md:z-10">
      {error && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          {error}
        </p>
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-2xl border bg-card/95 px-4 py-2.5 shadow-[0_8px_24px_-12px_rgba(10,6,18,0.25)] backdrop-blur-sm transition-colors",
          isDirty
            ? "border-accent/40"
            : "border-border/60",
        )}
      >
        <div className="flex items-center gap-2 text-xs">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-accent">
              <span className="inline-block size-2 animate-pulse rounded-full bg-accent" />
              {t("unsavedChanges")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Check className="size-3.5" />
              {t("upToDate")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={!isDirty || isSaving}
            >
              <RotateCcw className="size-3.5" />
              {t("discard")}
            </Button>
          )}
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={onSave}
            disabled={!isDirty || isSaving}
          >
            {isSaving ? (
              <>{t("saving")}</>
            ) : (
              <>
                <Save className="size-3.5" />
                {t("save")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
