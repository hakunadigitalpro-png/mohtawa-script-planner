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
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder="Rechercher une vidéo par titre..."
          className="pl-9"
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onChange={(e) => setParam("status", e.target.value)}
          className="h-9 w-auto min-w-40"
        >
          <option value="">Tous les statuts</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

        <Select
          value={type}
          onChange={(e) => setParam("type", e.target.value)}
          className="h-9 w-auto min-w-36"
        >
          <option value="">Tous les formats</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>

        <Select
          value={platform}
          onChange={(e) => setParam("platform", e.target.value)}
          className="h-9 w-auto min-w-40"
        >
          <option value="">Toutes les plateformes</option>
          {PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>

        <Select
          value={month}
          onChange={(e) => setParam("month", e.target.value)}
          className="h-9 w-auto min-w-40"
        >
          <option value="">Tous les mois</option>
          {buildMonthOptions().map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>

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
