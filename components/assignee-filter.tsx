"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { TeamMember } from "@/lib/brand-team";

/**
 * « Qui fait quoi » : ne montrer que les contenus d'une personne. Piloté par
 * l'URL (`?who=`), comme le filtre plateforme, pour survivre au changement de
 * vue et au retour depuis une fiche.
 */
export function AssigneeFilter({
  team,
  currentUserId,
}: {
  team: TeamMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const setWho = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("who", value);
    else params.delete("who");
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-44 shrink-0">
      <Select
        value={sp.get("who") ?? ""}
        onValueChange={setWho}
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
  );
}
