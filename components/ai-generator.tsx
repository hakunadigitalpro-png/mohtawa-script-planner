"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
        Générer avec l&apos;IA
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
      setError("Indique un sujet pour générer.");
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
            Générer {type === "reel" ? "le script de ton Reel" : "ta séquence Story"} avec l&apos;IA
          </DialogTitle>
          <DialogDescription>
            Donne-moi un sujet, je m&apos;occupe du reste. Tu pourras tout éditer après.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!hasPreview && (
            <>
              <div className="space-y-2">
                <Label htmlFor="ai-topic">Sujet de la vidéo</Label>
                <Textarea
                  id="ai-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex : Les 3 erreurs que font les créateurs débutants sur Instagram"
                  className="min-h-20"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ai-audience">Audience cible (optionnel)</Label>
                <Input
                  id="ai-audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Ex : entrepreneurs solo, marketeurs B2B, étudiants..."
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
                Annuler
              </Button>
              <Button type="button" onClick={generate} disabled={pending}>
                <Wand2 className="size-3.5" />
                {pending ? "Génération..." : "Générer"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={onClose}>
                Annuler
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
                Régénérer
              </Button>
              <Button type="button" onClick={apply} disabled={pending}>
                {pending ? "Application..." : "Appliquer au script"}
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
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-4">
      <PreviewField label="Accroche" value={data.hook} />
      <PreviewField label="Introduction" value={data.intro} />
      <PreviewField label="Point 1" value={data.point1} />
      <PreviewField label="Point 2" value={data.point2} />
      <PreviewField label="Point 3" value={data.point3} />
      <PreviewField label="Transition" value={data.transition} />
      <PreviewField label="Récap" value={data.recap} />
      <PreviewField label="CTA" value={data.cta} />
      <PreviewField label="Outro" value={data.outro} />
      <p className="text-xs text-muted">
        💡 Tu pourras éditer chaque champ après avoir appliqué.
      </p>
    </div>
  );
}

function StoryPreview({ data }: { data: StoryGeneration }) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-4">
      <PreviewField label="Objectif" value={data.objective} />
      <PreviewField label="CTA soft" value={data.cta_soft} />
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Stories
        </div>
        <ul className="mt-1 space-y-2">
          {data.slides.map((s) => (
            <li
              key={s.slot}
              className="rounded border border-border bg-card p-2 text-sm"
            >
              <span className="mr-2 font-semibold">#{s.slot}</span>
              {s.body}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted">
        💡 Tu pourras éditer chaque story et ajouter une image après avoir appliqué.
      </p>
    </div>
  );
}
