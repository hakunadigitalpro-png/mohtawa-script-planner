"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updatePublication } from "@/app/(app)/contents/actions";
import type { ContentPublication } from "@/lib/types";

/**
 * Liste des publications avec champ URL éditable, rendue dans l'onglet
 * Performance (Idée 10 V2). C'est ICI que la créatrice saisit l'URL de
 * chaque vidéo une fois publiée sur la plateforme — pas dans le Plan,
 * parce que la vidéo n'existe pas encore au stade planning.
 *
 * Chaque ligne montre la plateforme + la date de publication (read-only,
 * comme rappel) + un champ URL en auto-save sur blur + un bouton
 * "Voir en ligne" qui ouvre le lien.
 */
export function PerformancePublications({
  contentId,
  publications,
}: {
  contentId: string;
  publications: ContentPublication[];
}) {
  if (publications.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Globe className="size-4 text-muted" />
          <Label className="text-sm font-semibold">Liens des publications</Label>
        </div>
        <div className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted">
          Aucune publication programmée. Ajoute une plateforme dans
          l&apos;onglet Plan.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Globe className="size-4 text-muted" />
        <Label className="text-sm font-semibold">Liens des publications</Label>
        <span className="text-[10px] text-muted">
          · Une URL par plateforme. Sert à retrouver tes vidéos en ligne et à
          matcher les insights plus tard.
        </span>
      </div>
      <ul className="space-y-2">
        {publications.map((pub) => (
          <PublicationUrlRow
            key={pub.id}
            publication={pub}
            contentId={contentId}
          />
        ))}
      </ul>
    </div>
  );
}

function PublicationUrlRow({
  publication,
  contentId,
}: {
  publication: ContentPublication;
  contentId: string;
}) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [url, setUrl] = React.useState(publication.url ?? "");

  React.useEffect(() => {
    setUrl(publication.url ?? "");
  }, [publication.url]);

  const saveUrl = (next: string) => {
    if ((publication.url ?? "") === next) return;
    startTransition(async () => {
      await updatePublication(
        publication.id,
        { url: next.trim() || null },
        contentId,
      );
      router.refresh();
    });
  };

  // Préfixe https:// si l'user colle un domaine nu
  const rawUrl = url.trim();
  const browsableUrl = rawUrl
    ? rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? rawUrl
      : `https://${rawUrl}`
    : null;

  return (
    <li className="rounded-2xl border border-border/60 bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="inline-flex shrink-0 items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold capitalize text-accent">
          {publication.platform}
        </span>

        {publication.scheduled_date && (
          <span className="shrink-0 text-[10px] text-muted">
            Publié le{" "}
            {new Date(publication.scheduled_date).toLocaleDateString("fr-FR")}
          </span>
        )}

        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => saveUrl(url)}
          placeholder={`https://www.${publication.platform.toLowerCase()}.com/…`}
          className="h-9 flex-1 text-sm"
          aria-label={`URL de la vidéo sur ${publication.platform}`}
        />

        {browsableUrl && (
          <a
            href={browsableUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/15"
            title={`Ouvrir la vidéo ${publication.platform} dans un nouvel onglet`}
          >
            <ExternalLink className="size-3.5" />
            Voir en ligne
          </a>
        )}
      </div>
    </li>
  );
}
