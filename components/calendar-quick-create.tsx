"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { NewContentModal } from "@/components/new-content-modal";

/**
 * Création d'un contenu depuis le planning : UN bouton, UN clic.
 *
 * Deux versions ont été écartées avant celle-ci.
 *
 * Un bouton par format (six pastilles alignées) : la rangée dépassait la
 * largeur de l'écran, sans hiérarchie — dix contrôles de même poids, et
 * l'action principale noyée au milieu.
 *
 * Puis un menu déroulant listant les six formats : il ajoutait un geste sans
 * rien apporter, puisque la modale ouvre DÉJÀ sur un sélecteur de format en
 * premier champ. On choisissait donc deux fois. Il traînait en prime un
 * défaut reproductible : la modale n'était remontée que si le format
 * changeait, si bien qu'après avoir modifié puis annulé, un clic sur « Reel »
 * rouvrait sur « Story ».
 *
 * Reste le geste juste : on clique, la modale s'ouvre, le format s'y choisit
 * comme le reste.
 */
export function CalendarQuickCreate({ defaultDate }: { defaultDate?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-soft transition hover:brightness-95"
      >
        <Plus className="size-4" />
        {/* Le mot complet dès qu'il y a la place : sur téléphone il
            poussait le bouton sur une troisième rangée. */}
        Nouveau<span className="max-sm:hidden">&nbsp;contenu</span>
      </button>

      <NewContentModal
        open={open}
        onOpenChange={setOpen}
        defaultDate={defaultDate}
      />
    </>
  );
}
