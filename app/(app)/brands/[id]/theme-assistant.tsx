"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Send, Check, Wand2 } from "lucide-react";
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
import {
  themeAssistant,
  applyBrandThemes,
} from "@/app/(app)/brands/taxonomy-actions";
import type { ThemeProposal } from "@/lib/ai";

type Turn = {
  role: "user" | "assistant";
  message: string;
  themes?: ThemeProposal[] | null;
};

/** Objectifs cliquables (langage patron, pas jargon marketing). */
const OBJECTIVES = [
  "Attirer des clients",
  "Rassurer & fidéliser",
  "Me faire connaître",
  "Vendre",
];

export function ThemeAssistant({ brandId }: { brandId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Sparkles className="size-4" />
        Créer mes thèmes avec l&apos;IA
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
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [activity, setActivity] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Tant qu'aucun message n'a été envoyé, on montre le mini-formulaire guidé ;
  // ensuite ça devient une discussion.
  const started = turns.length > 0;

  // Auto-scroll en bas à chaque nouveau message / état de chargement.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [turns, pending]);

  const sendMessage = async (text: string) => {
    const t = text.trim();
    if (!t || pending) return;
    setError(null);
    const nextTurns: Turn[] = [...turns, { role: "user", message: t }];
    setTurns(nextTurns);
    setPending(true);
    try {
      const history = nextTurns.map((tn) => ({
        role: tn.role,
        content:
          tn.role === "assistant"
            ? JSON.stringify({ message: tn.message, themes: tn.themes ?? null })
            : tn.message,
      }));
      const res = await themeAssistant({ brandId, history });
      if (!res.ok) {
        setError(res.error);
      } else {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            message: res.reply.message,
            themes: res.reply.themes,
          },
        ]);
      }
    } catch {
      setError("L'IA n'a pas répondu. Réessaie.");
    } finally {
      setPending(false);
    }
  };

  // Envoi depuis le formulaire de départ (activité + objectif cliqué).
  const start = () => {
    const act = activity.trim();
    if (!act) {
      setError("Décris ton activité en une phrase.");
      return;
    }
    const parts = [`Mon activité : ${act}.`];
    if (objective) parts.push(`Mon objectif principal : ${objective}.`);
    sendMessage(parts.join(" "));
  };

  // Envoi d'un message tapé dans la discussion.
  const sendTyped = () => {
    const t = input.trim();
    if (!t) return;
    setInput("");
    sendMessage(t);
  };

  // Derniers thèmes proposés = ceux du dernier message de l'assistant.
  const lastAssistant = [...turns]
    .reverse()
    .find((t) => t.role === "assistant");
  const currentThemes =
    lastAssistant?.themes && lastAssistant.themes.length > 0
      ? lastAssistant.themes
      : null;

  const apply = async () => {
    if (!currentThemes) return;
    setError(null);
    setApplying(true);
    try {
      const res = await applyBrandThemes({ brandId, themes: currentThemes });
      if (!res.ok) {
        setError(res.error);
      } else {
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
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            Créer mes thèmes avec l&apos;IA
          </DialogTitle>
          <DialogDescription>
            {started
              ? "L'IA propose des thèmes et les ajuste jusqu'à ce que ça te plaise."
              : "Deux réponses simples, et l'IA te propose tes thèmes de contenu."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!started ? (
            /* ---------- Écran de départ : formulaire guidé ---------- */
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  1. Ton activité, pour qui ?
                </Label>
                <Textarea
                  value={activity}
                  onChange={(e) => setActivity(e.target.value)}
                  dir="auto"
                  autoFocus
                  placeholder="Ex : cabinet de podologie à Tunis, pour des gens qui ont mal aux pieds"
                  className="min-h-16 text-sm leading-relaxed [field-sizing:content]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      start();
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  2. Ton objectif principal
                </Label>
                <div className="flex flex-wrap gap-2">
                  {OBJECTIVES.map((o) => {
                    const active = objective === o;
                    return (
                      <button
                        key={o}
                        type="button"
                        onClick={() => setObjective(active ? "" : o)}
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
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="button"
                onClick={start}
                disabled={pending || !activity.trim()}
                className="w-full"
              >
                <Sparkles className="size-4" />
                {pending ? "Un instant…" : "Générer mes thèmes"}
              </Button>
            </div>
          ) : (
            /* ---------- Discussion ---------- */
            <>
              <div
                ref={scrollRef}
                className="max-h-[46vh] space-y-3 overflow-y-auto pr-1"
              >
                {turns.map((t, i) => (
                  <div key={i}>
                    <Bubble role={t.role} text={t.message} />
                    {t.role === "assistant" &&
                      t.themes &&
                      t.themes.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {t.themes.map((th, j) => (
                            <ThemePreview key={j} theme={th} />
                          ))}
                        </div>
                      )}
                  </div>
                ))}
                {pending && <Bubble role="assistant" text="…" muted />}
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              {currentThemes && (
                <Button
                  type="button"
                  onClick={apply}
                  disabled={applying}
                  className="w-full"
                >
                  <Check className="size-4" />
                  {applying
                    ? "Enregistrement…"
                    : `Ajouter ces ${currentThemes.length} thèmes à ma marque`}
                </Button>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendTyped();
                }}
                className="flex items-end gap-2"
              >
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendTyped();
                    }
                  }}
                  placeholder="Ajuste ou réponds… (ex : ajoute un thème sur les coulisses)"
                  dir="auto"
                  disabled={pending}
                  className="min-h-11 flex-1 text-sm [field-sizing:content]"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={pending || !input.trim()}
                  aria-label="Envoyer"
                >
                  {pending ? (
                    <Wand2 className="size-4 animate-pulse" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

function Bubble({
  role,
  text,
  muted,
}: {
  role: "user" | "assistant";
  text: string;
  muted?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        dir="auto"
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-accent text-accent-foreground"
            : "bg-secondary text-foreground",
          muted && "text-muted",
        )}
      >
        {renderBold(text)}
      </div>
    </div>
  );
}

/** Rendu minimal du **gras** markdown dans les bulles. */
function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i}>{p.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={i}>{p}</React.Fragment>
    ),
  );
}

function ThemePreview({ theme }: { theme: ThemeProposal }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-3"
      dir="auto"
    >
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
