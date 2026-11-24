"use client";

import { useMemo, useState, useTransition } from "react";
import { Copy, Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Thinking } from "@/components/ui/thinking";
import { KreaBadge } from "@/components/krea-avatar";
import { updateContent } from "@/app/(app)/contents/actions";
import { saveCoverBrief } from "@/app/(app)/contents/article-actions";
import type { ArticleIssue } from "@/lib/article-checks";
import { aiGenerateCaption } from "@/app/(app)/contents/ai-actions";
import type { GenerationLanguage } from "@/lib/ai";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";

/**
 * Onglet "Caption" — texte qui accompagne la vidéo lors de la publication
 * sur la plateforme (hashtags, mention, contexte). Placé entre Checklist
 * et Performance dans l'ordre des onglets. Toujours visible (pas gated
 * par le statut comme Performance) pour pouvoir préparer la caption AVANT
 * publication.
 *
 * Le bouton "Copier" met le texte dans le presse-papier pour faciliter le
 * collage sur Instagram / TikTok / etc. au moment de poster.
 */
export function CaptionTab({
  contentId,
  caption,
  aiEnabled = true,
  title = "Légende",
  hint = "Le texte qui sera publié avec le contenu. Prépare-le ici, copie-le au moment de poster.",
  maxChars = 2200,
  share,
}: {
  contentId: string;
  caption: string | null;
  /**
   * Interrupteur IA de la marque (0054). Faux : le bloc de génération
   * disparaît. Le garde serveur refuse déjà l'appel — masquer évite
   * seulement de proposer un bouton qui ne peut qu'échouer.
   */
  aiEnabled?: boolean;
  /** Une description YouTube n'est pas une légende, et n'a pas sa limite. */
  title?: string;
  hint?: string;
  maxChars?: number;
  /** Article : ce texte est un texte de partage, avec ses contrôles et l'idée
   *  d'image — un seul bouton pour les deux. */
  share?: {
    check: (text: string) => ArticleIssue[];
    coverBrief: string;
    hasCover: boolean;
  };
}) {
  const coverBrief = share?.coverBrief ?? "";
  const initial = useMemo(
    () => ({ caption: caption ?? "", cover: coverBrief }),
    [caption, coverBrief],
  );

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) => {
      const res = await updateContent(contentId, {
        caption: v.caption.trim() || null,
      });
      if (res.error || !share || v.cover === coverBrief) return res;
      return saveCoverBrief(contentId, v.cover);
    });

  const [copied, setCopied] = useState(false);

  // Génération : la langue est choisie ici, pas devinée. Une marque tunisienne
  // publie en français, en dialecte ou en anglais selon le contenu.
  const [language, setLanguage] = useState<GenerationLanguage>("fr");
  const [genError, setGenError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  const onGenerate = () => {
    setGenError(null);
    startGenerating(async () => {
      const res = await aiGenerateCaption({ contentId, language });
      if (!res.ok) {
        setGenError(res.error);
        return;
      }
      // On écrit dans le formulaire, pas en base : rien n'est enregistré tant
      // qu'elle n'a pas cliqué sur Enregistrer, et « Annuler » restaure son
      // texte précédent.
      setState((s) => ({ ...s, caption: res.caption }));
    });
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pas de fallback compliqué : si le user n'a pas accès au clipboard
      // (navigateur ancien, pas en HTTPS…) on le laisse copier à la main.
    }
  };

  // Stats utiles : Instagram = 2200 caractères (défaut), hashtags max = 30
  const charCount = state.caption.length;
  // `\w` ignorait les hashtags arabes.
  const hashtagCount = state.caption.match(/#[\p{L}\p{N}\p{M}_]+/gu)?.length ?? 0;
  const issues = share ? share.check(state.caption) : [];
  const charLimitColor =
    charCount > maxChars
      ? "text-destructive"
      : charCount > maxChars * 0.9
        ? "text-amber-600"
        : "text-muted";

  return (
    <div className="space-y-4">
      <Card className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-muted">{hint}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopy}
            disabled={!state.caption.trim()}
          >
            {copied ? (
              <>
                <Check className="size-4" />
                Copié
              </>
            ) : (
              <>
                <Copy className="size-4" />
                Copier
              </>
            )}
          </Button>
        </div>

        {aiEnabled && (
        <div className="space-y-3 rounded-2xl border border-border/60 bg-secondary/30 p-4">
          <KreaBadge />
          <p className="text-sm text-foreground">
            {share
              ? "J'écris le texte de partage à partir de l'article, sans en recopier une phrase. Choisis juste la langue."
              : "J'écris la légende à partir de ce qui existe déjà : le thème du contenu, son objectif, son script, ta voix de marque et tes hashtags. Choisis juste la langue."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48">
              <Label htmlFor="caption-language" className="text-xs">
                Langue
              </Label>
              <Select
                id="caption-language"
                value={language}
                onValueChange={(v) => setLanguage(v as GenerationLanguage)}
                className="h-9 text-sm"
                options={[
                  { value: "fr", label: "Français" },
                  { value: "ar_tn", label: "Arabe tunisien" },
                  { value: "ar_msa", label: "Arabe standard" },
                  { value: "en", label: "Anglais" },
                ]}
              />
            </div>
            <Button
              type="button"
              variant="accent"
              onClick={onGenerate}
              disabled={generating}
              className="h-9"
            >
              <Sparkles className="size-4" />
              {generating ? (
                <Thinking label={share ? "J'écris ton texte…" : "J'écris ta légende…"} />
              ) : share ? (
                "Écrire le texte de partage"
              ) : (
                "Générer la légende"
              )}
            </Button>
          </div>
          {genError && (
            <p className="text-sm text-destructive" role="alert">
              {genError}
            </p>
          )}
        </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="caption">{title}</Label>
          <Textarea
            id="caption"
            dir="auto"
            className="min-h-48 text-sm [field-sizing:content]"
            value={state.caption}
            onChange={(e) =>
              setState((s) => ({ ...s, caption: e.target.value }))
            }
            placeholder={share ? "Ce que tu publies pour donner envie de lire l'article." : `Ex :\n\nLes 3 outils qui ont changé ma productivité en 2026 — celui en #2 m'a fait gagner 5h par semaine.\n\nLequel tu utilises déjà ? 👇\n\n#productivité #marketingdigital #coworking #freelance`}
          />
          <div className="flex items-center justify-between text-xs">
            <span className={cn("font-medium", charLimitColor)}>
              {charCount} / {maxChars} caractères
            </span>
            <span className="text-muted">
              {hashtagCount} hashtag{hashtagCount > 1 ? "s" : ""}
              {hashtagCount > 30 && (
                <span className="ms-1 font-semibold text-destructive">
                  (max 30 sur Instagram)
                </span>
              )}
            </span>
          </div>
          {issues.length > 0 && (
            <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {issues.map((x) => (
                <li key={x.code}>{x.message}</li>
              ))}
            </ul>
          )}
        </div>

        {share && (
          <details open={!share.hasCover}>
            <summary className="cursor-pointer text-sm font-semibold">
              Idée pour l&apos;image
            </summary>
            <Textarea
              dir="auto"
              value={state.cover}
              maxLength={4000}
              onChange={(e) => setState((s) => ({ ...s, cover: e.target.value }))}
              placeholder="Ce qu'on voit, l'ambiance, le cadrage."
              aria-label="Idée pour l'image"
              className="mt-2 min-h-16 text-sm [field-sizing:content]"
            />
          </details>
        )}
      </Card>

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
