"use client";

import { useMemo, useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateContent } from "@/app/(app)/contents/actions";
import { useExplicitSave } from "./use-explicit-save";
import { SaveFooter } from "./save-footer";

/**
 * Onglet « Commentaires » des posts/carrousels — le PREMIER commentaire sous
 * le post, à la IG : hashtags, mentions, mini-FAQ. On l'écrit à l'avance
 * ici pour éviter de l'improviser au moment de publier. Bouton « Copier »
 * pour le coller sur l'app native d'Instagram juste après la publication.
 *
 * Différent du système de commentaires d'équipe (icônes 💬 par bloc) : ça,
 * c'est le texte PUBLIC qui apparaîtra sous le post sur la plateforme.
 */
export function FirstCommentTab({
  contentId,
  firstComment,
}: {
  contentId: string;
  firstComment: string | null;
}) {
  const initial = useMemo(
    () => ({ firstComment: firstComment ?? "" }),
    [firstComment],
  );

  const { state, setState, isDirty, isSaving, error, handleSave, handleReset } =
    useExplicitSave(initial, async (v) =>
      updateContent(contentId, {
        first_comment: v.firstComment.trim() || null,
      }),
    );

  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.firstComment);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refusée : on laisse tomber silencieusement */
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted" />
            <h2 className="text-base font-semibold">Premier commentaire</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Le texte que tu posteras en commentaire sous ton post (hashtags,
            mentions, mini-FAQ…). On le prépare à l&apos;avance et on le colle
            une fois le post publié.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          disabled={!state.firstComment.trim()}
          title="Copier le premier commentaire"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copié
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copier
            </>
          )}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="first-comment" className="sr-only">
          Premier commentaire
        </Label>
        <Textarea
          id="first-comment"
          value={state.firstComment}
          onChange={(e) =>
            setState(() => ({ firstComment: e.target.value }))
          }
          placeholder="#hashtag1 #hashtag2 @mention…"
          rows={5}
        />
      </div>

      <SaveFooter
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onReset={handleReset}
        error={error}
      />
    </Card>
  );
}
