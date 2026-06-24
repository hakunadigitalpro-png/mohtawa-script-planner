"use client";

import * as React from "react";
import { Film, Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { analyzeReferenceVideoAction } from "@/app/(app)/contents/ai-actions";

/**
 * "T'inspirer d'une vidéo qui marche" — l'utilisatrice choisit une vidéo
 * (la sienne ou une virale qu'elle a enregistrée). Le flux :
 *   1. Upload sur Supabase Storage (bucket content-media, scoping par contentId)
 *   2. Action serveur : Groq transcrit → Claude analyse le wording + propose
 *      un script (Accroche / Corps / Outro)
 *   3. Affichage du résultat (texte, dir="auto" pour FR + arabe)
 *
 * Aucun OpenAI : Groq (gratuit) pour la transcription, Claude pour l'analyse.
 */
export function ReferenceAnalyzer({ contentId }: { contentId: string }) {
  const [pending, setPending] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [analysis, setAnalysis] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const supabase = React.useMemo(() => createClient(), []);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setError(null);

    // Groq gratuit : ~25 Mo max par fichier. On garde-fou côté client.
    if (file.size > 25 * 1024 * 1024) {
      setError(
        "Vidéo trop lourde (max ~25 Mo pour la transcription gratuite). Prends un extrait plus court.",
      );
      return;
    }

    setPending(true);
    setStatus("Envoi de la vidéo…");
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${contentId}/ref-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("content-media")
        .upload(path, file, {
          contentType: file.type || "video/mp4",
          upsert: false,
        });
      if (upErr) {
        setError(`Envoi échoué : ${upErr.message}`);
        return;
      }
      const { data: pub } = supabase.storage
        .from("content-media")
        .getPublicUrl(path);

      setStatus("Transcription + analyse en cours… (~20s)");
      const res = await analyzeReferenceVideoAction({
        contentId,
        videoUrl: pub.publicUrl,
        filename: file.name,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAnalysis(res.analysis);
    } catch {
      setError("L'analyse a échoué (réseau ou délai dépassé). Réessaie.");
    } finally {
      setPending(false);
      setStatus(null);
      // reset l'input pour pouvoir re-sélectionner le même fichier
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasResult = analysis.trim().length > 0;

  return (
    <div className="space-y-3 rounded-2xl border border-accent/20 bg-accent/[0.03] p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <Film className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold">T&apos;inspirer d&apos;une vidéo qui marche</h3>
          <p className="text-[11px] text-muted">
            Choisis une vidéo (la tienne ou une virale enregistrée) → Mohtawa
            la transcrit, analyse le wording et te propose un script.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        disabled={pending}
      />

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {pending && status && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-xs text-accent">
          {status}
        </p>
      )}

      <Button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="w-full sm:w-auto"
      >
        {hasResult ? (
          <RotateCcw className={cn("size-4", pending && "animate-spin")} />
        ) : (
          <Sparkles className={cn("size-4", pending && "animate-pulse")} />
        )}
        {pending
          ? "Analyse en cours…"
          : hasResult
            ? "Analyser une autre vidéo"
            : "Choisir une vidéo à analyser"}
      </Button>

      {hasResult && (
        <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
            Analyse + script proposé
          </span>
          <div
            className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
            dir="auto"
          >
            {analysis}
          </div>
        </div>
      )}
    </div>
  );
}
