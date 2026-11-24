"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  detectLanguage,
  lengthLabel,
  longformChanges,
  longformSpec,
  mergeLongform,
  type LongformDraft,
  type LongformPart as Part,
} from "@/lib/longform";
import type { GenerationLanguage } from "@/lib/ai";
import type { PlannedPart } from "@/lib/ai-longform";
import {
  DEFAULT_WORDS,
  articleRole,
  briefSummary,
  isEdgeRole,
  orderParts,
  partNumber,
  setNumbering,
  withRoles,
  type ArticleBrief,
} from "@/lib/article";
import { checkArticle } from "@/lib/article-checks";
import { restoreArticle } from "@/app/(app)/contents/article-actions";
import type { ArticleClaim, Content, ContentSection } from "@/lib/types";
import { ClaimsCard, ReviewLine } from "./article-side";
import { ArticleWriterButton } from "./article-writer";
import { LongformPlanButton } from "./longform-plan-button";
import { SaveFooter } from "./save-footer";
import { useExplicitSave } from "./use-explicit-save";

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
  article,
  aiEnabled = true,
}: {
  content: Content;
  /** Article seulement : le brief, ce qu'il reste à valider, la version d'avant. */
  article?: {
    brief: ArticleBrief | null;
    claims: ArticleClaim[];
    versions: { at: string; title: string }[];
  };
  /** Les parties et l'invité. La transcription vit dans l'onglet Extraits. */
  sections: ContentSection[];
  /** Interrupteur IA de la marque (0054). */
  aiEnabled?: boolean;
}) {
  const spec = longformSpec(content.type)!;
  const router = useRouter();
  const isArticle = content.type === "article";

  const initial = useMemo((): LongformDraft => {
    const guest = sections.find((s) => s.kind === "guest");
    return {
      subtitle: content.subtitle ?? "",
      parts: sections
        .filter((s) => s.kind === "section")
        .map((s): Part => ({
          id: s.id,
          title: s.title ?? "",
          body: s.body ?? "",
          minutes: s.minutes,
          role: s.role ?? null,
        })),
      guestName: guest?.title ?? "",
      guestBio: guest?.body ?? "",
    };
  }, [sections, content.subtitle]);

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
      // L'introduction ouvre et la conclusion ferme, même après une fusion.
      (current, base, incoming) => {
        const merged = mergeLongform(current, base, incoming);
        return isArticle ? { ...merged, parts: orderParts(merged.parts) } : merged;
      },
    );

  const [pickedLanguage, setLanguage] = useState<GenerationLanguage>(() =>
    detectLanguage(
      [content.title, ...initial.parts.slice(0, 3).map((p) => p.body)].join(" "),
    ),
  );
  // Une seule langue par article : celle de son brief.
  const language = article?.brief?.language ?? pickedLanguage;
  const [openIds, setOpenIds] = useState<Set<string>>(
    () =>
      new Set(
        // Un article se lit d'un trait : on ne le replie pas.
        !isArticle && initial.parts.length > FOLD_FROM
          ? initial.parts.slice(0, 1).map((p) => p.id)
          : initial.parts.map((p) => p.id),
      ),
  );
  const [seenIds, setSeenIds] = useState(() => new Set(initial.parts.map((p) => p.id)));
  const fresh = isArticle ? initial.parts.filter((p) => !seenIds.has(p.id)) : [];
  if (fresh.length > 0) {
    // Un article vient d'être remplacé : ses nouvelles parties s'ouvrent.
    setSeenIds(new Set(initial.parts.map((p) => p.id)));
    setOpenIds((prev) => new Set([...prev, ...fresh.map((p) => p.id)]));
  }
  const [restoring, startRestore] = useTransition();
  const [restoreError, setRestoreError] = useState<string | null>(null);
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
    setState((s) => {
      // Un article d'avant les rôles n'en reçoit pas à la sauvette : il garderait
      // ses numéros sur la nouvelle partie et les perdrait sur les autres.
      const roles = isArticle && s.parts.some((p) => p.role);
      const role = roles ? (s.parts.some((p) => p.role === "item") ? "item" : "text") : null;
      const parts = [...s.parts, { id, title: "", body: "", minutes: null, role }];
      // La conclusion reste à la fin, quoi qu'on ajoute.
      return { ...s, parts: isArticle ? orderParts(parts) : parts };
    });
    openPart(id);
  };

  const move = (index: number, delta: -1 | 1) =>
    setState((s) => {
      const to = index + delta;
      if (to < 0 || to >= s.parts.length) return s;
      if (isEdgeRole(s.parts[index].role) || isEdgeRole(s.parts[to].role)) return s;
      const parts = [...s.parts];
      [parts[index], parts[to]] = [parts[to], parts[index]];
      return { ...s, parts };
    });

  const setRole = (id: string, role: "intro" | "text" | "outro") =>
    setState((s) => ({
      ...s,
      parts: orderParts(
        withRoles(s.parts).map((p, _, all) =>
          p.id === id
            ? {
                ...p,
                role: role === "text" && all.some((x) => x.role === "item") ? "item" : role,
              }
            : p,
        ),
      ),
    }));

  const goToPart = (id: string) => {
    openPart(id);
    requestAnimationFrame(() =>
      document
        .getElementById(`part-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  const restore = (at: string) => {
    if (
      !window.confirm(
        "Remettre cette version ? L'actuelle reste dans la liste. Ce qui n'est pas enregistré est perdu.",
      )
    ) {
      return;
    }
    setRestoreError(null);
    startRestore(async () => {
      try {
        const res = await restoreArticle(content.id, at);
        if (!res.ok) {
          setRestoreError(res.error);
          return;
        }
        handleReset();
        router.refresh();
      } catch {
        setRestoreError("La connexion a été coupée. Réessaie.");
      }
    });
  };

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

  const issues = isArticle
    ? checkArticle({
        title: content.title ?? "",
        subtitle: state.subtitle,
        parts: withRoles(state.parts).map((p) => ({ ...p, role: articleRole(p.role) })),
        shareText: "",
        targetWords: article?.brief?.words ?? DEFAULT_WORDS,
        contact: article?.brief?.contact,
      })
    : [];

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
        ...(isArticle
          ? {
              role: part.role,
              fixes: issues.filter((x) => x.partId === part.id).map((x) => x.message),
            }
          : {}),
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
  const brief = article?.brief ?? null;
  const summary = brief ? briefSummary(brief) : "";
  const numbered = withRoles(state.parts).some((p) => p.role === "item");
  const hasIntro = state.parts.some((p) => p.role === "intro");
  const hasOutro = state.parts.some((p) => p.role === "outro");

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
          {aiEnabled && isArticle && (
            <ArticleWriterButton
              contentId={content.id}
              hasText={hasText || Boolean(content.caption?.trim())}
              accent={!hasText}
              label={hasText ? "Réécrire l'article" : "Écrire l'article"}
              onApplied={() => {
                // On repart de ce qui est enregistré : la fusion remplace alors
                // toutes les parties par celles du nouvel article.
                handleReset();
                router.refresh();
              }}
            />
          )}
          {aiEnabled && !isArticle && (
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

        {isArticle && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="article-subtitle">Sous-titre</Label>
              <Input
                id="article-subtitle"
                dir="auto"
                value={state.subtitle ?? ""}
                maxLength={300}
                placeholder="Une ligne qui dit pour qui et pourquoi"
                onChange={(e) => setState((s) => ({ ...s, subtitle: e.target.value }))}
              />
            </div>
            {summary && (
              <p dir="auto" className="truncate text-xs text-muted">
                Brief : {summary}
              </p>
            )}
            {hasText && <ReviewLine issues={issues} onGoTo={goToPart} />}
            {article && article.versions.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">
                  Remettre une version d&apos;avant
                </summary>
                <ul className="mt-2 space-y-1">
                  {article.versions.map((v) => (
                    <li key={v.at}>
                      <button
                        type="button"
                        disabled={restoring}
                        onClick={() => restore(v.at)}
                        className="flex min-h-11 w-full flex-wrap items-center gap-x-2 text-start hover:underline disabled:opacity-50"
                      >
                        <span dir="auto" className="min-w-0 truncate font-medium">
                          {v.title || "Sans titre"}
                        </span>
                        <span className="text-xs text-muted">
                          remplacée le{" "}
                          {new Date(v.at).toLocaleString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Africa/Tunis",
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {restoreError && (
              <p role="alert" className="text-sm text-destructive">
                {restoreError}
              </p>
            )}
          </div>
        )}

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
            {!aiEnabled
              ? "Commence par ta première partie."
              : isArticle
                ? "Demande l'article à Krea, ou commence toi-même."
                : "Demande un plan à Krea, ou commence toi-même."}
          </p>
        </Card>
      )}

      {state.parts.map((part, i) => {
        const open = openIds.has(part.id);
        const words = countWords(part.body);
        const edge = isArticle && isEdgeRole(part.role);
        const number = partNumber(content.type, state.parts, i);
        const fixed = edge ? (part.role === "intro" ? "Introduction" : "Conclusion") : null;
        const canWrite = edge || Boolean(part.title.trim());
        return (
          <Card key={part.id} id={`part-${part.id}`} className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {fixed ? (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
                  {fixed}
                </span>
              ) : number !== null ? (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                  {number}
                </span>
              ) : null}
              {edge && !part.title ? (
                <span className="flex-1" />
              ) : (
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
              )}
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
                  {isArticle && !edge && !hasIntro && (
                    <DropdownItem onClick={() => setRole(part.id, "intro")}>
                      En faire l&apos;introduction
                    </DropdownItem>
                  )}
                  {isArticle && !edge && !hasOutro && (
                    <DropdownItem onClick={() => setRole(part.id, "outro")}>
                      En faire la conclusion
                    </DropdownItem>
                  )}
                  {edge && (
                    <DropdownItem onClick={() => setRole(part.id, "text")}>
                      En faire une partie
                    </DropdownItem>
                  )}
                  <DropdownItem
                    disabled={i === 0 || edge || isEdgeRole(state.parts[i - 1]?.role)}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp className="size-3.5" />
                    Monter
                  </DropdownItem>
                  <DropdownItem
                    disabled={
                      i === state.parts.length - 1 ||
                      edge ||
                      isEdgeRole(state.parts[i + 1]?.role)
                    }
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
                    disabled={Boolean(writing) || !canWrite}
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

      {isArticle && hasText && (
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
          <Checkbox
            checked={numbered}
            onCheckedChange={(v) =>
              setState((s) => ({ ...s, parts: setNumbering(s.parts, v) }))
            }
          />
          Numéroter les parties (seulement si le titre annonce un nombre)
        </label>
      )}

      {isArticle && (
        <ClaimsCard contentId={content.id} claims={article?.claims ?? []} />
      )}

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
