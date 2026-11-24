"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KreaWait } from "@/components/krea-wait";
import { aiPlanLongform } from "@/app/(app)/contents/longform-actions";
import type { GenerationLanguage } from "@/lib/ai";
import type { PlannedPart } from "@/lib/ai-longform";

export const LANGUAGE_OPTIONS: { value: GenerationLanguage; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "ar_tn", label: "Arabe tunisien" },
  { value: "ar_msa", label: "Arabe standard" },
  { value: "en", label: "Anglais" },
];

/**
 * Krea propose un plan ; on le lit avant de le prendre. Rien n'est enregistré
 * ici : les parties arrivent dans le formulaire, `SaveFooter` fait le reste.
 */
export function LongformPlanButton({
  contentId,
  defaultTopic,
  language,
  onLanguageChange,
  hasText,
  onApply,
}: {
  contentId: string;
  defaultTopic: string;
  language: GenerationLanguage;
  onLanguageChange: (l: GenerationLanguage) => void;
  /** Des parties déjà écrites : le plan s'ajoute à la suite, il ne remplace pas. */
  hasText: boolean;
  onApply: (parts: PlannedPart[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(defaultTopic);
  const [plan, setPlan] = useState<PlannedPart[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setPlan(null);
    setError(null);
  };

  const generate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await aiPlanLongform({ contentId, topic, language });
        if (res.ok) setPlan(res.parts);
        else setError(res.error);
      } catch {
        setError("La connexion a été coupée. Réessaie.");
      }
    });
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="size-3.5 text-amber-500" />
        Proposer un plan
      </Button>
      {open && (
        <Dialog open onOpenChange={(v) => !v && !pending && close()}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                Proposer un plan
              </DialogTitle>
              <DialogDescription>
                Dis de quoi ça parle. Tu lis le plan avant de le prendre.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              {pending ? (
                <KreaWait
                  steps={[
                    "Je cherche le bon angle…",
                    "Je range les idées dans l'ordre…",
                    "Encore un instant…",
                  ]}
                />
              ) : plan ? (
                <ol className="space-y-2">
                  {plan.map((p, i) => (
                    <li
                      key={i}
                      dir="auto"
                      className="rounded-2xl border border-border/60 bg-secondary/30 p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {i + 1}. {p.title}
                        {p.minutes ? (
                          <span className="ms-2 text-xs font-medium text-muted">
                            {p.minutes} min
                          </span>
                        ) : null}
                      </p>
                      {p.body && (
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                          {p.body}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="longform-topic">De quoi ça parle</Label>
                    <Textarea
                      id="longform-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Ex : comment choisir son premier photographe quand on lance sa boutique"
                      className="min-h-24"
                      dir="auto"
                    />
                  </div>
                  <div className="w-48 space-y-2">
                    <Label htmlFor="longform-language">Langue</Label>
                    <Select
                      id="longform-language"
                      value={language}
                      onValueChange={(v) => onLanguageChange(v as GenerationLanguage)}
                      options={LANGUAGE_OPTIONS}
                    />
                  </div>
                </>
              )}
              {error && !pending && (
                <p
                  role="alert"
                  className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close} disabled={pending}>
                Annuler
              </Button>
              {plan && !pending ? (
                <>
                  <Button type="button" variant="outline" onClick={generate}>
                    Un autre plan
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      onApply(plan);
                      close();
                    }}
                  >
                    {hasText ? "Ajouter à la suite" : "Prendre ce plan"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="min-w-44"
                  onClick={generate}
                  disabled={pending || !topic.trim()}
                >
                  {error ? "Réessayer" : "Proposer un plan"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
