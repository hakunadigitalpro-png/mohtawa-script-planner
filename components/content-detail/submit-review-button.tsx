"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Send } from "lucide-react";
import { submitForReview } from "@/app/(app)/review/actions";

/**
 * Le départ de la boucle de validation. Sans ce bouton, rien ne mettait
 * jamais un contenu en `pending_review` : les statuts existaient depuis
 * longtemps mais n'étaient atteignables que par le menu déroulant du Plan,
 * ce qu'on ne pouvait pas demander à quelqu'un de faire tous les jours.
 */
export function SubmitReviewButton({
  contentId,
  status,
}: {
  contentId: string;
  status: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === "pending_review") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-muted">
        <Clock className="size-3.5" />
        Chez le client
      </span>
    );
  }

  const send = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitForReview(contentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <button
      type="button"
      onClick={send}
      disabled={pending}
      title={error ?? undefined}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary disabled:opacity-60"
    >
      <Send className="size-3.5" />
      {pending ? "Envoi…" : error ? "Réessayer" : "Envoyer au client"}
    </button>
  );
}
