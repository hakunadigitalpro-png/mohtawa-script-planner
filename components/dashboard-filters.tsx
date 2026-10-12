"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CONTENT_TYPES, PLATFORMS, ALL_STATUSES } from "@/lib/constants";

function buildMonthOptions(locale: string) {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 6; i >= -6; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(locale === "ar" ? "ar" : "fr-FR", {
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
  const t = useTranslations("dashboard.filters");
  const tLate = useTranslations("dashboard.late");
  const tStatus = useTranslations("statuses");
  const tType = useTranslations("contentTypes");
  const tPlatform = useTranslations("platforms");
  const locale = useLocale();

  const q = sp.get("q") ?? "";
  const status = sp.get("status") ?? "";
  const type = sp.get("type") ?? "";
  const platform = sp.get("platform") ?? "";
  const month = sp.get("month") ?? "";
  // Posé par la note de retard de Krea, pas par un contrôle d'ici : on
  // l'affiche en pastille pour qu'on sache qu'il est là et qu'on puisse
  // l'enlever.
  const late = sp.get("late") === "1";

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  };

  const hasFilters = !!(q || status || type || platform || month || late);

  // Map status/type/platform values to their translated labels. We rely on
  // the i18n keys having the exact same value as the constant key.
  const safeT = (
    fn: (k: string) => string,
    key: string,
    fallback: string,
  ) => {
    try {
      return fn(key);
    } catch {
      return fallback;
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="ps-10"
          defaultValue={q}
          onChange={(e) => setParam("q", e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-40">
          <Select
            value={status}
            onValueChange={(v) => setParam("status", v)}
            placeholder={t("allStatuses")}
            options={[
              { value: "", label: t("allStatuses") },
              ...ALL_STATUSES.map((s) => ({
                value: s.value,
                label: safeT(tStatus, s.value, s.label),
              })),
            ]}
          />
        </div>

        <div className="w-36">
          <Select
            value={type}
            onValueChange={(v) => setParam("type", v)}
            placeholder={t("allTypes")}
            options={[
              { value: "", label: t("allTypes") },
              ...CONTENT_TYPES.map((ct) => ({
                value: ct.value,
                label: safeT(tType, ct.value, ct.label),
              })),
            ]}
          />
        </div>

        <div className="w-44">
          <Select
            value={platform}
            onValueChange={(v) => setParam("platform", v)}
            placeholder={t("allPlatforms")}
            options={[
              { value: "", label: t("allPlatforms") },
              ...PLATFORMS.map((p) => ({
                value: p.value,
                label: safeT(tPlatform, p.value, p.label),
              })),
            ]}
          />
        </div>

        <div className="w-44">
          <Select
            value={month}
            onValueChange={(v) => setParam("month", v)}
            placeholder={t("allMonths")}
            options={[
              { value: "", label: t("allMonths") },
              ...buildMonthOptions(locale),
            ]}
          />
        </div>

        {late && (
          <span className="inline-flex h-8 items-center gap-1 rounded-full bg-secondary ps-3 pe-1 text-xs font-semibold text-foreground">
            {tLate("chip")}
            <button
              type="button"
              onClick={() => setParam("late", "")}
              aria-label={tLate("remove")}
              className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-card"
            >
              <X className="size-3.5" />
            </button>
          </span>
        )}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.replace("/dashboard")}
          >
            <X className="size-3.5" />
            {t("clear")}
          </Button>
        )}
      </div>
    </div>
  );
}
