"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  MoreVertical,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { KreaWait } from "@/components/krea-wait";
import { cn } from "@/lib/utils";
import { CommentButton } from "@/components/comments/comment-button";
import { aiWritePart, saveLongform } from "@/app/(app)/contents/longform-actions";
import {
  MAX_PARTS,
  MAX_REWRITE_WORDS,
  countWords,
  lengthLabel,
  longformChanges,
  longformSpec,
  mergeLongform,
  type LongformDraft,
  type LongformPart as Part,
} from "@/lib/longform";
import type { GenerationLanguage } from "@/lib/ai";
import type { PlannedPart } from "@/lib/ai-longform";
import type { Content, ContentSection } from "@/lib/types";
import { LongformPlanButton } from "./longform-plan-button";
import { SaveFooter } from "./save-footer";
import { useExplicitSave } from "./use-explicit-save";

const ARABIC = /[؀-ۿ]/;

/** Au-delà, tout déplié ne se parcourt plus : on replie sauf la première. */
const FOLD_FROM = 4;

/**
 * L'éditeur des formats longs — un seul, réglé par `LONGFORM_SPECS` : les
 * chapitres d'une vidéo, le déroulé d'un direct, les questions d'un podcast,
 * les parties d'un article.
 *
 * Krea écrit DANS le formulaire : rien n'est enregistré tant qu'on n'a pas
 * cliqué, et un texte déjà écrit n'est jamais remplacé sans avoir été montré.
 */
