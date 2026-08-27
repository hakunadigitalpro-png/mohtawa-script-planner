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
  Pencil,
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
} from "../brand-strategy-actions";
import type { BrandStrategy, GeneratedStrategy } from "@/lib/types";

type Phase = "intro" | "question" | "review" | "generating" | "results";

/**
 * Studio de marque : questionnaire guidé (1 question à la fois, aide +
 * exemple systématiques) qui génère une stratégie de contenu complète et
 * l'applique (sur confirmation) au Brand Kit. Volontairement SANS thèmes de
 * contenu — ça reste le rôle de l'assistant de thèmes existant, pour ne pas
 * dupliquer la même capacité à deux endroits. Complément du Brand Kit / de
 * l'assistant de thèmes existants — ne les remplace pas.
 *
 * L'état (réponses, écran courant) vit ICI, dans le composant qui reste
 * monté tant que la page est ouverte — pas dans la modal elle-même — pour
 * qu'un clic accidentel qui referme la modal ne fasse RIEN perdre : rouvrir
 * reprend exactement là où on en était. Un autosave débouncé persiste aussi
 * les réponses côté serveur pour survivre à un vrai rechargement de page.
 */
export function BrandStudio({
  brandId,
  initialStrategy,
}: {
  brandId: string;
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
  // Le nom de la marque et l'audience ne sont plus demandés : le nom est
  // déjà connu côté serveur, l'audience est un RÉSULTAT de la stratégie.
  const [answers, setAnswers] = React.useState<Record<string, string>>(
    () => ({ ...(initialStrategy?.answers ?? {}) }),
  );
  const [qIndex, setQIndex] = React.useState(0);
  const [generated, setGenerated] = React.useState<GeneratedStrategy | null>(
    initialStrategy?.generated ?? null,
  );
  const [error, setError] = React.useState<string | null>(null);

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
        setPhase("review");
        return;
      }
      setGenerated(res.generated);
      setPhase("results");
      // La stratégie est déjà propagée au Brand Kit côté serveur — on
      // rafraîchit pour que l'identité affichée plus bas soit à jour.
      router.refresh();
    } catch {
      setError("L'IA n'a pas répondu. Réessaie.");
      setPhase("review");
    }
  };

  const goNext = () => {
    if (qIndex + 1 < total) {
      setQIndex(qIndex + 1);
    } else {
      // Dernière question → un récap pour vérifier les réponses avant de
      // lancer l'IA (évite de générer une stratégie générique sur des
      // réponses trop courtes ou laissées telles quelles).
      setPhase("review");
    }
  };

  const goBack = () => {
    if (qIndex === 0) setPhase("intro");
    else setQIndex(qIndex - 1);
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
                    {qIndex + 1 === total ? "Vérifier mes réponses" : "Suivant"}
                    <ArrowRight className="size-4 rtl-flip" />
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}

          {phase === "review" && (
            <ReviewScreen
              answers={answers}
              error={error}
              onEdit={(idx) => {
                setQIndex(idx);
                setPhase("question");
              }}
              onBack={() => {
                setQIndex(total - 1);
                setPhase("question");
              }}
              onConfirm={() => generate(answers)}
            />
          )}

          {phase === "generating" && <GeneratingScreen />}

          {phase === "results" && generated && (
            <ResultsScreen
              generated={generated}
              error={error}
              onClose={() => setOpen(false)}
              onRedo={() => {
                setPhase("question");
                setQIndex(0);
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
        Ton identité de marque ci-dessous en découle — modifiable à tout
        moment. Pour tes thèmes de contenu, utilise l&apos;assistant IA dédié
        plus bas.
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
            "Ton audience, ses galères, et le ton à adopter",
            "Ta méthode expliquée simplement",
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
          ~3 minutes · {STRATEGY_QUESTIONS.length} questions · tu peux revenir
          en arrière à tout moment
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

/**
 * Affiche la réponse d'une question sous une forme lisible pour le récap,
 * et signale si elle semble trop courte pour nourrir une bonne génération
 * (uniquement pour les questions "textarea"/"guided2" — un champ "text"
 * court comme le domaine est normal, pas à signaler).
 */
function getAnswerDisplay(
  question: StrategyQuestion,
  answers: Record<string, string>,
): { text: string; thin: boolean } {
  if (question.type === "guided2" && question.guidedParts) {
    const parts = question.guidedParts.map((p) =>
      (answers[`${question.id}__${p.key}`] ?? "").trim(),
    );
    if (parts.every((p) => !p)) return { text: "", thin: true };
    const text = [
      question.guidedPrefix,
      parts[0] || "…",
      question.guidedJoiner,
      parts[1] || "…",
    ]
      .filter(Boolean)
      .join(" ");
    const thin = parts.some((p) => p.length > 0 && p.length < 3) || parts.some((p) => !p);
    return { text, thin };
  }
  const v = (answers[question.id] ?? "").trim();
  if (!v) return { text: "", thin: true };
  const thin = question.type === "textarea" && v.length < 12;
  return { text: v, thin };
}

function ReviewScreen({
  answers,
  error,
  onEdit,
  onBack,
  onConfirm,
}: {
  answers: Record<string, string>;
  error: string | null;
  onEdit: (qIndex: number) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const rows = STRATEGY_QUESTIONS.map((q, i) => ({
    index: i,
    question: q,
    ...getAnswerDisplay(q, answers),
  }));
  const thinCount = rows.filter(
    (r) => r.thin && !r.question.optional,
  ).length;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          Vérifie tes réponses
        </DialogTitle>
        <DialogDescription>
          {thinCount > 0
            ? `${thinCount} réponse${thinCount > 1 ? "s" : ""} semble${thinCount > 1 ? "nt" : ""} un peu courte${thinCount > 1 ? "s" : ""} — plus tu donnes de détails, plus ta stratégie sera précise. Tu peux quand même générer si tu préfères.`
            : "Tout est prêt. Un dernier coup d'œil avant de lancer la génération ?"}
        </DialogDescription>
      </DialogHeader>
      <DialogBody
        className="max-h-[56vh] space-y-2 overflow-y-auto pr-1"
        dir="auto"
      >
        {rows.map((r) => {
          const flagged = r.thin && !r.question.optional;
          return (
            <button
              key={r.question.id}
              type="button"
              onClick={() => onEdit(r.index)}
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-start text-sm transition hover:bg-secondary/40",
                flagged
                  ? "border-amber-300/60 bg-amber-50/50"
                  : "border-border bg-card",
              )}
            >
              <span className="flex-1">
                <span className="block text-xs font-semibold text-muted">
                  {r.question.label}
                </span>
                <span className="mt-0.5 block text-foreground/90">
                  {r.text || (
                    <span className="italic text-muted">Pas de réponse</span>
                  )}
                </span>
                {flagged && (
                  <span className="mt-1 block text-xs font-medium text-amber-700">
                    Un peu court — clique pour compléter
                  </span>
                )}
              </span>
              <Pencil className="mt-0.5 size-3.5 shrink-0 text-muted" />
            </button>
          );
        })}

        {error && <ErrorNote>{error}</ErrorNote>}
      </DialogBody>
      <DialogFooter className="justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-4 rtl-flip" />
          Retour
        </Button>
        <Button type="button" onClick={onConfirm}>
          <Sparkles className="size-4" />
          Générer ma stratégie
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
  { icon: Users, label: "Je cerne ton audience et ses galères" },
  { icon: MessageCircle, label: "Je choisis ta voix de marque" },
  { icon: Layers, label: "Je clarifie ta méthode" },
] as const;

/**
 * Position (x, y) autour du cœur + poussée de départ (tx, ty, un peu plus
 * loin dans la même direction) pour chacune des 6 pastilles qui
 * s'assemblent en boucle — voir @keyframes studio-build dans globals.css.
 */
const BUILD_DOTS = [
  { x: 26, y: 0, tx: 16, ty: 0 },
  { x: 13, y: 23, tx: 8, ty: 14 },
  { x: -13, y: 23, tx: -8, ty: 14 },
  { x: -26, y: 0, tx: -16, ty: 0 },
  { x: -13, y: -23, tx: -8, ty: -14 },
  { x: 13, y: -23, tx: 8, ty: -14 },
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
      <div
        className="relative flex size-20 items-center justify-center"
        aria-hidden="true"
      >
        {BUILD_DOTS.map((dot, i) => (
          <span
            key={i}
            className={cn(
              "absolute size-2.5 rounded-full animate-studio-build",
              i % 2 === 0 ? "bg-accent" : "bg-accent/60",
            )}
            style={
              {
                top: `calc(50% + ${dot.y}px - 5px)`,
                left: `calc(50% + ${dot.x}px - 5px)`,
                "--tx": `${dot.tx}px`,
                "--ty": `${dot.ty}px`,
                animationDelay: `${i * 0.18}s`,
              } as unknown as React.CSSProperties
            }
          />
        ))}
        <span className="relative flex size-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <Sparkles className="size-6 animate-pulse" />
        </span>
      </div>
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
  error,
  onClose,
  onRedo,
}: {
  generated: GeneratedStrategy;
  error: string | null;
  onClose: () => void;
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
          Elle est déjà appliquée à ta marque — ton slogan, ton audience et ta
          voix en découlent, et l&apos;IA s&apos;en sert pour écrire tes
          contenus. Pour tes thèmes, utilise l&apos;assistant dédié plus bas.
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

        {generated.pain_points?.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-muted">
              Galères de ton audience
            </p>
            <ul className="mt-1.5 space-y-1 text-sm">
              {generated.pain_points.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">•</span>
                  {m}
                </li>
              ))}
            </ul>
          </div>
        )}

        {generated.approach && (
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <p className="text-xs font-semibold text-muted">Ta méthode</p>
            <p className="mt-1 text-sm leading-relaxed">
              {generated.approach}
            </p>
          </div>
        )}

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

        {error && <ErrorNote>{error}</ErrorNote>}
      </DialogBody>
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onRedo}>
          <RefreshCcw className="size-3.5" />
          Refaire le questionnaire
        </Button>
        <Button type="button" onClick={onClose}>
          <Check className="size-4" />
          Terminé
        </Button>
      </DialogFooter>
    </>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
