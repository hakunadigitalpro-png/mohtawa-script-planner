"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KreaWait } from "@/components/krea-wait";
import { cn } from "@/lib/utils";
import {
  aiWriteArticle,
  applyArticleDraft,
  loadArticleWriter,
} from "@/app/(app)/contents/article-actions";
import {
  EDITION_LABELS,
  WORD_OPTIONS,
  draftParts,
  partNumber,
  sheetChanges,
  type ArticleBrief,
  type ArticleDraft,
  type ArticleEdition,
  type ArticleLanguage,
  type AuthorSheet,
} from "@/lib/article";
import { checkArticle } from "@/lib/article-checks";
import { AuthorSheetField } from "./author-sheet-fields";
import { LANGUAGE_OPTIONS } from "./longform-plan-button";

type Step = "loading" | "brief" | "writing" | "preview";

const CUT = "La connexion a été coupée. Réessaie : ce qui a été écrit est gardé.";

/**
 * Écrire l'article : le brief d'abord (on ne redemande que ce qui manque), puis
 * une version complète à lire AVANT de la prendre. Rien n'arrive dans la fiche
 * sans ce dernier clic, et la version d'avant se remet d'un geste.
 */
export function ArticleWriterButton({
  contentId,
  hasText,
  label,
  accent,
  onApplied,
}: {
  contentId: string;
  /** La fiche porte déjà un article : le prendre le remplace, et on le dit. */
  hasText: boolean;
  label: string;
  accent: boolean;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={accent ? "accent" : "outline"}
        onClick={() => setOpen(true)}
      >
        <Sparkles className={cn("size-3.5", !accent && "text-amber-500")} />
        {label}
      </Button>
      {open && (
        <ArticleWriterDialog
          contentId={contentId}
          hasText={hasText}
          onClose={() => setOpen(false)}
          onApplied={() => {
            setOpen(false);
            onApplied();
          }}
        />
      )}
    </>
  );
}

