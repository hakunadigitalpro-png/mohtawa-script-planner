"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CONTENT_TYPES, PLATFORMS, STATUSES } from "@/lib/constants";

function buildMonthOptions() {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= -6; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
    opts.push({ value, label });
  }
  return opts;
}

export function DashboardFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const type = sp.get("type") ?? "";
  const platform = sp.get("platform") ?? "";
  const month = sp.get("month") ?? "";

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const hasFilters = !!(q || status || type || platform || month);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Rechercher une vidéo par titre..."
          className="pl-10"
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Select
            value={status}
            onValueChange={(v) => setParam("status", v)}
            placeholder="Tous les statuts"
            options={[
              { value: "", label: "Tous les statuts" },
              ...STATUSES.map((s) => ({ value: s.value, label: s.label })),
            ]}
          />
        </div>

        <div className="w-36">
          <Select
            value={type}
            onValueChange={(v) => setParam("type", v)}
            placeholder="Tous les formats"
            options={[
              { value: "", label: "Tous les formats" },
              ...CONTENT_TYPES.map((t) => ({ value: t.value, label: t.label })),
            ]}
          />
        </div>

        <div className="w-44">
          <Select
            value={platform}
            onValueChange={(v) => setParam("platform", v)}
            placeholder="Toutes les plateformes"
            options={[
              { value: "", label: "Toutes les plateformes" },
              ...PLATFORMS.map((p) => ({ value: p.value, label: p.label })),
            ]}
          />
        </div>

        <div className="w-44">
          <Select
            value={month}
            onValueChange={(v) => setParam("month", v)}
            placeholder="Tous les mois"
            options={[
              { value: "", label: "Tous les mois" },
              ...buildMonthOptions(),
            ]}
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace("/dashboard")}
          >
            <X className="size-3.5" />
            Effacer les filtres
          </Button>
        )}
      </div>
    </div>
  );
}
