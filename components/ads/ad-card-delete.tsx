"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteAdCampaign } from "@/app/(app)/ads/actions";

/**
 * Petite corbeille à poser en superposition d'une carte de campagne, pour
 * supprimer sans entrer dans l'éditeur. Confirme avant d'agir, bloque le
 * clic pour qu'il n'ouvre pas la fiche, et rafraîchit la liste au succès.
 */
export function AdCardDelete({
  campaignId,
  title,
}: {
  campaignId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Supprimer la campagne « ${title} » ?`)) return;
    setPending(true);
    const res = await deleteAdCampaign(campaignId);
    setPending(false);
    if ("error" in res && res.error) {
      alert(`Suppression refusée : ${res.error}`);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={`Supprimer ${title}`}
      title="Supprimer la campagne"
      className="absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-card/80 text-muted-foreground opacity-0 transition hover:bg-destructive hover:text-white group-hover:opacity-100 disabled:opacity-30"
    >
      <Trash2 className="size-4" />
    </button>
  );
}
