"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Plus, Sparkles } from "lucide-react";
import { Badge, ColorDot } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KreaWait } from "@/components/krea-wait";
import {
  aiFindExtracts,
  createExtract,
  saveTranscript,
} from "@/app/(app)/contents/longform-actions";
import { statusColor, statusLabel, typeColor, typeLabel } from "@/lib/constants";
import {
  EXTRACT_TYPES,
  MAX_TRANSCRIPT_CHARS,
  type ExtractProposal,
  type ExtractType,
} from "@/lib/longform";
import { formatDateFr } from "@/lib/utils";
import type { Content, DerivedContent } from "@/lib/types";

const TYPE_OPTIONS = EXTRACT_TYPES.map((t) => ({ value: t, label: typeLabel(t) }));

/**
 * D'un contenu long, des contenus courts. Un extrait est un VRAI contenu : il
 * apparaît au calendrier, se programme, se valide — et vit seul si sa source
 * est supprimée.
 */
export function ExtractsTab({
  content,
  transcript,
  derived,
  hasText,
  aiEnabled = true,
}: {
  content: Content;
  transcript: string | null;
  derived: DerivedContent[];
  /** Le texte écrit suffit comme source, à défaut de transcription. */
  hasText: boolean;
  aiEnabled?: boolean;
}) {
  const router = useRouter();
  const isArticle = content.type === "article";
  const [text, setText] = useState(transcript ?? "");
  const [saved, setSaved] = useState(transcript ?? "");
  const [proposals, setProposals] = useState<ExtractProposal[]>([]);
  const [created, setCreated] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  const [adding, setAdding] = useState(false);
  const [manualType, setManualType] = useState<ExtractType>("reel");
  const [manualTitle, setManualTitle] = useState("");

  const unsaved = !isArticle && text !== saved;
  const [savingText, startSavingText] = useTransition();

  // Un long collage ne doit pas partir avec l'onglet du navigateur.
  useEffect(() => {
    if (!unsaved) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [unsaved]);

  const persistText = async (): Promise<boolean> => {
    if (!unsaved) return true;
    const res = await saveTranscript(content.id, text);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    setSaved(text);
    return true;
  };

  const saveText = () => {
    setError(null);
    startSavingText(async () => {
      try {
        await persistText();
      } catch {
        setError("La connexion a été coupée. Réessaie.");
      }
    });
  };

  const search = () => {
    setError(null);
    startSearch(async () => {
      try {
        // Enregistrée AVANT l'appel : si l'IA échoue, le collage n'est pas perdu.
        if (!(await persistText())) return;
        const res = await aiFindExtracts({ contentId: content.id });
        if (res.ok) setProposals(res.extracts);
        else setError(res.error);
      } catch {
        setError("La connexion a été coupée. Réessaie.");
      }
    });
  };

  const create = async (
    key: string,
    input: Omit<Parameters<typeof createExtract>[0], "sourceId">,
  ) => {
    if (busy) return false;
    setBusy(key);
    setError(null);
    try {
      const res = await createExtract({ sourceId: content.id, ...input });
      if (!res.ok) {
        setError(res.error);
        return false;
      }
      setCreated((c) => ({ ...c, [key]: res.id }));
      router.refresh();
      return true;
    } catch {
      setError("La connexion a été coupée. Réessaie.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const sourceReady = isArticle ? hasText : Boolean(text.trim()) || hasText;

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Contenus tirés de celui-ci</h2>
            {derived.length === 0 && (
              <p className="text-xs text-muted">
                Tes Reels, carrousels et posts tirés de ce contenu apparaîtront
                ici.
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAdding((v) => !v)}
          >
            <Plus className="size-3.5" />
            Ajouter un extrait
          </Button>
        </div>

        {adding && (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40 space-y-1">
              <Label htmlFor="extract-type">Format</Label>
              <Select
                id="extract-type"
                value={manualType}
                onValueChange={(v) => setManualType(v as ExtractType)}
                options={TYPE_OPTIONS}
              />
            </div>
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor="extract-title">Titre</Label>
              <Input
                id="extract-title"
                dir="auto"
                value={manualTitle}
                maxLength={300}
                onChange={(e) => setManualTitle(e.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!manualTitle.trim() || Boolean(busy)}
              onClick={async () => {
                const ok = await create(`manual:${manualTitle}`, {
                  type: manualType,
                  title: manualTitle,
                });
                if (ok) {
                  setManualTitle("");
                  setAdding(false);
                }
              }}
            >
              Créer
            </Button>
          </div>
        )}

        {derived.length > 0 && (
          <ul className="space-y-2">
            {derived.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/content/${d.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-border/60 bg-card p-3 text-sm transition hover:border-foreground/30"
                >
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ColorDot color={typeColor(d.type)} />
                    {typeLabel(d.type)}
                  </span>
                  <span dir="auto" className="min-w-0 flex-1 truncate font-medium">
                    {d.title || "Sans titre"}
                  </span>
                  {d.date && (
                    <span className="text-xs text-muted">{formatDateFr(d.date)}</span>
                  )}
                  <Badge
                    className="text-white"
                    style={{ background: statusColor(d.status) }}
                  >
                    {statusLabel(d.status, d.type)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {aiEnabled && (
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-base font-semibold">Trouver les meilleurs extraits</h2>
            <p className="text-xs text-muted">
              {isArticle
                ? "Krea relit ton article et propose ce qui peut vivre seul."
                : "Krea relit ce qui a été dit et propose les passages qui peuvent vivre seuls, mot pour mot."}
            </p>
          </div>

          {!isArticle && (
            <details open={!saved} className="space-y-2">
              <summary className="cursor-pointer text-sm font-semibold">
                Transcription{saved ? " enregistrée" : ""}
              </summary>
              <Textarea
                dir="auto"
                value={text}
                maxLength={MAX_TRANSCRIPT_CHARS}
                onChange={(e) => setText(e.target.value)}
                placeholder="Colle ici ce qui a été dit, une fois l'enregistrement fait."
                aria-label="Transcription"
                className="mt-2 max-h-80 min-h-32 text-sm"
              />
              {unsaved && !searching && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={saveText}
                  disabled={savingText}
                >
                  {savingText
                    ? "Enregistrement…"
                    : text.trim()
                      ? "Enregistrer la transcription"
                      : "Effacer la transcription"}
                </Button>
              )}
              <p className="text-xs text-muted">
                Sur YouTube : description, puis « Afficher la transcription ».
                Sinon, je pars de ton texte. Ton client ne voit jamais la
                transcription.
              </p>
            </details>
          )}

          {searching ? (
            <KreaWait
              steps={[
                "Je lis ton texte…",
                "Je repère les moments forts…",
                "Je rédige mes propositions…",
                "Encore un instant…",
              ]}
            />
          ) : (
            <Button
              type="button"
              variant="accent"
              className="min-w-44"
              onClick={search}
              disabled={!sourceReady}
            >
              <Sparkles className="size-4" />
              {error
                ? "Réessayer"
                : proposals.length
                  ? "Chercher d'autres extraits"
                  : "Trouver les meilleurs extraits"}
            </Button>
          )}
          {!sourceReady && (
            <p className="text-xs text-muted">
              {isArticle
                ? "Écris d'abord ton article."
                : "Colle la transcription, ou écris d'abord ton contenu."}
            </p>
          )}
        </Card>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {proposals.map((p) => {
        const key = `${p.type}:${p.quote}`;
        const id = created[key];
        return (
          <Card key={key} className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <ColorDot color={typeColor(p.type)} />
                {typeLabel(p.type)}
              </span>
              <h3 dir="auto" className="min-w-0 flex-1 font-semibold">
                {p.title}
              </h3>
            </div>
            <blockquote
              dir="auto"
              className="whitespace-pre-wrap border-s-2 border-border ps-3 text-sm leading-relaxed"
            >
              {p.quote}
            </blockquote>
            {p.hook && (
              <p dir="auto" className="text-sm">
                <span className="font-semibold">Accroche : </span>
                {p.hook}
              </p>
            )}
            {p.why && (
              <p dir="auto" className="text-xs text-muted">
                {p.why}
              </p>
            )}
            {id ? (
              <Link
                href={`/content/${id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Check className="size-3.5" />
                Créé · Ouvrir
                <ExternalLink className="size-3.5" />
              </Link>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(busy)}
                onClick={() => void create(key, p)}
              >
                <Plus className="size-3.5" />
                {busy === key ? "Création…" : "Créer ce contenu"}
              </Button>
            )}
          </Card>
        );
      })}
    </div>
  );
}