export function LongformTab({
  content,
  sections,
  aiEnabled = true,
}: {
  content: Content;
  /** Les parties et l'invité. La transcription vit dans l'onglet Extraits. */
  sections: ContentSection[];
  /** Interrupteur IA de la marque (0054). */
  aiEnabled?: boolean;
}) {
  const spec = longformSpec(content.type)!;

  const initial = useMemo((): LongformDraft => {
    const guest = sections.find((s) => s.kind === "guest");
    return {
      parts: sections
        .filter((s) => s.kind === "section")
        .map((s): Part => ({
          id: s.id,
          title: s.title ?? "",
          body: s.body ?? "",
          minutes: s.minutes,
        })),
      guestName: guest?.title ?? "",
      guestBio: guest?.body ?? "",
    };
  }, [sections]);

  // Ce que la base contient : la sauvegarde n'envoie que la différence.
  const savedRef = useRef<LongformDraft>(initial);
  useEffect(() => {
    savedRef.current = initial;
  }, [initial]);

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(
      initial,
      async (v) => {
        try {
          const res = await saveLongform(
            content.id,
            longformChanges(savedRef.current, v),
          );
          if (!("error" in res)) savedRef.current = v;
          return res;
        } catch {
          return { error: "La connexion a été coupée. Rien n'est perdu ici : réessaie." };
        }
      },
      mergeLongform,
    );

  const [language, setLanguage] = useState<GenerationLanguage>(() =>
    ARABIC.test(`${content.title ?? ""} ${initial.parts[0]?.body ?? ""}`)
      ? "ar_tn"
      : "fr",
  );
  const [openIds, setOpenIds] = useState<Set<string>>(
    () =>
      new Set(
        initial.parts.length > FOLD_FROM
          ? initial.parts.slice(0, 1).map((p) => p.id)
          : initial.parts.map((p) => p.id),
      ),
  );
  const [writing, setWriting] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<{ id: string; text: string } | null>(null);
  /** Une réécriture proposée, à comparer avant de remplacer. */
  const [proposal, setProposal] = useState<{ id: string; text: string } | null>(null);

  const patchPart = (id: string, patch: Partial<Part>) =>
    setState((s) => ({
      ...s,
      parts: s.parts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const openPart = (id: string) => setOpenIds((prev) => new Set(prev).add(id));
  const togglePart = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const addPart = () => {
    const id = crypto.randomUUID();
    setState((s) => ({
      ...s,
      parts: [...s.parts, { id, title: "", body: "", minutes: null }],
    }));
    openPart(id);
  };

  const move = (index: number, delta: -1 | 1) =>
    setState((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.parts.length) return s;
      const parts = [...s.parts];
      [parts[index], parts[to]] = [parts[to], parts[index]];
      return { ...s, parts };
    });

  const remove = (part: Part) => {
    const filled = part.title.trim() || part.body.trim();
    if (filled && !window.confirm(`Supprimer « ${part.title.trim() || "cette partie"} » ?`)) {
      return;
    }
    setState((s) => ({ ...s, parts: s.parts.filter((p) => p.id !== part.id) }));
  };

  const applyPlan = (plan: PlannedPart[]) => {
    const added = plan.map((p): Part => ({
      id: crypto.randomUUID(),
      title: p.title,
      body: p.body,
      minutes: spec.hasMinutes ? p.minutes : null,
    }));
    setState((s) => ({
      ...s,
      // Les parties vides laissent la place, celles qui portent du texte restent.
      parts: [
        ...s.parts.filter((p) => p.title.trim() || p.body.trim()),
        ...added,
      ].slice(0, MAX_PARTS),
    }));
    setOpenIds((prev) => new Set(prev).add(added[0]?.id ?? ""));
  };

  const write = async (part: Part, index: number) => {
    if (writing) return;
    setWriteError(null);
    setProposal(null);
    setWriting(part.id);
    openPart(part.id);
    try {
      const res = await aiWritePart({
        contentId: content.id,
        outline: state.parts.map((p) => p.title),
        index,
        previous: state.parts[index - 1]?.body,
        current: part.body.trim() ? part.body : undefined,
        language,
      });
      if (!res.ok) {
        setWriteError({ id: part.id, text: res.error });
      } else if (part.body.trim()) {
        setProposal({ id: part.id, text: res.text });
      } else {
        // Par identifiant et sur l'état du moment : elle a pu continuer à
        // écrire dans les autres parties pendant l'attente.
        patchPart(part.id, { body: res.text });
      }
    } catch {
      setWriteError({ id: part.id, text: "La connexion a été coupée. Réessaie." });
    } finally {
      setWriting(null);
    }
  };

  const length = lengthLabel(content.type, state.parts);
  const hasText = state.parts.some((p) => p.title.trim() || p.body.trim());

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{spec.tab}</h2>
            <p className="text-xs text-muted">{spec.hint}</p>
            {length && (
              <p className="mt-1 text-sm text-muted-foreground">{length}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
          {/* Les remarques laissées sur le lien public arrivent sur ce fil. */}
          <CommentButton
            targetType="script"
            targetId="script_full"
            ariaLabel={`Commentaires : ${spec.tab}`}
          />
          {aiEnabled && (
            <LongformPlanButton
              contentId={content.id}
              defaultTopic={content.notes?.trim() || content.title || ""}
              language={language}
              onLanguageChange={setLanguage}
              hasText={hasText}
              onApply={applyPlan}
            />
          )}
          </div>
        </div>

        {spec.hasGuest && (
          <details className="rounded-2xl border border-border/60 bg-secondary/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {state.guestName.trim() ? (
                <>
                  Invité : <bdi>{state.guestName}</bdi>
                </>
              ) : (
                "Invité (facultatif)"
              )}
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="guest-name">Nom</Label>
                <Input
                  id="guest-name"
                  dir="auto"
                  value={state.guestName}
                  maxLength={300}
                  onChange={(e) =>
                    setState((s) => ({ ...s, guestName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="guest-bio">Qui c&apos;est</Label>
                <Textarea
                  id="guest-bio"
                  dir="auto"
                  value={state.guestBio}
                  onChange={(e) =>
                    setState((s) => ({ ...s, guestBio: e.target.value }))
                  }
                  placeholder="Sa présentation, telle que tu la dirais."
                  className="min-h-12 text-sm [field-sizing:content]"
                />
              </div>
              <p className="text-xs text-muted sm:col-span-2">
                Ton client voit cette présentation. N&apos;y mets ni téléphone ni
                adresse.
              </p>
            </div>
          </details>
        )}
      </Card>

      {state.parts.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {aiEnabled
              ? "Demande un plan à Krea, ou commence toi-même."
              : "Commence par ta première partie."}
          </p>
        </Card>
      )}

      {state.parts.map((part, i) => {
        const open = openIds.has(part.id);
        const words = countWords(part.body);
        return (
          <Card key={part.id} className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                {i + 1}
              </span>
              <Input
                dir="auto"
                value={part.title}
                maxLength={300}
                onChange={(e) => patchPart(part.id, { title: e.target.value })}
                placeholder={spec.titlePlaceholder}
                aria-label={`Titre, ${spec.part} ${i + 1}`}
                // Mobile : le titre prend sa propre ligne, sous les commandes.
                className="min-w-0 flex-1 font-semibold max-sm:order-last max-sm:basis-full"
              />
              <span className="flex-1 sm:hidden" />
              {!open && words > 0 && (
                <span className="text-xs text-muted">{words} mots</span>
              )}
              {spec.hasMinutes && (
                <label className="flex items-center gap-1 text-xs text-muted">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    value={part.minutes ?? ""}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      patchPart(part.id, {
                        minutes: Number.isNaN(n)
                          ? null
                          : Math.min(600, Math.max(0, n)),
                      });
                    }}
                    aria-label={`Minutes prévues, ${spec.part} ${i + 1}`}
                    className="w-20"
                  />
                  min
                </label>
              )}
              <button
                type="button"
                onClick={() => togglePart(part.id)}
                aria-expanded={open}
                aria-label={open ? "Replier" : "Déplier"}
                className="rounded-full p-2 text-muted transition hover:bg-secondary hover:text-foreground"
              >
                <ChevronDown
                  className={cn("size-4 transition-transform", open && "rotate-180")}
                />
              </button>
              <Dropdown>
                <DropdownTrigger className="rounded-full p-2 text-muted transition hover:bg-secondary hover:text-foreground">
                  <MoreVertical className="size-4" />
                  <span className="sr-only">Actions</span>
                </DropdownTrigger>
                <DropdownContent>
                  <DropdownItem disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-3.5" />
                    Monter
                  </DropdownItem>
                  <DropdownItem
                    disabled={i === state.parts.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown className="size-3.5" />
                    Descendre
                  </DropdownItem>
                  {aiEnabled && part.body.trim() && (
                    <DropdownItem
                      disabled={Boolean(writing) || words > MAX_REWRITE_WORDS}
                      onClick={() => void write(part, i)}
                    >
                      <Sparkles className="size-3.5 text-amber-500" />
                      {words > MAX_REWRITE_WORDS
                        ? "Trop long à réécrire : découpe-le"
                        : "Réécrire avec Krea"}
                    </DropdownItem>
                  )}
                  <DropdownSeparator />
                  <DropdownItem destructive onClick={() => remove(part)}>
                    <Trash2 className="size-3.5" />
                    Supprimer
                  </DropdownItem>
                </DropdownContent>
              </Dropdown>
            </div>

            {open && (
              <div className="space-y-3">
                {writing === part.id ? (
                  <KreaWait
                    steps={[
                      "Je relis ton plan…",
                      "J'écris cette partie…",
                      "Je relis ce que j'ai écrit…",
                      "Encore un instant…",
                    ]}
                  />
                ) : (
                  <Textarea
                    dir="auto"
                    value={part.body}
                    onChange={(e) => patchPart(part.id, { body: e.target.value })}
                    placeholder={spec.bodyPlaceholder}
                    aria-label={`Texte, ${spec.part} ${i + 1}`}
                    className="min-h-24 text-sm leading-relaxed [field-sizing:content]"
                  />
                )}

                {aiEnabled && !part.body.trim() && writing !== part.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={Boolean(writing) || !part.title.trim()}
                    onClick={() => void write(part, i)}
                  >
                    <Sparkles className="size-3.5 text-amber-500" />
                    Écrire avec Krea
                  </Button>
                )}

                {writeError?.id === part.id && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-sm text-destructive"
                  >
                    {writeError.text}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void write(part, i)}
                    >
                      Réessayer
                    </Button>
                  </div>
                )}

                {proposal?.id === part.id && (
                  <div className="space-y-3 rounded-2xl border border-border bg-secondary/30 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">
                      Proposition de Krea
                    </p>
                    <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed">
                      {proposal.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          patchPart(part.id, { body: proposal.text });
                          setProposal(null);
                        }}
                      >
                        Remplacer mon texte
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setProposal(null)}
                      >
                        Garder le mien
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={addPart}
        disabled={state.parts.length >= MAX_PARTS}
      >
        <Plus className="size-4" />
        {spec.addLabel}
      </Button>

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
