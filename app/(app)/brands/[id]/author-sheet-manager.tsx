"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AuthorSheetField } from "@/components/content-detail/author-sheet-fields";
import { saveAuthorSheet } from "@/app/(app)/contents/article-actions";
import { SHEET_FIELDS, type AuthorSheet } from "@/lib/article";

/**
 * La fiche auteur : demandée une fois, reprise dans le brief de chaque article.
 * Se remplit aussi toute seule au premier article écrit.
 */
export function AuthorSheetManager({
  brandId,
  sheet,
}: {
  brandId: string;
  sheet: AuthorSheet;
}) {
  const router = useRouter();
  const [value, setValue] = useState<AuthorSheet>(sheet);
  const [saved, setSaved] = useState<AuthorSheet>(sheet);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(value) !== JSON.stringify(saved);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {SHEET_FIELDS.map((f) => (
          <AuthorSheetField
            key={f}
            field={f}
            idPrefix="sheet"
            value={value[f] ?? ""}
            onChange={(v) => setValue((s) => ({ ...s, [f]: v }))}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={!dirty || pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await saveAuthorSheet(brandId, value);
              if (res.ok) {
                setSaved(value);
                router.refresh();
              } else setError(res.error);
            } catch {
              setError("La connexion a été coupée. Réessaie.");
            }
          });
        }}
      >
        {pending ? "Enregistrement…" : dirty ? "Enregistrer la fiche" : "Fiche à jour"}
      </Button>
    </div>
  );
}
