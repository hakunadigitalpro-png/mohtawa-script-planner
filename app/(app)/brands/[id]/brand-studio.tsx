"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Check,
  RefreshCcw,
  Lightbulb,
  Target,
  Users,
  MessageCircle,
  Layers,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  STRATEGY_SECTIONS,
  STRATEGY_QUESTIONS,
  type StrategyQuestion,
} from "@/lib/brand-strategy-questions";
import {
  saveStrategyAnswers,
  generateBrandStrategyAction,
  applyBrandStrategy,
} from "../brand-strategy-actions";
import type { BrandStrategy, GeneratedStrategy } from "@/lib/types";

type Phase = "intro" | "question" | "generating" | "results";

/**
 * Studio de marque : questionnaire guidé (1 question à la fois, aide +
 * exemple systématiques) qui génère une stratégie de contenu complète et
 * l'applique (sur confirmation) au Brand Kit + aux thèmes de contenu.
 * Complément du Brand Kit / de l'assistant de thèmes existants — ne les
 * remplace pas.
 *
 * L'état (réponses, écran courant) vit ICI, dans le composant qui reste
 * monté tant que la page est ouverte — pas dans la modal elle-même — pour
 * qu'un clic accidentel qui referme la modal ne fasse RIEN perdre : rouvrir
 * reprend exactement là où on en était. Un autosave débouncé persiste aussi
 * les réponses côté serveur pour survivre à un vrai rechargement de page.
 */
