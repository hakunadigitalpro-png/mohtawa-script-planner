"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addClaim, removeClaim, setClaimChecked } from "@/app/(app)/contents/article-actions";
import type { ArticleIssue } from "@/lib/article-checks";
import type { ArticleClaim } from "@/lib/types";

/**
 * Ce que les contrôles ont relevé — un conseil, jamais un blocage. Une ligne qui
 * reste en place quand tout est bon : si elle disparaissait, la page sauterait
 * pendant la frappe.
 */
export function ReviewLine({
  issues,
  onGoTo,
}: {
  issues: ArticleIssue[];
  onGoTo?: (partId: string) => void;
}) {
  if (issues.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 shrink-0" />
        Relu, rien à signaler
      </p>
    );
  }
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold">
        {issues.length === 1 ? "1 point à revoir" : `${issues.length} points à revoir`}
      </summary>
      <ul className="mt-2 space-y-1">
        {issues.map((issue, i) => (
          <li key={`${issue.code}-${issue.partId ?? i}`}>
            {issue.partId && onGoTo ? (
              <button
                type="button"
                onClick={() => onGoTo(issue.partId!)}
                className="text-start text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {issue.message}
              </button>
            ) : (
              <span className="text-muted-foreground">{issue.message}</span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Ce que l'auteur doit vérifier. L'équipe coche ce qu'elle a fait confirmer ; le
 * client voit le reste sur son écran de validation, et son « Je valide » suffit.
 */
export function ClaimsCard({
  contentId,
  claims,
}: {
  contentId: string;
  claims: ArticleClaim[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const done = claims.filter((c) => c.checked_at).length;

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        after?.();
        router.refresh();
      } catch {
        setError("La connexion a été coupée. Réessaie.");
      }
    });
  };

  return (
    <Card className="p-4 sm:p-5">
      <details>
        <summary className="cursor-pointer text-base font-semibold">
          À valider par l&apos;auteur
          {claims.length > 0 && (
            <span className="ms-2 text-sm font-medium text-muted-foreground">
              {done} sur {claims.length}
            </span>
          )}
        </summary>
        <p className="mt-1 text-xs text-muted">
          Faits, chiffres, engagements. Ton client voit ce qui n&apos;est pas coché
          quand il valide l&apos;article.
        </p>
        <ul className="mt-3 space-y-1">
          {claims.map((c) => (
            <li key={c.id} className="flex items-center gap-2">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                <Checkbox
                  checked={Boolean(c.checked_at)}
                  disabled={pending}
                  onCheckedChange={(v) => run(() => setClaimChecked(contentId, c.id, v))}
                  className={cn(
                    c.checked_at && "border-foreground bg-foreground text-background",
                  )}
                />
                <span
                  dir="auto"
                  className={cn("min-w-0 flex-1", c.checked_at && "text-muted")}
                >
                  {c.text}
                </span>
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => removeClaim(contentId, c.id))}
                aria-label={`Retirer : ${c.text}`}
                className="rounded-full p-2 text-muted transition hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addClaim(contentId, text), () => setText(""));
          }}
        >
          <Input
            dir="auto"
            value={text}
            maxLength={600}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ajouter un point à vérifier"
            aria-label="Ajouter un point à vérifier"
          />
          <Button type="submit" variant="outline" disabled={pending || !text.trim()}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        </form>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </details>
    </Card>
  );
}
