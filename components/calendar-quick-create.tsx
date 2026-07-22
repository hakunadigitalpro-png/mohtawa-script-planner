"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewContentModal } from "@/components/new-content-modal";
import { CONTENT_TYPES } from "@/lib/constants";

/**
 * Barre de création rapide du calendrier (inspiration Notion "Quick Button").
 * Un bouton par type de contenu (Reel / Story / Vlog) avec un « + » coloré
 * à la couleur du type — qui sert aussi d'indicateur de couleur du calendrier.
 * Ouvre la modale de création pré-remplie sur le bon type.
 *
 * `key={type}` sur la modale : force un remount quand on change de type pour
 * que son état interne (useState(defaultType)) reparte sur le bon type.
 */
export function CalendarQuickCreate({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(CONTENT_TYPES[0].value);

  const openFor = (value: string) => {
    setType(value);
    setOpen(true);
  };

  return (
    <>
      {/* Ligne horizontale compacte — vit dans l'en-tête à droite pour ne
          consommer aucune hauteur au-dessus du calendrier. */}
      <div className="flex flex-wrap items-center gap-2">
        {CONTENT_TYPES.map((ct) => (
          <button
            key={ct.value}
            type="button"
            onClick={() => openFor(ct.value)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-semibold shadow-[0_1px_2px_rgba(10,6,18,0.04)] transition hover:border-accent/40 hover:bg-secondary"
          >
            <span
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: ct.color }}
            >
              <Plus className="size-3" />
            </span>
            {ct.label}
          </button>
        ))}
      </div>

      <NewContentModal
        key={type}
        open={open}
        onOpenChange={setOpen}
        defaultType={type}
        defaultDate={defaultDate}
      />
    </>
  );
}