export function BrandStudio({
  brandId,
  brandName,
  existingAudience,
  initialStrategy,
}: {
  brandId: string;
  brandName: string;
  existingAudience: string | null;
  initialStrategy: BrandStrategy | null;
}) {
  const router = useRouter();
  // Utilisé UNIQUEMENT pour amorcer l'écran de départ (voir useState
  // ci-dessous) — pour l'affichage, on se base sur l'état `generated` (vit)
  // et non ce prop figé au chargement de la page.
  const hasStrategy = !!initialStrategy?.generated;
  // Le brouillon réellement sauvegardé AVANT cette session (pas le
  // pré-remplissage nom/audience fait ci-dessous) — sert à choisir entre
  // "Commencer" et "Reprendre le questionnaire" sur l'écran d'intro.
  const hasSavedDraft = Object.keys(initialStrategy?.answers ?? {}).length > 0;

  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>(
    hasStrategy ? "results" : "intro",
  );
  const [answers, setAnswers] = React.useState<Record<string, string>>(() => {
    // Pré-remplit avec ce qu'on connaît déjà — pas de double saisie.
    const draft: Record<string, string> = { ...(initialStrategy?.answers ?? {}) };
    if (!draft.brand_name_context && brandName) {
      draft.brand_name_context = brandName;
    }
    if (!draft.ideal_client && existingAudience) {
      draft.ideal_client = existingAudience;
    }
    return draft;
  });
  const [qIndex, setQIndex] = React.useState(0);
  const [generated, setGenerated] = React.useState<GeneratedStrategy | null>(
    initialStrategy?.generated ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  // Autosave débouncé (700ms, même pattern que le reste de l'app) — les
  // réponses survivent même si la personne ferme l'onglet en pleine saisie.
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStrategyAnswers(brandId, answers).catch(() => {});
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, brandId]);

  const question = STRATEGY_QUESTIONS[qIndex];
  const total = STRATEGY_QUESTIONS.length;
  const value = answers[question?.id ?? ""] ?? "";

  const canContinue = React.useMemo(() => {
    if (!question) return false;
    if (question.optional) return true;
    if (question.type === "guided2" && question.guidedParts) {
      return question.guidedParts.every(
        (p) => (answers[`${question.id}__${p.key}`] ?? "").trim().length > 0,
      );
    }
    return value.trim().length > 0;
  }, [question, answers, value]);

  const setAnswerKey = (key: string, v: string) => {
    setAnswers((prev) => ({ ...prev, [key]: v }));
  };

  const generate = async (finalAnswers: Record<string, string>) => {
    setError(null);
    setPhase("generating");
    try {
      const res = await generateBrandStrategyAction(brandId, finalAnswers);
      if (!res.ok) {
        setError(res.error);
        setPhase("question");
        setQIndex(total - 1);
        return;
      }
      setGenerated(res.generated);
      setPhase("results");
    } catch {
      setError("L'IA n'a pas répondu. Réessaie.");
      setPhase("question");
      setQIndex(total - 1);
    }
  };

  const goNext = () => {
    if (qIndex + 1 < total) {
      setQIndex(qIndex + 1);
    } else {
      generate(answers);
    }
  };

  const goBack = () => {
    if (qIndex === 0) setPhase("intro");
    else setQIndex(qIndex - 1);
  };

  const apply = async () => {
    if (!generated) return;
    setError(null);
    setApplying(true);
    try {
      const res = await applyBrandStrategy(brandId, generated);
      if (!res.ok) setError(res.error);
      else {
        setApplied(true);
        router.refresh();
      }
    } catch {
      setError("Application échouée. Réessaie.");
    } finally {
      setApplying(false);
    }
  };

  // Fermeture "sûre" via le bouton X / clic hors modal : autorisée seulement
  // sur les écrans où il n'y a rien à perdre (intro, résultats). Pendant le
  // questionnaire ou la génération, seul le bouton X reste actif (dismissible
  // du Dialog est coupé pour le fond + Échap) — voir le composant Dialog.
  const dismissible = phase === "intro" || phase === "results";

  return (
    <>
      {generated ? (
        <StrategyHero
          generated={generated}
          onAdjust={() => {
            setPhase("results");
            setOpen(true);
          }}
        />
      ) : (
        <div className="rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <Sparkles className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Stratégie de contenu</h2>
                <p className="text-sm text-muted">
                  Réponds à quelques questions simples pour obtenir ta
                  stratégie de contenu sur mesure — elle guidera ton
                  identité et tes thèmes ci-dessous.
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => {
                setPhase("intro");
                setOpen(true);
              }}
            >
              <Sparkles className="size-4" />
              Commencer
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        dismissible={dismissible}
      >
        <DialogContent className="max-w-2xl">
          {phase === "intro" && (
            <IntroScreen
              hasDraft={hasSavedDraft}
              onStart={() => setPhase("question")}
            />
          )}

          {phase === "question" && question && (
            <>
              <DialogHeader>
                <SectionProgress
                  currentSection={question.section}
                  qIndex={qIndex}
                  total={total}
                />
                <DialogTitle className="mt-2">{question.label}</DialogTitle>
                <DialogDescription>{question.help}</DialogDescription>
              </DialogHeader>
              <DialogBody className="space-y-4">
                <ExampleBox text={question.example} />
                <QuestionInput
                  question={question}
                  answers={answers}
                  onChange={setAnswerKey}
                />
                {error && <ErrorNote>{error}</ErrorNote>}
              </DialogBody>
              <DialogFooter className="justify-between">
                <Button type="button" variant="ghost" onClick={goBack}>
                  <ArrowLeft className="size-4 rtl-flip" />
                  Retour
                </Button>
                <div className="flex items-center gap-2">
                  {question.optional && !value.trim() && (
                    <Button type="button" variant="ghost" onClick={goNext}>
                      Passer
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={!canContinue}
                  >
                    {qIndex + 1 === total ? "Générer ma stratégie" : "Suivant"}
                    <ArrowRight className="size-4 rtl-flip" />
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}

          {phase === "generating" && <GeneratingScreen />}

          {phase === "results" && generated && (
            <ResultsScreen
              generated={generated}
              applying={applying}
              applied={applied}
              error={error}
              onApply={apply}
              onRedo={() => {
                setPhase("question");
                setQIndex(0);
                setApplied(false);
                setError(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Résumé condensé affiché directement sur la page (pas dans une modal) une
 * fois la stratégie appliquée : uniquement ce qui n'existe nulle part
 * ailleurs (positionnement, tagline, messages clés). L'audience, la voix et
 * les thèmes complets vivent dans les cartes Identité / Thèmes ci-dessous —
 * on ne les réaffiche pas ici pour éviter le doublon.
 */
function StrategyHero({
  generated,
  onAdjust,
}: {
  generated: GeneratedStrategy;
  onAdjust: () => void;
}) {
  return (
    <div
      className="rounded-3xl border border-accent/25 bg-gradient-to-br from-accent/10 via-card to-card p-5 sm:p-6"
      dir="auto"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Stratégie de contenu</h2>
            <p className="mt-1 text-base font-medium leading-relaxed text-foreground">
              {generated.positioning}
            </p>
            {generated.tagline && (
              <p className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-xs font-semibold">
                « {generated.tagline} »
              </p>
            )}
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onAdjust}>
          Ajuster ma stratégie
        </Button>
      </div>

      {generated.key_messages?.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {generated.key_messages.map((m, i) => (
            <li
              key={i}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80"
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        Ton identité et tes thèmes de contenu ci-dessous en découlent —
        modifiables à tout moment.
      </p>
    </div>
  );
}

/* ============================== Écrans ============================== */

function IntroScreen({
  hasDraft,
  onStart,
}: {
  hasDraft: boolean;
  onStart: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-2xl">
          <Sparkles className="size-6 text-accent" />
          Créons ta stratégie, ensemble
        </DialogTitle>
        <DialogDescription>
          Tu vas répondre à quelques questions simples — avec une explication
          et un exemple à chaque étape, tu ne peux pas te tromper. Plus tu
          prends le temps d&apos;être précis(e), plus la stratégie que
          l&apos;IA construit sera adaptée à TON objectif. Ça, il n&apos;y a
          que toi qui le sais : c&apos;est ton business.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <ul className="space-y-2.5 text-sm">
          {[
            "Ton positionnement, en une phrase claire",
            "Ton audience et le ton à adopter",
            "3 à 4 thèmes de contenu prêts à utiliser",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Check className="size-3" />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          ~3 minutes · 12 questions · tu peux revenir en arrière à tout moment
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" onClick={onStart} className="w-full" size="lg">
          <Sparkles className="size-4" />
          {hasDraft ? "Reprendre le questionnaire" : "Commencer"}
        </Button>
      </DialogFooter>
    </>
  );
}

function SectionProgress({
  currentSection,
  qIndex,
  total,
}: {
  currentSection: string;
  qIndex: number;
  total: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {STRATEGY_SECTIONS.map((s) => {
          const active = s.key === currentSection;
          return (
            <span
              key={s.key}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-semibold transition",
                active
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted",
              )}
            >
              {s.emoji} {s.title}
            </span>
          );
        })}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${((qIndex + 1) / total) * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        Question {qIndex + 1} / {total}
      </p>
    </div>
  );
}

function ExampleBox({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl border border-accent/20 bg-accent/5 px-3.5 py-3 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-accent" />
      <p dir="auto" className="leading-relaxed text-foreground/80">
        <span className="font-semibold text-foreground">Exemple : </span>
        {text}
      </p>
    </div>
  );
}

function QuestionInput({
  question,
  answers,
  onChange,
}: {
  question: StrategyQuestion;
  answers: Record<string, string>;
  onChange: (key: string, v: string) => void;
}) {
  if (question.type === "guided2" && question.guidedParts) {
    return (
      <div className="flex flex-wrap items-center gap-2" dir="auto">
        {question.guidedPrefix && (
          <span className="text-sm font-semibold text-foreground/70">
            {question.guidedPrefix}
          </span>
        )}
        {question.guidedParts.map((part, i) => {
          const key = `${question.id}__${part.key}`;
          return (
            <React.Fragment key={key}>
              {i > 0 && question.guidedJoiner && (
                <span className="text-sm font-semibold text-foreground/70">
                  {question.guidedJoiner}
                </span>
              )}
              <Input
                autoFocus={i === 0}
                value={answers[key] ?? ""}
                onChange={(e) => onChange(key, e.target.value)}
                dir="auto"
                aria-label={part.label}
                placeholder={part.placeholder}
                className="w-auto min-w-[10rem] flex-1"
              />
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  const value = answers[question.id] ?? "";

  if (question.type === "chips" && question.chips) {
    const selected = value
      ? value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const toggle = (opt: string) => {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onChange(question.id, next.join(", "));
    };
    return (
      <div className="flex flex-wrap gap-2">
        {question.chips.map((opt) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                "rounded-full border px-3.5 py-2 text-sm font-medium transition",
                active
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  if (question.type === "textarea") {
    return (
      <Textarea
        key={question.id}
        autoFocus
        value={value}
        onChange={(e) => onChange(question.id, e.target.value)}
        dir="auto"
        placeholder={`Ex : ${question.example}`}
        className="min-h-24 text-sm leading-relaxed [field-sizing:content]"
      />
    );
  }

  return (
    <Input
      key={question.id}
      autoFocus
      value={value}
      onChange={(e) => onChange(question.id, e.target.value)}
      dir="auto"
      placeholder={`Ex : ${question.example}`}
    />
  );
}

const GENERATION_STEPS = [
  { icon: Target, label: "Je découpe ton positionnement" },
  { icon: Users, label: "Je cerne ton audience" },
  { icon: MessageCircle, label: "Je choisis ta voix de marque" },
  { icon: Layers, label: "Je pose tes thèmes de contenu" },
] as const;

function GeneratingScreen() {
  const [stepIndex, setStepIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, GENERATION_STEPS.length - 1));
    }, 1300);
    return () => clearInterval(id);
  }, []);

  return (
    <DialogBody className="flex flex-col items-center gap-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent">
        <Sparkles className="size-6 animate-pulse" />
      </span>
      <div>
        <p className="font-semibold">Je construis ta stratégie…</p>
        <p className="mt-1 text-sm text-muted">
          Quelques secondes, le temps de tout assembler.
        </p>
      </div>
      <ul className="w-full max-w-xs space-y-2.5 text-start">
        {GENERATION_STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <li
              key={step.label}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-all duration-500",
                done && "border-emerald-300/50 bg-emerald-50/60 text-foreground",
                active && "border-accent/40 bg-accent/5 text-foreground",
                !done &&
                  !active &&
                  "border-border/60 bg-secondary/30 text-muted",
              )}
            >
              {done ? (
                <Check className="size-4 shrink-0 text-emerald-600" />
              ) : (
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active && "animate-pulse text-accent",
                  )}
                />
              )}
              {step.label}
            </li>
          );
        })}
      </ul>
    </DialogBody>
  );
}

function ResultsScreen({
  generated,
  applying,
  applied,
  error,
  onApply,
  onRedo,
}: {
  generated: GeneratedStrategy;
  applying: boolean;
  applied: boolean;
  error: string | null;
  onApply: () => void;
  onRedo: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          Ta stratégie est prête
        </DialogTitle>
        <DialogDescription>
          Vérifie, puis applique-la à ta marque — elle remplira ton identité
          et tes thèmes de contenu.
        </DialogDescription>
      </DialogHeader>
      <DialogBody
        className="max-h-[58vh] space-y-4 overflow-y-auto pr-1"
        dir="auto"
      >
        <div className="rounded-2xl border border-accent/25 bg-accent/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Positionnement
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed">
            {generated.positioning}
          </p>
          {generated.tagline && (
            <p className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-xs font-semibold">
              « {generated.tagline} »
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-muted">Audience</p>
            <p className="mt-1 text-sm leading-relaxed">
              {generated.audience_summary}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-muted">
              Voix de marque
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {generated.voice_summary}
            </p>
          </div>
        </div>

        {generated.key_messages?.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-muted">
              Messages clés à répéter
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {generated.key_messages.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">•</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {generated.pillars?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted">
              Thèmes de contenu proposés
            </p>
            {generated.pillars.map((p, i) => (
              <PillarPreview key={i} pillar={p} />
            ))}
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
      </DialogBody>
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRedo}
          disabled={applying}
        >
          <RefreshCcw className="size-3.5" />
          Refaire le questionnaire
        </Button>
        {applied ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <Check className="size-4" />
            Appliquée à ta marque
          </span>
        ) : (
          <Button type="button" onClick={onApply} disabled={applying}>
            <Check className="size-4" />
            {applying ? "Application…" : "Appliquer à ma marque"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function PillarPreview({
  pillar,
}: {
  pillar: GeneratedStrategy["pillars"][number];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <h5 className="text-sm font-bold">{pillar.name}</h5>
        {typeof pillar.share_pct === "number" && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
            {pillar.share_pct}%
          </span>
        )}
      </div>
      {pillar.objective && (
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">
          {pillar.objective}
        </p>
      )}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
