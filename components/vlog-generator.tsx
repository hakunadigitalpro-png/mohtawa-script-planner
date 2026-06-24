"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCcw, Wand2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  aiGenerateVlog,
  applyVlogGeneration,
} from "@/app/(app)/contents/ai-actions";
import type { VlogGeneration } from "@/lib/ai";

export function VlogGeneratorButton({
  contentId,
  platform,
}: {
  contentId: string;
  platform?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-3.5 text-amber-500" />
        Générer le vlog
      </Button>
      {open && (
        <VlogGeneratorModal
          contentId={contentId}
          platform={platform}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function VlogGeneratorModal({
  contentId,
  platform,
  onClose,
}: {
  contentId: string;
  platform?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<VlogGeneration | null>(null);
  const [chosenHook, setChosenHook] = useState(0);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    if (!topic.trim()) {
      setError("Décris le sujet de ton vlog.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await aiGenerateVlog({ contentId, topic, audience, platform });
      if (!res.ok) setError(res.error);
      else {
        setPreview(res.data);
        setChosenHook(0);
      }
    });
  };

  const apply = () => {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const res = await applyVlogGeneration({
        contentId,
        angle: preview.angle,
        hook: preview.hooks[chosenHook] ?? preview.hooks[0] ?? "",
        arc: preview.arc,
        voiceover: preview.voiceover,
        caption: preview.caption,
        captureShots: preview.captureShots,
      });
      if (!res.ok) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            Générer un plan de vlog
          </DialogTitle>
          <DialogDescription>
            Décris ton sujet — l&apos;IA propose l&apos;angle, les hooks, la
            checklist de capture et la voix-off.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!preview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="vlog-topic">Sujet du vlog</Label>
                <Textarea
                  id="vlog-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex : une journée pour préparer le lancement de notre thé bio"
                  className="min-h-20"
                  dir="auto"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vlog-audience">Audience (optionnel)</Label>
                <Input
                  id="vlog-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex : entrepreneurs, amateurs de thé…"
                  dir="auto"
                />
              </div>
            </>
          )}

          {preview && (
            <VlogPreview
              data={preview}
              chosenHook={chosenHook}
              onChooseHook={setChosenHook}
            />
          )}

          {error && (
            <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {!preview ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                Annuler
              </Button>
              <Button type="button" onClick={generate} disabled={pending}>
                <Wand2 className="size-3.5" />
                {pending ? "Génération…" : "Générer"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPreview(null);
                  generate();
                }}
                disabled={pending}
              >
                <RefreshCcw className="size-3.5" />
                Regénérer
              </Button>
              <Button type="button" onClick={apply} disabled={pending}>
                {pending ? "Application…" : "Appliquer"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}

function VlogPreview({
  data,
  chosenHook,
  onChooseHook,
}: {
  data: VlogGeneration;
  chosenHook: number;
  onChooseHook: (i: number) => void;
}) {
  return (
    <div
      className="space-y-4 rounded-2xl border border-border bg-secondary/30 p-4"
      dir="auto"
    >
      <Section label="🎯 Angle">
        <p className="text-sm leading-snug">{data.angle}</p>
      </Section>

      <Section label="🪝 Hook — choisis-en un">
        <div className="space-y-1.5">
          {data.hooks.map((h, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChooseHook(i)}
              className={cn(
                "flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-start text-sm transition",
                i === chosenHook
                  ? "border-accent bg-accent/10"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  i === chosenHook
                    ? "border-accent bg-accent text-white"
                    : "border-border",
                )}
              >
                {i === chosenHook && <Check className="size-3" />}
              </span>
              <span className="flex-1">{h}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label="📐 Arc en 3 temps">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            { t: "Situation", v: data.arc.situation },
            { t: "Développement", v: data.arc.development },
            { t: "Chute", v: data.arc.payoff },
          ].map((c) => (
            <div
              key={c.t}
              className="rounded-xl border border-border bg-card p-2.5"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
                {c.t}
              </div>
              <p className="mt-0.5 text-xs leading-snug">{c.v}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section label={`📸 Checklist de capture (${data.captureShots.length})`}>
        <ul className="space-y-1">
          {data.captureShots.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-lg bg-card px-2.5 py-1.5 text-sm"
            >
              <span className="mt-0.5 text-[10px] font-bold tabular-nums text-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1">{s}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="🎙️ Voix-off">
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {data.voiceover}
        </p>
      </Section>

      <Section label="📝 Légende">
        <p className="whitespace-pre-wrap text-sm leading-snug text-foreground/80">
          {data.caption}
        </p>
      </Section>

      <p className="text-xs text-muted">
        « Appliquer » remplit l&apos;onglet Vlog + ajoute les moments à ta
        checklist de capture. Tu pourras tout modifier ensuite.
      </p>
    </div>
  );
}