function ArticleWriterDialog({
  contentId,
  hasText,
  onClose,
  onApplied,
}: {
  contentId: string;
  hasText: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState<ArticleBrief | null>(null);
  const [sheet, setSheet] = useState<AuthorSheet>({});
  const [keep, setKeep] = useState(false);
  const [drafts, setDrafts] = useState<ArticleDraft[]>([]);
  const [version, setVersion] = useState(0);
  const [title, setTitle] = useState("");
  const [applying, setApplying] = useState(false);
  const [started, setStarted] = useState(false);
  /** Replié si tout y est déjà ; décidé à l'ouverture, pas pendant la frappe. */
  const [restOpen, setRestOpen] = useState(true);

  const showDrafts = (list: ArticleDraft[], index = 0) => {
    setDrafts(list);
    setVersion(index);
    setTitle(list[index]?.titles[0] ?? "");
    setStep("preview");
  };

  const load = async () => {
    setError(null);
    try {
      const res = await loadArticleWriter(contentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBrief(res.brief);
      setSheet(res.sheet);
      setTopic(res.topic);
      setRestOpen(!res.brief.reader || !res.brief.author || !res.brief.contact);
      if (res.drafts.length) showDrafts(res.drafts);
      else setStep("brief");
    } catch {
      setError("La connexion a été coupée. Réessaie.");
    }
  };
  if (!started) {
    setStarted(true);
    void Promise.resolve().then(load);
  }

  const patch = (p: Partial<ArticleBrief>) => setBrief((b) => (b ? { ...b, ...p } : b));

  const write = async () => {
    if (!brief) return;
    const back = step;
    setError(null);
    setStep("writing");
    try {
      const res = await aiWriteArticle({ contentId, topic, brief, keepSheetChanges: keep });
      if (res.ok) showDrafts(res.drafts);
      else {
        setError(res.error);
        setStep(back);
      }
    } catch {
      setError(CUT);
      setStep(back);
    }
  };

  const apply = async () => {
    const picked = drafts[version];
    if (!picked) return;
    setError(null);
    setApplying(true);
    try {
      const res = await applyArticleDraft({ contentId, draft: picked, title });
      if (res.ok) onApplied();
      else setError(res.error);
    } catch {
      setError("La connexion a été coupée. Réessaie.");
    } finally {
      setApplying(false);
    }
  };

  const draft = drafts[version];
  const changed = brief ? sheetChanges(sheet, brief).changed.length > 0 : false;

  return (
    <Dialog
      open
      onOpenChange={(v) => !v && step !== "writing" && !applying && onClose()}
      dismissible={step === "loading"}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            {step === "preview" ? "Ton article" : "Écrire l'article"}
          </DialogTitle>
          <DialogDescription>
            {step === "preview"
              ? "Lis-le et choisis un titre. Rien n'est changé tant que tu ne le prends pas."
              : "Ce qui manque s'écrira [À CONFIRMER] : je n'invente rien."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="max-h-[65vh] space-y-4 overflow-y-auto">
          {step === "loading" && !error && (
            <p className="text-sm text-muted" aria-live="polite">
              Je regarde ce qu&apos;on sait déjà…
            </p>
          )}

          {step === "writing" && (
            <KreaWait
              steps={[
                "Je lis ton brief…",
                "J'écris l'article…",
                "Je prépare le texte de partage…",
                "Je liste ce qu'il faudra vérifier…",
                "Encore un instant…",
              ]}
            />
          )}

          {step === "brief" && brief && (
            <>
              <BriefText
                id="brief-topic"
                label="De quoi parle l'article"
                value={topic}
                onChange={setTopic}
                placeholder="Ex : les questions à poser à un moulin avant d'acheter son huile"
              />
              <BriefText
                id="brief-action"
                label="Après lecture, le lecteur doit…"
                value={brief.action}
                onChange={(v) => patch({ action: v })}
                placeholder="Ex : me demander un échantillon"
              />
              <AuthorSheetField
                field="proofs"
                idPrefix="brief"
                value={brief.proofs}
                onChange={(v) => patch({ proofs: v })}
              />
              <AuthorSheetField
                field="limits"
                idPrefix="brief"
                value={brief.limits}
                onChange={(v) => patch({ limits: v })}
              />
              <details
                open={restOpen}
                onToggle={(e) => setRestOpen(e.currentTarget.open)}
                className="rounded-2xl border border-border/60 bg-secondary/20 p-3"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  Lecteur, auteur, longueur, langue
                </summary>
                <div className="mt-3 space-y-4">
                  <BriefText
                    id="brief-reader"
                    label="Pour qui : fonction, pays, niveau sur le sujet"
                    value={brief.reader}
                    onChange={(v) => patch({ reader: v })}
                    placeholder="Ex : acheteurs d'épiceries fines au Canada, débutants"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <AuthorSheetField
                      field="author"
                      idPrefix="brief"
                      value={brief.author}
                      onChange={(v) => patch({ author: v })}
                    />
                    <AuthorSheetField
                      field="position"
                      idPrefix="brief"
                      value={brief.position}
                      onChange={(v) => patch({ position: v as ArticleBrief["position"] })}
                    />
                    <AuthorSheetField
                      field="context"
                      idPrefix="brief"
                      value={brief.context}
                      onChange={(v) => patch({ context: v })}
                    />
                    <AuthorSheetField
                      field="contact"
                      idPrefix="brief"
                      value={brief.contact}
                      onChange={(v) => patch({ contact: v })}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="brief-language">Langue</Label>
                      <Select
                        id="brief-language"
                        value={brief.language}
                        onValueChange={(v) => patch({ language: v as ArticleLanguage })}
                        options={LANGUAGE_OPTIONS}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="brief-words">Longueur</Label>
                      <Select
                        id="brief-words"
                        value={String(brief.words)}
                        onValueChange={(v) => patch({ words: Number(v) })}
                        options={WORD_OPTIONS.map((n) => ({
                          value: String(n),
                          label: `${n} mots`,
                        }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="brief-edition">C&apos;est…</Label>
                      <Select
                        id="brief-edition"
                        value={brief.edition}
                        onValueChange={(v) => patch({ edition: v as ArticleEdition })}
                        options={Object.entries(EDITION_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                    </div>
                  </div>
                  {brief.edition !== "single" && (
                    <AuthorSheetField
                      field="rhythm"
                      idPrefix="brief"
                      value={brief.rhythm}
                      onChange={(v) => patch({ rhythm: v })}
                    />
                  )}
                </div>
              </details>
              {changed && (
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <Checkbox checked={keep} onCheckedChange={setKeep} />
                  Garder ces changements pour les prochains articles de la marque
                </label>
              )}
            </>
          )}

          {step === "preview" && draft && (
            <DraftPreview
              draft={draft}
              title={title}
              onTitle={setTitle}
              brief={brief}
              drafts={drafts.length}
              version={version}
              onVersion={(i) => showDrafts(drafts, i)}
            />
          )}

          {step === "preview" && hasText && (
            <p className="rounded-2xl bg-secondary/40 p-3 text-sm text-muted-foreground">
              Prendre cette version remplace ton article et son texte de
              partage, y compris ce qui n&apos;est pas enregistré. Tu pourras
              remettre la version enregistrée d&apos;avant.
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </DialogBody>

        <DialogFooter className="flex-wrap max-sm:flex-col-reverse max-sm:items-stretch">
          {step === "loading" && error && (
            <Button type="button" variant="outline" onClick={() => void load()}>
              Réessayer
            </Button>
          )}
          {step === "brief" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => (drafts.length ? setStep("preview") : onClose())}
              >
                {drafts.length ? "Revenir à l'article" : "Annuler"}
              </Button>
              <Button
                type="button"
                className="min-w-44"
                disabled={!topic.trim()}
                onClick={() => void write()}
              >
                {error ? "Réessayer" : "Écrire l'article"}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={applying}
                onClick={() => setStep("brief")}
              >
                Changer le brief
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={applying}
                onClick={() => void write()}
              >
                Une autre version
              </Button>
              <Button type="button" disabled={applying} onClick={() => void apply()}>
                {applying
                  ? "Enregistrement…"
                  : hasText
                    ? "Remplacer mon article"
                    : "Prendre cet article"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BriefText({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        dir="auto"
        value={value}
        maxLength={3000}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-12 text-sm [field-sizing:content]"
      />
    </div>
  );
}

function DraftPreview({
  draft,
  title,
  onTitle,
  brief,
  drafts,
  version,
  onVersion,
}: {
  draft: ArticleDraft;
  title: string;
  onTitle: (t: string) => void;
  brief: ArticleBrief | null;
  drafts: number;
  version: number;
  onVersion: (i: number) => void;
}) {
  const parts = draftParts(draft, title);
  const issues = checkArticle({
    title,
    subtitle: draft.subtitle,
    parts: parts.map((p, i) => ({ id: String(i), ...p })),
    shareText: draft.share,
    targetWords: brief?.words ?? 700,
    contact: brief?.contact,
  });

  return (
    <div className="space-y-5">
      {drafts > 1 && (
        <div className="flex gap-2" role="group" aria-label="Versions">
          {Array.from({ length: drafts }, (_, i) => (
            <Button
              key={i}
              type="button"
              size="sm"
              variant={i === version ? "default" : "outline"}
              aria-pressed={i === version}
              onClick={() => onVersion(i)}
            >
              {i === 0 ? "Nouvelle version" : "Version d'avant"}
            </Button>
          ))}
        </div>
      )}

      {draft.missing.length > 0 && (
        <p className="rounded-2xl bg-secondary/40 p-3 text-sm">
          Je n&apos;ai pas eu le temps d&apos;écrire {draft.missing.join(", ")}. Prends ce
          qui est là et complète dans la fiche, ou demande une autre version.
        </p>
      )}

      {draft.titles.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Ton titre</legend>
          {draft.titles.map((t) => (
            <label
              key={t}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm",
                t === title ? "border-foreground bg-secondary" : "border-border",
              )}
            >
              <input
                type="radio"
                name="article-title"
                checked={t === title}
                onChange={() => onTitle(t)}
              />
              <span dir="auto" className="min-w-0 flex-1 font-medium">
                {t}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <article dir="auto" className="space-y-4 text-base leading-relaxed">
        {draft.subtitle && (
          <p className="text-muted-foreground" dir="auto">
            {draft.subtitle}
          </p>
        )}
        {parts.map((p, i) => {
          const n = partNumber("article", parts, i);
          return (
            <section key={i} className="space-y-1">
              {p.title && (
                <h3 dir="auto" className="font-semibold">
                  {n ? `${n}. ` : ""}
                  {p.title}
                </h3>
              )}
              <p dir="auto" className="whitespace-pre-wrap">
                {p.body}
              </p>
            </section>
          );
        })}
      </article>

      <PreviewDetails label="Texte de partage" text={draft.share} />
      <PreviewDetails label="Idée pour l'image" text={draft.coverBrief} />
      <PreviewDetails
        label={`À valider par l'auteur (${draft.claims.length})`}
        text={draft.claims.map((c) => `- ${c}`).join("\n")}
      />
      {issues.length > 0 && (
        <details className="rounded-2xl border border-border/60 p-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            {issues.length === 1 ? "1 point à revoir" : `${issues.length} points à revoir`}
          </summary>
          <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
            {issues.map((x, i) => (
              <li key={i}>{x.message}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PreviewDetails({ label, text }: { label: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <details className="rounded-2xl border border-border/60 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">{label}</summary>
      <p dir="auto" className="mt-2 whitespace-pre-wrap leading-relaxed">
        {text}
      </p>
    </details>
  );
}
