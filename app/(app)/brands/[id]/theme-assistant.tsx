"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Check, RefreshCcw, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { KreaBadge } from "@/components/krea-avatar";
import {
  themeAssistant,
  applyBrandThemes,
} from "@/app/(app)/brands/taxonomy-actions";
import type { ThemeProposal } from "@/lib/ai";

/**
 * Assistant de thèmes — format QUESTIONNAIRE GUIDÉ (inspiration Claude design),
 * pas un chat : des questions claires avec champs libres + options cliquables
 * (dont « Décidez pour moi »), un bouton « Générer », puis les thèmes proposés
 * avec Appliquer / Régénérer / ajuster. Pensé pour un patron non-marketeur.
 */

const OBJECTIVES = [
  "Attirer des clients",
  "Rassurer & fidéliser",
  "Me faire connaître",
  "Vendre",
  "Décidez pour moi",
];

const TONES = [
  "Chaleureux & proche",
  "Expert & sérieux",
  "Fun & décalé",
  "Inspirant",
  "Décidez pour moi",
];

const COUNTS = ["3 thèmes", "4 thèmes", "5 thèmes", "Décidez pour moi"];

export function ThemeAssistant({ brandId }: { brandId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Créer mes thèmes avec Krea
      </Button>
      {open && (
        <AssistantModal brandId={brandId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function AssistantModal({
  brandId,
  onClose,
}: {
  brandId: string;
  onClose: () => void;
}) {
  const router = useRouter();

  // Réponses du questionnaire
  const [activity, setActivity] = React.useState("");
  const [audience, setAudience] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [tone, setTone] = React.useState("");
  const [count, setCount] = React.useState("");

  // Phase + état IA
  const [phase, setPhase] = React.useState<"form" | "results">("form");
  const [history, setHistory] = React.useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [themes, setThemes] = React.useState<ThemeProposal[] | null>(null);
  const [message, setMessage] = React.useState("");
  const [adjust, setAdjust] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Envoie un tour à l'IA (brief initial, régénération ou ajustement) et met
  // à jour l'historique + les thèmes proposés.
  const runTurn = async (userContent: string) => {
    setError(null);
    setPending(true);
    const nextHistory = [
      ...history,
      { role: "user" as const, content: userContent },
    ];
    setHistory(nextHistory);
    try {
      const res = await themeAssistant({ brandId, history: nextHistory });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setHistory([
        ...nextHistory,
        { role: "assistant", content: JSON.stringify(res.reply) },
      ]);
      setThemes(res.reply.themes);
      setMessage(res.reply.message);
      setPhase("results");
    } catch {
      setError("L'IA n'a pas répondu. Réessaie.");
    } finally {
      setPending(false);
    }
  };

  const generate = () => {
    if (!activity.trim()) {
      setError("Dis-moi au moins ce que tu fais (question 1).");
      return;
    }
    const brief = [
      `Activité : ${activity.trim()}.`,
      `Clientèle : ${audience.trim() || "non précisée — à toi de deviner"}.`,
      `Objectif principal : ${objective || "à toi de décider"}.`,
      `Ton souhaité : ${tone || "à toi de décider"}.`,
      `Nombre de thèmes : ${count || "à toi de décider (3 à 4)"}.`,
      "Propose directement les thèmes remplis, sans reposer de question.",
    ].join("\n");
    runTurn(brief);
  };

  const sendAdjust = () => {
    const note = adjust.trim();
    if (!note) return;
    setAdjust("");
    runTurn(note);
  };

  const apply = async () => {
    if (!themes || themes.length === 0) return;
    setError(null);
    setApplying(true);
    try {
      const res = await applyBrandThemes({ brandId, themes });
      if (!res.ok) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    } catch {
      setError("Enregistrement échoué. Réessaie.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <KreaBadge className="mb-1" />
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            {phase === "form"
              ? "Quelques questions sur ta marque"
              : "Tes thèmes proposés"}
          </DialogTitle>
          <DialogDescription>
            {phase === "form"
              ? "Réponds simplement — je m'occupe de construire tes thèmes de contenu."
              : "Applique-les, régénère, ou demande un ajustement."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {phase === "form" ? (
            <>
              <div className="max-h-[58vh] space-y-6 overflow-y-auto pr-1">
                <Question
                  n={1}
                  label="Qu'est-ce que tu fais ?"
                  hint="Ton activité, en quelques mots."
                >
                  <Textarea
                    value={activity}
                    onChange={(e) => setActivity(e.target.value)}
                    dir="auto"
                    autoFocus
                    placeholder="Ex : cabinet de podologie à Tunis"
                    className="min-h-14 text-sm leading-relaxed [field-sizing:content]"
                  />
                </Question>

                <Question
                  n={2}
                  label="Pour qui ?"
                  hint="Ta clientèle idéale (optionnel)."
                >
                  <Textarea
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    dir="auto"
                    placeholder="Ex : personnes qui ont mal aux pieds, diabétiques, sportifs"
                    className="min-h-14 text-sm leading-relaxed [field-sizing:content]"
                  />
                </Question>

                <Question
                  n={3}
                  label="Ton objectif principal ?"
                  hint="Ce que tu veux que tes vidéos t'apportent."
                >
                  <Chips options={OBJECTIVES} value={objective} onChange={setObjective} />
                </Question>

                <Question
                  n={4}
                  label="Le ton de tes vidéos ?"
                  hint="Comment tu veux parler à ton audience."
                >
                  <Chips options={TONES} value={tone} onChange={setTone} />
                </Question>

                <Question n={5} label="Combien de thèmes ?" hint="">
                  <Chips options={COUNTS} value={count} onChange={setCount} />
                </Question>
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              <Button
                type="button"
                onClick={generate}
                disabled={pending || !activity.trim()}
                className="w-full"
              >
                <Sparkles className="size-4" />
                {pending ? "Je réfléchis à tes thèmes…" : "Générer mes thèmes"}
              </Button>
            </>
          ) : (
            <>
              <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                {message && (
                  <p
                    dir="auto"
                    className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80"
                  >
                    {message}
                  </p>
                )}
                {themes && themes.length > 0 ? (
                  themes.map((th, j) => <ThemePreview key={j} theme={th} />)
                ) : (
                  <p className="rounded-xl bg-secondary/40 px-3 py-2 text-sm text-muted">
                    Krea a besoin d&apos;une précision — réponds ci-dessous.
                  </p>
                )}
              </div>

              {error && <ErrorNote>{error}</ErrorNote>}

              {themes && themes.length > 0 && (
                <Button
                  type="button"
                  onClick={apply}
                  disabled={applying}
                  className="w-full"
                >
                  <Check className="size-4" />
                  {applying
                    ? "Enregistrement…"
                    : `Ajouter ces ${themes.length} thèmes à ma marque`}
                </Button>
              )}

              {/* Ajuster (façon "dis-moi ce qu'on change") */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendAdjust();
                }}
                className="flex items-end gap-2"
              >
                <Textarea
                  value={adjust}
                  onChange={(e) => setAdjust(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendAdjust();
                    }
                  }}
                  dir="auto"
                  disabled={pending}
                  placeholder="Un ajustement ? (ex : ajoute un thème sur les coulisses)"
                  className="min-h-11 flex-1 text-sm [field-sizing:content]"
                />
                <Button
                  type="submit"
                  size="icon"
                  variant="outline"
                  disabled={pending || !adjust.trim()}
                  aria-label="Envoyer l'ajustement"
                >
                  <Send className={cn("size-4", pending && "animate-pulse")} />
                </Button>
              </form>

              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPhase("form")}
                  disabled={pending}
                >
                  <ArrowLeft className="size-3.5" />
                  Modifier mes réponses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runTurn("Propose une autre version, avec d'autres angles.")}
                  disabled={pending}
                >
                  <RefreshCcw className={cn("size-3.5", pending && "animate-spin")} />
                  Régénérer
                </Button>
              </div>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Sous-composants ============================== */

function Question({
  n,
  label,
  hint,
  children,
}: {
  n: number;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-semibold">
          {n}. {label}
        </Label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** Options cliquables en pastilles (choix unique ; re-cliquer désélectionne). */
function Chips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(active ? "" : o)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm font-medium transition",
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            {o}
          </button>
        );
      })}
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

function ThemePreview({ theme }: { theme: ThemeProposal }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3" dir="auto">
      <div className="flex items-center gap-2">
        <h5 className="text-sm font-bold">{theme.name}</h5>
        {typeof theme.share_pct === "number" && (
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
            {theme.share_pct}%
          </span>
        )}
      </div>
      {theme.objective && (
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">
          {theme.objective}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        {theme.rubriques?.length > 0 && (
          <span>{theme.rubriques.length} rubriques</span>
        )}
        {theme.examples?.length > 0 && (
          <span>{theme.examples.length} exemples</span>
        )}
      </div>
    </div>
  );
}
