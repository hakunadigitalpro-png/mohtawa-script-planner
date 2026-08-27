"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  FileDown,
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
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  STRATEGY_QUESTIONS,
  pendingFollowups,
  type StrategyQuestion,
} from "@/lib/brand-strategy-questions";
import {
  saveStrategyAnswers,
  generateBrandStrategyAction,
} from "../brand-strategy-actions";
import type { BrandStrategy, GeneratedStrategy } from "@/lib/types";

type Phase = "intro" | "question" | "generating" | "results";

/**
 * Studio de marque. La personne raconte son activité en UNE fois + un clic
 * sur son objectif : l'IA extrait le reste et produit la stratégie, appliquée
 * automatiquement au Brand Kit.
 *
 * Les relances (preuve chiffrée, légitimité, histoire) arrivent APRÈS, sur
 * l'écran de résultats, une fois la valeur démontrée — ce sont des faits que
 * l'IA ne peut pas inventer honnêtement, mais les demander d'entrée ferait
 * fuir. Elles restent facultatives et se répondent d'un bloc, pour ne
 * déclencher qu'UNE régénération.
 *
 * Volontairement SANS thèmes de contenu — ça reste le rôle de l'assistant de
 * thèmes existant, pour ne pas dupliquer la même capacité à deux endroits.
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
    if (question.type === "guided" && question.guidedParts) {
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
    // En cas d'échec on revient à l'écran d'où on venait : la dernière
    // question si on générait pour la 1re fois, les résultats si on était en
    // train de renforcer une stratégie déjà produite.
    const fallback: Phase = generated ? "results" : "question";
    setPhase("generating");
    try {
      const res = await generateBrandStrategyAction(brandId, finalAnswers);
      if (!res.ok) {
        setError(res.error);
        setPhase(fallback);
        return;
      }
      setGenerated(res.generated);
      setPhase("results");
      // La stratégie est déjà propagée au Brand Kit côté serveur — on
      // rafraîchit pour que l'identité affichée plus bas soit à jour.
      router.refresh();
    } catch {
      setError("L'IA n'a pas répondu. Réessaie.");
      setPhase(fallback);
    }
  };

  // Avec 2 questions, pas d'écran de récap : la dernière lance directement
  // la génération — une étape de moins.
  const goNext = () => {
    if (qIndex + 1 < total) setQIndex(qIndex + 1);
    else generate(answers);
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
          brandId={brandId}
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
                  Une phrase à compléter, et je m&apos;occupe du reste — ta
                  stratégie guidera ensuite ton identité, tes thèmes et tout
                  ce que l&apos;IA écrit pour toi.
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
        {/* Les résultats méritent toute la largeur disponible : c'est un
            tableau de bord à parcourir, pas une question à lire. */}
        <DialogContent
          className={cn(phase === "results" ? "max-w-5xl" : "max-w-2xl")}
        >
          {phase === "intro" && (
            <IntroScreen
              hasDraft={hasSavedDraft}
              onStart={() => setPhase("question")}
            />
          )}

          {phase === "question" && question && (
            <>
              <DialogHeader>
                <SectionProgress qIndex={qIndex} total={total} />
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
                    {qIndex + 1 === total ? "Créer ma stratégie" : "Suivant"}
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
              error={error}
              followups={pendingFollowups(answers)}
              answers={answers}
              onAnswer={setAnswerKey}
              onStrengthen={() => generate(answers)}
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
  brandId,
  generated,
  onAdjust,
}: {
  brandId: string;
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
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Export : page imprimable + print-to-PDF du navigateur, comme
              pour les contenus (pas de librairie PDF). */}
          <Link
            href={`/print/strategy/${brandId}`}
            target="_blank"
            rel="noopener"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold hover:bg-secondary"
          >
            <FileDown className="size-3.5" />
            Télécharger
          </Link>
          <Button type="button" variant="outline" onClick={onAdjust}>
            Ajuster ma stratégie
          </Button>
        </div>
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
          Une phrase à compléter en trois mots-clés, un clic sur ton objectif,
          et c&apos;est tout. Je m&apos;occupe du reste.
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        <p className="text-sm text-muted">Tu repars avec :</p>
        <ul className="space-y-2.5 text-sm">
          {[
            "Ton positionnement, en une phrase claire",
            "Ton audience, ses galères, et le ton à adopter",
            "Ta méthode expliquée simplement",
            "Tes hashtags récurrents",
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
          ~1 minute · {STRATEGY_QUESTIONS.length} questions
        </p>
      </DialogBody>
      <DialogFooter>
        <Button type="button" onClick={onStart} className="w-full" size="lg">
          <Sparkles className="size-4" />
          {hasDraft ? "Reprendre" : "Commencer"}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Progression : plus de sections, il ne reste que 2 questions. */
function SectionProgress({ qIndex, total }: { qIndex: number; total: number }) {
  return (
    <div className="space-y-2">
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
  // Phrase à trous : chaque blanc porte son propre mot de liaison, pour que
  // l'ensemble se lise comme une vraie phrase et pas comme un formulaire.
  if (question.type === "guided" && question.guidedParts) {
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
              {part.before && (
                <span className="text-sm font-semibold text-foreground/70">
                  {part.before}
                </span>
              )}
              <Input
                autoFocus={i === 0}
                value={answers[key] ?? ""}
                onChange={(e) => onChange(key, e.target.value)}
                dir="auto"
                aria-label={part.label}
                placeholder={part.placeholder}
                className="w-auto min-w-[12rem] flex-1"
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
  followups,
  answers,
  onAnswer,
  onStrengthen,
  onClose,
  onRedo,
}: {
  generated: GeneratedStrategy;
  error: string | null;
  followups: StrategyQuestion[];
  answers: Record<string, string>;
  onAnswer: (key: string, v: string) => void;
  onStrengthen: () => void;
  onClose: () => void;
  onRedo: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          Ta stratégie de contenu
        </DialogTitle>
        <DialogDescription>
          Déjà appliquée à ta marque — l&apos;IA s&apos;en sert pour écrire tes
          contenus.
        </DialogDescription>
      </DialogHeader>

      {/* Pas de hauteur max : la modale s'étire et c'est la page qui défile.
          Un seul scroll au lieu d'un cadre étroit dans un grand écran. */}
      <DialogBody className="space-y-4" dir="auto">
        {/* Le positionnement porte tout le document : traité comme une
            couverture, pas comme une carte parmi d'autres. */}
        <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-orange/30 blur-3xl"
          />
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-44 rounded-full bg-lavender/25 blur-3xl"
          />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-soft">
              Positionnement
            </p>
            <p className="mt-3 text-xl font-bold leading-snug sm:text-2xl">
              {generated.positioning}
            </p>
            {generated.tagline && (
              <p className="mt-4 inline-block rounded-full bg-orange px-4 py-1.5 text-sm font-semibold">
                « {generated.tagline} »
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StrategyCard
            n="01"
            icon={<Users className="size-4" />}
            title="Ton audience"
            tone="lavender"
          >
            <p>{generated.audience_summary}</p>
          </StrategyCard>

          <StrategyCard
            n="02"
            icon={<Target className="size-4" />}
            title="Ce qui la bloque"
            tone="orange"
          >
            <BulletList items={generated.pain_points ?? []} />
          </StrategyCard>

          <StrategyCard
            n="03"
            icon={<MessageCircle className="size-4" />}
            title="Ta voix"
            tone="lavender"
          >
            <p>{generated.voice_summary}</p>
          </StrategyCard>

          <StrategyCard
            n="04"
            icon={<Lightbulb className="size-4" />}
            title="Ta méthode"
            tone="cream"
          >
            <p>{generated.approach}</p>
          </StrategyCard>
        </div>

        {generated.key_messages?.length > 0 && (
          <StrategyCard
            n="05"
            icon={<Layers className="size-4" />}
            title="À répéter dans ton contenu"
            tone="orange"
          >
            <div className="grid gap-2 sm:grid-cols-3">
              {generated.key_messages.map((m, i) => (
                <p
                  key={i}
                  className="rounded-xl bg-card px-3 py-2.5 text-sm font-medium"
                >
                  {m}
                </p>
              ))}
            </div>
          </StrategyCard>
        )}

        {generated.hashtags?.length > 0 && (
          <StrategyCard
            n="06"
            icon={<Sparkles className="size-4" />}
            title="Tes hashtags récurrents"
            tone="cream"
          >
            <ul className="flex flex-wrap gap-1.5">
              {generated.hashtags.map((h, i) => (
                <li
                  key={i}
                  className="rounded-lg bg-card px-2.5 py-1 text-xs font-semibold"
                >
                  #{h}
                </li>
              ))}
            </ul>
          </StrategyCard>
        )}

        {/* Relances : des faits que l'IA ne peut pas inventer. Groupées et
            facultatives — une seule régénération quand elle le décide. */}
        {followups.length > 0 && (
          <div className="space-y-3 rounded-2xl border border-dashed border-accent/40 bg-accent/5 p-5">
            <div>
              <p className="text-sm font-semibold">
                Renforcer ta stratégie (facultatif)
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Ces informations-là, moi je ne peux pas les deviner — et ce
                sont elles qui rendent une stratégie vraiment convaincante.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {followups.map((q) => (
                <div key={q.id} className="space-y-1">
                  <Label className="text-sm font-semibold">{q.label}</Label>
                  <Textarea
                    value={answers[q.id] ?? ""}
                    onChange={(e) => onAnswer(q.id, e.target.value)}
                    dir="auto"
                    placeholder={`Ex : ${q.example}`}
                    className="min-h-16 text-sm leading-relaxed [field-sizing:content]"
                  />
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={onStrengthen}
              disabled={followups.every((q) => !(answers[q.id] ?? "").trim())}
            >
              <Sparkles className="size-4" />
              Améliorer ma stratégie
            </Button>
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
      </DialogBody>
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={onRedo}>
          <RefreshCcw className="size-3.5" />
          Recommencer
        </Button>
        <Button type="button" onClick={onClose}>
          <Check className="size-4" />
          Terminé
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Section de la stratégie, façon livrable d'agence : numérotée, avec son
 * icône dans un carré teinté. Les teintes viennent UNIQUEMENT de la charte
 * (orange, lavande, crème) — pas de couleur importée d'ailleurs.
 */
const CARD_TONES = {
  orange: {
    bg: "bg-orange-soft/50",
    iconBg: "bg-orange/15",
    fg: "text-orange-strong",
  },
  lavender: {
    bg: "bg-lavender-soft/50",
    iconBg: "bg-lavender/15",
    fg: "text-lavender-strong",
  },
  cream: { bg: "bg-secondary", iconBg: "bg-ink/10", fg: "text-ink" },
} as const;

function StrategyCard({
  n,
  icon,
  title,
  tone,
  children,
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  tone: keyof typeof CARD_TONES;
  children: React.ReactNode;
}) {
  const t = CARD_TONES[tone];
  return (
    <div className={cn("rounded-2xl p-5", t.bg)}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            t.iconBg,
            t.fg,
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <span className="block text-[10px] font-bold tracking-[0.16em] text-muted">
            {n}
          </span>
          <h3 className="truncate text-sm font-bold leading-tight">{title}</h3>
        </div>
      </div>
      <div className="text-sm leading-relaxed text-foreground/85">
        {children}
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((m, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-current opacity-40" />
          {m}
        </li>
      ))}
    </ul>
  );
}


function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
