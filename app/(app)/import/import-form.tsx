"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ListPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { KreaBadge } from "@/components/krea-avatar";
import {
  parseSeries,
  spreadDates,
  type ImportableType,
} from "@/lib/series-import";
import { importSeries } from "./actions";

const TYPE_OPTIONS: { value: ImportableType; label: string }[] = [
  { value: "reel", label: "Reel" },
  { value: "vlog", label: "Vlog" },
  { value: "post", label: "Post" },
  { value: "carousel", label: "Carrousel" },
  { value: "infographic", label: "Infographie" },
];

const CADENCE_OPTIONS = [
  { value: "7", label: "Tous les jours" },
  { value: "5", label: "5 par semaine" },
  { value: "3", label: "3 par semaine" },
  { value: "2", label: "2 par semaine" },
  { value: "1", label: "1 par semaine" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ImportForm({
  themes,
  platforms,
}: {
  themes: string[];
  platforms: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [type, setType] = useState<ImportableType>("reel");
  const [platform, setPlatform] = useState("");
  const [theme, setTheme] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [perWeek, setPerWeek] = useState("3");
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [titles, setTitles] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Le découpage est instantané : il se recalcule à chaque frappe, sans appel
  // réseau ni IA. C'est ce qui permet de voir tout de suite ce qui sera créé.
  const parsed = useMemo(() => parseSeries(raw), [raw]);
  const kept = parsed.filter((p) => !skipped.has(p.number));
  const dates = startDate
    ? spreadDates(startDate, kept.length, Number(perWeek))
    : [];

  const toggle = (n: number) =>
    setSkipped((s) => {
      const next = new Set(s);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await importSeries({
        items: kept.map((p) => ({
          title: (titles[p.number] ?? p.title).trim(),
          script: p.script,
        })),
        type,
        platform: platform || undefined,
        theme: theme || undefined,
        startDate: startDate || undefined,
        perWeek: Number(perWeek),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/calendar");
    });
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <KreaBadge />
        <p className="text-sm text-foreground">
          Colle ta liste de sujets telle quelle. Chaque ligne numérotée devient
          un contenu : la ligne elle-même sert de titre, tout ce qui suit
          devient le script. Je ne réécris rien.
        </p>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          dir="auto"
          className="min-h-56 text-sm [field-sizing:content]"
          placeholder={
            "1. Ton premier sujet\nIdée centrale : …\nConclusion : …\n\n2. Ton deuxième sujet\n…"
          }
        />
      </Card>

      {parsed.length > 0 && (
        <>
          <Card className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="imp-type">Format</Label>
              <Select
                id="imp-type"
                value={type}
                onValueChange={(v) => setType(v as ImportableType)}
                options={TYPE_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-platform">Plateforme</Label>
              <Select
                id="imp-platform"
                value={platform}
                onValueChange={setPlatform}
                placeholder="Aucune"
                options={[{ value: "", label: "Aucune" }, ...platforms]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-start">Première publication</Label>
              <Input
                id="imp-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-cadence">Cadence</Label>
              <Select
                id="imp-cadence"
                value={perWeek}
                onValueChange={setPerWeek}
                options={CADENCE_OPTIONS}
              />
            </div>
            {themes.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="imp-theme">Thème (appliqué à toute la série)</Label>
                <Select
                  id="imp-theme"
                  value={theme}
                  onValueChange={setTheme}
                  placeholder="Aucun"
                  options={[
                    { value: "", label: "Aucun" },
                    ...themes.map((t) => ({ value: t, label: t })),
                  ]}
                />
              </div>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
              <p className="text-sm font-semibold">
                {kept.length} contenu{kept.length > 1 ? "s" : ""} à créer
                {parsed.length !== kept.length && (
                  <span className="ms-1 font-normal text-muted">
                    ({parsed.length - kept.length} décoché
                    {parsed.length - kept.length > 1 ? "s" : ""})
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                Décoche ce que tu gardes pour plus tard.
              </p>
            </div>
            <ul className="divide-y divide-border/60">
              {parsed.map((p) => {
                const on = !skipped.has(p.number);
                const rank = kept.findIndex((k) => k.number === p.number);
                return (
                  <li
                    key={p.number}
                    className="flex items-start gap-3 px-5 py-3"
                  >
                    <Checkbox
                      checked={on}
                      onCheckedChange={() => toggle(p.number)}
                      aria-label={`Inclure le sujet ${p.number}`}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Input
                        value={titles[p.number] ?? p.title}
                        onChange={(e) =>
                          setTitles((t) => ({
                            ...t,
                            [p.number]: e.target.value,
                          }))
                        }
                        dir="auto"
                        className={
                          "h-9 text-sm " + (on ? "" : "opacity-50 line-through")
                        }
                      />
                      <p className="text-xs text-muted">
                        {p.script
                          ? `${p.script.length} caractères de script`
                          : "pas de script"}
                        {on && rank >= 0 && dates[rank] && (
                          <span className="ms-2 tabular-nums">
                            · {dates[rank]}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {error && (
            <p
              className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={submit}
              disabled={pending || kept.length === 0}
            >
              {pending ? (
                "Création en cours…"
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Créer {kept.length} contenu{kept.length > 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {raw.trim() && parsed.length === 0 && (
        <Card className="flex items-start gap-3 p-6">
          <ListPlus className="mt-0.5 size-5 shrink-0 text-muted" />
          <div className="text-sm">
            <p className="font-semibold">Je ne trouve aucun sujet numéroté.</p>
            <p className="mt-1 text-muted">
              Chaque sujet doit commencer par un numéro en début de ligne —
              « 1. », « 2. », et ainsi de suite, à la suite.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
