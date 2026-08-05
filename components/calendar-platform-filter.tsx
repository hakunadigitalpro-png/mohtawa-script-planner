"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { PLATFORMS } from "@/lib/constants";

/**
 * Filtre le calendrier par plateforme (ex : "voir seulement Facebook").
 * URL-driven (`?platform=`), même pattern que DashboardFilters — préserve
 * les autres params (mois, vue) au changement.
 */
export function CalendarPlatformFilter() {
  const router = useRouter();
  const sp = useSearchParams();
  const tPlatform = useTranslations("platforms");
  const platform = sp.get("platform") ?? "";

  const safeT = (key: string, fallback: string) => {
    try {
      return tPlatform(key);
    } catch {
      return fallback;
    }
  };

  const setPlatform = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set("platform", value);
    else params.delete("platform");
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="w-44">
      <Select
        value={platform}
        onValueChange={setPlatform}
        placeholder="Toutes les plateformes"
        ariaLabel="Filtrer par plateforme"
        options={[
          { value: "", label: "Toutes les plateformes" },
          ...PLATFORMS.map((p) => ({
            value: p.value,
            label: safeT(p.value, p.label),
          })),
        ]}
      />
    </div>
  );
}
