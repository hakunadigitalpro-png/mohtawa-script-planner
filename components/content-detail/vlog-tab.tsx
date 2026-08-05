"use client";

import { useMemo } from "react";
import { Clapperboard, Film } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { upsertVlogDetails } from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";
import { CaptureChecklist } from "./capture-checklist";
import { VlogGeneratorButton } from "@/components/vlog-generator";
import type { Content, VlogDetails, ChecklistItem } from "@/lib/types";

/**
 * Onglet Vlog — structure pensée pour la façon dont un vlog se fait
 * VRAIMENT (pas scène par scène) :
 *   🎯 Angle · 🪝 Hook · 📐 Arc en 3 temps · 📸 Capture · 🎙️ Voix-off
 *
 * La checklist de capture est volontairement SORTIE de la card (encadré
 * accent) : c'est l'outil qu'on garde ouvert sur mobile pendant le tournage.
 * Tout est générable d'un coup via "Générer le vlog" (Claude).
 */
export function VlogTab({
  content,
  vlog,
  captureItems,
}: {
  content: Content;
  vlog: VlogDetails | null;
  captureItems: ChecklistItem[];
}) {
  const initial = useMemo(
    () => ({
      angle: vlog?.angle ?? "",
      hook: vlog?.hook ?? "",
      arc_situation: vlog?.arc_situation ?? "",
      arc_development: vlog?.arc_development ?? "",
      arc_payoff: vlog?.arc_payoff ?? "",
      voiceover: vlog?.voiceover ?? "",
    }),
    [
      vlog?.angle,
      vlog?.hook,
      vlog?.arc_situation,
      vlog?.arc_development,
      vlog?.arc_payoff,
      vlog?.voiceover,
    ],
  );

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => upsertVlogDetails(content.id, v));

  type FieldKey = keyof typeof initial;
  const set = (k: FieldKey, v: string) =>
    setState((s) => ({ ...s, [k]: v }));

  // Estimation de durée de la voix-off (~4 mots/sec en FR parlé), cible 60-120s.
  const voSeconds = useMemo(() => {
    const words = state.voiceover.trim().split(/\s+/).filter(Boolean).length;
    return Math.round(words / 4);
  }, [state.voiceover]);
  const voColor =
    voSeconds === 0
      ? "text-muted"
      : voSeconds >= 60 && voSeconds <= 120
        ? "text-emerald-700"
        : "text-amber-600";

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <Clapperboard className="size-4 text-accent" />
              <h2 className="text-base font-semibold">Plan de vlog</h2>
            </div>
            <p className="text-xs text-muted">
              Angle · Hook · Arc · Capture · Voix-off
            </p>
          </div>
          <VlogGeneratorButton
            contentId={content.id}
            platform={content.platform ?? undefined}
          />
        </div>

        <Field
          label="🎯 Angle"
          hint="Le fil narratif qui rend ce vlog unique."
          value={state.angle}
          onChange={(v) => set("angle", v)}
          placeholder="Ex : une journée dans les coulisses du lancement, vue de l'intérieur."
        />

        <Field
          label="🪝 Hook (2 premières secondes)"
          hint="La phrase / le moment qui scotche dès la 1re seconde."
          value={state.hook}
          onChange={(v) => set("hook", v)}
          placeholder="Ex : Tu crois qu'un lancement c'est glamour ? Regarde ça."
        />

        <div className="space-y-2">
          <div>
            <Label className="text-xs font-semibold text-foreground">
              📐 Arc en 3 temps
            </Label>
            <p className="text-[11px] text-muted">
              Même léger, un vlog a un début, un milieu et une chute.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ArcCell
              n="1"
              title="Situation"
              value={state.arc_situation}
              onChange={(v) => set("arc_situation", v)}
              placeholder="Le point de départ."
            />
            <ArcCell
              n="2"
              title="Développement"
              value={state.arc_development}
              onChange={(v) => set("arc_development", v)}
              placeholder="Ce qui se passe."
            />
            <ArcCell
              n="3"
              title="Chute"
              value={state.arc_payoff}
              onChange={(v) => set("arc_payoff", v)}
              placeholder="Le message final."
            />
          </div>
        </div>
      </Card>

      {/* Le cœur du Mode Vlog : à garder ouvert sur mobile pendant le tournage. */}
      <CaptureChecklist contentId={content.id} items={captureItems} />

      <Card className="space-y-2 p-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Film className="size-4 text-accent" />
            <Label className="text-sm font-semibold">🎙️ Voix-off</Label>
          </div>
          <span className={cn("text-[10px] font-semibold", voColor)}>
            ~{voSeconds}s
          </span>
        </div>
        <p className="text-xs text-muted">
          Le texte à lire par-dessus tes clips, dans l&apos;ordre. Vise 1 à 2 min.
        </p>
        <Textarea
          dir="auto"
          value={state.voiceover}
          onChange={(e) => set("voiceover", e.target.value)}
          placeholder="Écris ta voix-off ici, ou génère-la avec « Générer le vlog »."
          className="min-h-40 text-sm leading-relaxed [field-sizing:content]"
        />
      </Card>

      <SaveFooter
        isDirty={isDirty}
        isSaving={isSaving}
        error={error}
        onSave={handleSave}
        onReset={handleReset}
      />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <p className="text-[11px] text-muted">{hint}</p>
      <Textarea
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 text-sm leading-relaxed [field-sizing:content]"
      />
    </div>
  );
}

function ArcCell({
  n,
  title,
  value,
  onChange,
  placeholder,
}: {
  n: string;
  title: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1 rounded-2xl border border-border/60 bg-secondary/20 p-3">
      <div className="flex items-center gap-1.5">
        <span className="flex size-5 items-center justify-center rounded-full bg-accent/15 text-[10px] font-bold text-accent">
          {n}
        </span>
        <Label className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {title}
        </Label>
      </div>
      <Textarea
        dir="auto"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-16 text-sm [field-sizing:content]"
      />
    </div>
  );
}
