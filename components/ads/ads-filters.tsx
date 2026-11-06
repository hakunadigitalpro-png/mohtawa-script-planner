"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import { AD_STATUS_LABEL, AD_STATUS_PICKER } from "@/lib/types-ads";
import type { TeamMember } from "@/lib/brand-team";

/**
 * Filtrer les campagnes par statut et par responsable. Piloté par l'URL, pour
 * survivre au changement de vue et au retour depuis une fiche. Le responsable
 * n'existe pas pour un client invité : `team` est alors absent.
 */
export function AdsFilters({
  team,
  currentUserId,
}: {
  team?: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: "status" | "who", value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/ads?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <div className="w-44">
        <Select
          value={sp.get("status") ?? ""}
          onValueChange={(v) => set("status", v)}
          placeholder="Tous les statuts"
          ariaLabel="Filtrer par statut"
          options={[
            { value: "", label: "Tous les statuts" },
            ...AD_STATUS_PICKER.map((s) => ({ value: s, label: AD_STATUS_LABEL[s] })),
          ]}
        />
      </div>
      {team && (
        <div className="w-44">
          <Select
            value={sp.get("who") ?? ""}
            onValueChange={(v) => set("who", v)}
            placeholder="Toute l'équipe"
            ariaLabel="Filtrer par responsable"
            options={[
              { value: "", label: "Toute l'équipe" },
              { value: currentUserId, label: "Moi" },
              ...team
                .filter((m) => m.id !== currentUserId)
                .map((m) => ({ value: m.id, label: m.label })),
            ]}
          />
        </div>
      )}
    </div>
  );
}
