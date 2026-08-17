"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles, RefreshCcw, Wand2, Film } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { KreaBadge } from "@/components/krea-avatar";
import { EquipmentLayoutDiagram } from "@/components/equipment-layout-diagram";
import {
  aiGenerateReel,
  applyReelGeneration,
  aiGenerateStory,
  applyStoryGeneration,
  aiSegmentStoryboard,
  applyStoryboardSegmentation,
} from "@/app/(app)/contents/ai-actions";
import type {
  ReelGeneration,
  StoryGeneration,
  GenerationLanguage,
  StoryboardSegmentation,
} from "@/lib/ai";

type Mode = "reel" | "story";

export function AiGeneratorButton({
  contentId,
  type,
  defaultTopic,
  defaultAudience,
  platform,
}: {
  contentId: string;
  type: Mode;
  defaultTopic?: string;
  defaultAudience?: string;
  platform?: string;
}) {
  const t = useTranslations("ai");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-3.5 text-amber-500" />
        {t("buttonLabel")}
      </Button>
      {open && (
        <AiGeneratorModal
          contentId={contentId}
          type={type}
          defaultTopic={defaultTopic}
          defaultAudience={defaultAudience}
          platform={platform}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function AiGeneratorModal({
  contentId,
  type,
  defaultTopic,
  defaultAudience,
  platform,
  onClose,
}: {
  contentId: string;
  type: Mode;
  defaultTopic?: string;
  defaultAudience?: string;
  platform?: string;
  onClose: () => void;
}) {
  const t = useTranslations("ai");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [topic, setTopic] = useState(defaultTopic ?? "");
  const [audience, setAudience] = useState(defaultAudience ?? "");
  const [language, setLanguage] = useState<GenerationLanguage>("fr");
  const [includeStoryboard, setIncludeStoryboard] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyboardNotice, setStoryboardNotice] = useState<string | null>(null);
  const [reelPreview, setReelPreview] = useState<ReelGeneration | null>(null);
  const [storyPreview, setStoryPreview] = useState<StoryGeneration | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setReelPreview(null);
    setStoryPreview(null);
    setError(null);
    setStoryboardNotice(null);
  };

  const generate = () => {
    if (!topic.trim()) {
      setError(t("errorTopic"));
      return;
    }
    setError(null);
    startTransition(async () => {
      if (type === "reel") {
        const res = await aiGenerateReel({
          contentId,
          topic,
          audience,
          platform,
          includeStoryboard,
          language,
        });
        if (!res.ok) setError(res.error);
        else setReelPreview(res.data);
      } else {
        const res = await aiGenerateStory({ contentId, topic, audience, language });
        if (!res.ok) setError(res.error);
        else setStoryPreview(res.data);
      }
    });
  };

  const apply = () => {
    startTransition(async () => {
      if (type === "reel") {
        if (!reelPreview) return;
        const res = await applyReelGeneration({
          contentId,
          accroche: reelPreview.accroche,
          corps: reelPreview.corps,
          outro: reelPreview.outro,
          storyboard: reelPreview.storyboard,
        });
        if (!res.ok) setError(res.error);
        else if (res.storyboardSkipped) {
          // Script appliqué, mais le storyboard existant a été préservé
          // (non-destructif) — on ne ferme pas tout de suite pour que
          // l'utilisatrice voie pourquoi.
          router.refresh();
          setStoryboardNotice(t("storyboardSkippedNotice"));
        } else {
          onClose();
          router.refresh();
        }
      } else {
        if (!storyPreview) return;
        const res = await applyStoryGeneration({
          contentId,
          objective: storyPreview.objective,
          cta_soft: storyPreview.cta_soft,
          slides: storyPreview.slides,
        });
        if (!res.ok) setError(res.error);
        else {
          onClose();
          router.refresh();
        }
      }
    });
  };

  const hasPreview = reelPreview !== null || storyPreview !== null;
  const languageOptions: { value: GenerationLanguage; label: string }[] = [
    { value: "fr", label: t("languageOptions.fr") },
    { value: "en", label: t("languageOptions.en") },
    { value: "ar_msa", label: t("languageOptions.ar_msa") },
    { value: "ar_tn", label: t("languageOptions.ar_tn") },
  ];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <KreaBadge className="mb-1" />
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            {type === "reel" ? t("reelTitle") : t("storyTitle")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {pending && !hasPreview ? (
            <ThinkingIndicator label={t("thinking")} />
          ) : (
            !hasPreview && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ai-topic">{t("topic")}</Label>
                  <Textarea
                    id="ai-topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={t("topicPlaceholder")}
                    className="min-h-20"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-audience">{t("audience")}</Label>
                  <Input
                    id="ai-audience"
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    placeholder={t("audiencePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-language">{t("language")}</Label>
                  <Select
                    id="ai-language"
                    value={language}
                    onValueChange={(v) => setLanguage(v as GenerationLanguage)}
                    options={languageOptions}
                  />
                </div>
                {type === "reel" && (
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 transition hover:bg-secondary/50">
                    <Checkbox
                      checked={includeStoryboard}
                      onCheckedChange={(v) => setIncludeStoryboard(Boolean(v))}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Film className="size-3.5 text-accent" />
                        {t("includeStoryboard")}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {t("includeStoryboardHint")}
                      </span>
                    </span>
                  </label>
                )}
              </>
            )
          )}

          {reelPreview && <ReelPreview data={reelPreview} />}
          {storyPreview && <StoryPreview data={storyPreview} />}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {storyboardNotice && (
            <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
              {storyboardNotice}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          {!hasPreview ? (
            <>
              <Button type="button" variant="outline" onClick={onClose}>
                {tCommon("cancel")}
              </Button>
              <Button type="button" onClick={generate} disabled={pending}>
                <Wand2 className="size-3.5" />
                {pending ? t("generating") : t("generate")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  reset();
                  generate();
                }}
                disabled={pending}
              >
                <RefreshCcw className="size-3.5" />
                {t("regenerate")}
              </Button>
              <Button type="button" onClick={apply} disabled={pending}>
                {pending ? t("applying") : t("apply")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Découpe le script DÉJÀ ÉCRIT (Guidé ou Libre) en storyboard, sans le
 * regénérer — complète AiGeneratorButton pour le cas où le script n'a pas
 * été produit par l'IA. Même pattern preview → Apply, même garde
 * non-destructive côté serveur (storyboard laissé tel quel s'il n'est plus
 * vide).
 */
export function StoryboardSegmentButton({
  contentId,
  script,
}: {
  contentId: string;
  script: string;
}) {
  const t = useTranslations("ai");
  const tCommon = useTranslations("common");
  const g = useTranslations("filmingGuide");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<StoryboardSegmentation | null>(null);

  const openAndGenerate = () => {
    setOpen(true);
    setError(null);
    setPreview(null);
    setSkippedNotice(null);
    startTransition(async () => {
      const res = await aiSegmentStoryboard({ contentId, script });
      if (!res.ok) setError(res.error);
      else setPreview(res.data);
    });
  };

  const apply = () => {
    if (!preview) return;
    startTransition(async () => {
      const res = await applyStoryboardSegmentation({
        contentId,
        scenes: preview.scenes,
        filming_guide: preview.filming_guide,
      });
      if (!res.ok) setError(res.error);
      else if (res.skipped) {
        router.refresh();
        setSkippedNotice(t("storyboardSkippedNotice"));
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={openAndGenerate}
        disabled={!script.trim()}
        title={!script.trim() ? t("segmentDisabledHint") : undefined}
      >
        <Film className="size-3.5 text-accent" />
        {t("segmentButtonLabel")}
      </Button>
      {open && (
        <Dialog open onOpenChange={(v) => !v && setOpen(false)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <KreaBadge className="mb-1" />
              <DialogTitle className="flex items-center gap-2">
                <Film className="size-4 text-accent" />
                {t("segmentTitle")}
              </DialogTitle>
              <DialogDescription>{t("segmentSubtitle")}</DialogDescription>
            </DialogHeader>

            <DialogBody className="space-y-4">
              {pending && !preview ? (
                <ThinkingIndicator label={t("thinking")} />
              ) : (
                preview && (
                  <div
                    className="space-y-3 rounded-md border border-border bg-secondary/30 p-4"
                    dir="auto"
                  >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <PreviewField label={g("lighting")} value={preview.filming_guide.lighting} />
                      <PreviewField label={g("cameraStyle")} value={preview.filming_guide.camera_style} />
                      <PreviewField label={g("pacing")} value={preview.filming_guide.pacing} />
                      <PreviewField label={g("energy")} value={preview.filming_guide.energy} />
                    </div>
                    <p className="text-xs italic text-muted">💡 {preview.filming_guide.tip}</p>

                    <EquipmentLayoutDiagram
                      items={preview.filming_guide.equipment_layout ?? []}
                    />

                    <ul className="space-y-2">
                      {preview.scenes.map((s, i) => (
                        <li key={i} className="rounded border border-border bg-card p-2 text-sm">
                          <span className="me-2 font-semibold">#{i + 1}</span>
                          {s.description}
                          <div className="mt-1 flex flex-wrap gap-1">
                            <ScenePill label={g("camera")} value={s.camera_angle} />
                            <ScenePill label={g("expression")} value={s.expression} />
                            <ScenePill label={g("movement")} value={s.movement} />
                            {s.preset_label && (
                              <ScenePill label={g("preset")} value={s.preset_label} />
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              {skippedNotice && (
                <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
                  {skippedNotice}
                </p>
              )}
            </DialogBody>

            <DialogFooter>
              {!preview ? (
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {tCommon("cancel")}
                </Button>
              ) : (
                <>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="button" onClick={apply} disabled={pending}>
                    {pending ? t("applying") : t("apply")}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 px-6 py-12 text-center">
      <div className="relative flex size-12 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-accent/25" />
        <Sparkles className="relative size-6 text-accent" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-accent" />
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-0.5 whitespace-pre-line text-sm leading-snug">{value}</div>
    </div>
  );
}

function ReelPreview({ data }: { data: ReelGeneration }) {
  const t = useTranslations("ai");
  const g = useTranslations("filmingGuide");
  return (
    <div className="space-y-3">
      <div
        className="space-y-3 rounded-md border border-border bg-secondary/30 p-4"
        dir="auto"
      >
        <PreviewField label="Accroche" value={data.accroche} />
        <PreviewField label="Corps" value={data.corps} />
        <PreviewField label="Outro" value={data.outro} />
      </div>

      {data.storyboard && (
        <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-4" dir="auto">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
            <Film className="size-3.5 text-accent" />
            {t("storyboardPreviewTitle")}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <PreviewField label={g("lighting")} value={data.storyboard.filming_guide.lighting} />
            <PreviewField label={g("cameraStyle")} value={data.storyboard.filming_guide.camera_style} />
            <PreviewField label={g("pacing")} value={data.storyboard.filming_guide.pacing} />
            <PreviewField label={g("energy")} value={data.storyboard.filming_guide.energy} />
          </div>
          <p className="text-xs italic text-muted">💡 {data.storyboard.filming_guide.tip}</p>

          <EquipmentLayoutDiagram
            items={data.storyboard.filming_guide.equipment_layout ?? []}
          />

          <ul className="space-y-2">
            {data.storyboard.scenes.map((s, i) => (
              <li key={i} className="rounded border border-border bg-card p-2 text-sm">
                <span className="me-2 font-semibold">#{i + 1}</span>
                {s.description}
                <div className="mt-1 flex flex-wrap gap-1">
                  <ScenePill label={g("camera")} value={s.camera_angle} />
                  <ScenePill label={g("expression")} value={s.expression} />
                  <ScenePill label={g("movement")} value={s.movement} />
                  {s.preset_label && (
                    <ScenePill label={g("preset")} value={s.preset_label} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted">
        {data.storyboard ? t("previewHintWithStoryboard") : t("previewHint")}
      </p>
    </div>
  );
}

function ScenePill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label} : {value}
    </span>
  );
}

function StoryPreview({ data }: { data: StoryGeneration }) {
  const t = useTranslations("ai.preview");
  const tAi = useTranslations("ai");
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-4">
      <PreviewField label={t("objective")} value={data.objective} />
      <PreviewField label={t("ctaSoft")} value={data.cta_soft} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
          {t("stories")}
        </div>
        <ul className="mt-1 space-y-2">
          {data.slides.map((s) => (
            <li
              key={s.slot}
              className="rounded border border-border bg-card p-2 text-sm"
            >
              <span className="me-2 font-semibold">#{s.slot}</span>
              {s.body}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">{tAi("previewStoryHint")}</p>
    </div>
  );
}
