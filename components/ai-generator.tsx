"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sparkles, RefreshCcw, Wand2 } from "lucide-react";
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
import {
  aiGenerateReel,
  aiGenerateStory,
} from "@/app/(app)/contents/ai-actions";
import type { ReelGeneration, StoryGeneration } from "@/lib/ai";

type Mode = "reel" | "story";

export function AiGeneratorButton({
  contentId,
  type,
  defaultTopic,
  platform,
}: {
  contentId: string;
  type: Mode;
  defaultTopic?: string;
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
  platform,
  onClose,
}: {
  contentId: string;
  type: Mode;
  defaultTopic?: string;
  platform?: string;
  onClose: () => void;
}) {
  const t = useTranslations("ai");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [topic, setTopic] = useState(defaultTopic ?? "");
  const [audience, setAudience] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reelPreview, setReelPreview] = useState<ReelGeneration | null>(null);
  const [storyPreview, setStoryPreview] = useState<StoryGeneration | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setReelPreview(null);
    setStoryPreview(null);
    setError(null);
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
          apply: false,
        });
        if (!res.ok) setError(res.error);
        else setReelPreview(res.data);
      } else {
        const res = await aiGenerateStory({
          contentId,
          topic,
          audience,
          apply: false,
        });
        if (!res.ok) setError(res.error);
        else setStoryPreview(res.data);
      }
    });
  };

  const apply = () => {
    startTransition(async () => {
      if (type === "reel") {
        const res = await aiGenerateReel({
          contentId,
          topic,
          audience,
          platform,
          apply: true,
        });
        if (!res.ok) setError(res.error);
        else {
          onClose();
          router.refresh();
        }
      } else {
        const res = await aiGenerateStory({
          contentId,
          topic,
          audience,
          apply: true,
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

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-amber-500" />
            {type === "reel" ? t("reelTitle") : t("storyTitle")}
          </DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!hasPreview && (
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
            </>
          )}

          {reelPreview && <ReelPreview data={reelPreview} />}
          {storyPreview && <StoryPreview data={storyPreview} />}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
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

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-sm leading-snug">{value}</div>
    </div>
  );
}

function ReelPreview({ data }: { data: ReelGeneration }) {
  const t = useTranslations("ai.preview");
  const tAi = useTranslations("ai");
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-4">
      <PreviewField label={t("hook")} value={data.hook} />
      <PreviewField label={t("intro")} value={data.intro} />
      <PreviewField label={t("point1")} value={data.point1} />
      <PreviewField label={t("point2")} value={data.point2} />
      <PreviewField label={t("point3")} value={data.point3} />
      <PreviewField label={t("transition")} value={data.transition} />
      <PreviewField label={t("recap")} value={data.recap} />
      <PreviewField label={t("cta")} value={data.cta} />
      <PreviewField label={t("outro")} value={data.outro} />
      <p className="text-xs text-muted">{tAi("previewHint")}</p>
    </div>
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
