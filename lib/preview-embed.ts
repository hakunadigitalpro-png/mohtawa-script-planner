/**
 * Transforme un lien de partage externe (Google Drive, YouTube, Vimeo) en
 * URL embarquable pour un <iframe>. Un lien non reconnu reste `null` : on
 * affiche alors un bouton « Ouvrir le lien » plutôt qu'un embed cassé.
 *
 * Pourquoi ici et pas dans un composant : la même conversion sert à /review
 * (client), à la fiche d'édition et plus tard au PDF — mieux vaut une
 * seule règle pour l'app, testable sans navigateur.
 */
export type PreviewEmbed = {
  /** URL à mettre dans <iframe src>. */
  src: string;
  /** Pour l'étiquette de source (« Google Drive », « YouTube »…). */
  provider: "drive" | "youtube" | "vimeo";
};

export function parsePreviewUrl(url: string | null | undefined): PreviewEmbed | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");

  // Google Drive : /file/d/{id}/view, /file/d/{id}/preview, /open?id={id}
  if (host === "drive.google.com") {
    let id: string | null = null;
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) id = m[1];
    else id = u.searchParams.get("id");
    if (id) {
      return { src: `https://drive.google.com/file/d/${id}/preview`, provider: "drive" };
    }
  }

  // YouTube : youtu.be/{id}, youtube.com/watch?v={id}, youtube.com/shorts/{id}
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    if (id) return { src: `https://www.youtube.com/embed/${id}`, provider: "youtube" };
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { src: `https://www.youtube.com/embed/${v}`, provider: "youtube" };
    const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
    if (shorts) {
      return {
        src: `https://www.youtube.com/embed/${shorts[1]}`,
        provider: "youtube",
      };
    }
  }

  // Vimeo : vimeo.com/{id}
  if (host === "vimeo.com") {
    const id = u.pathname.slice(1).split("/")[0];
    if (/^\d+$/.test(id)) {
      return { src: `https://player.vimeo.com/video/${id}`, provider: "vimeo" };
    }
  }

  return null;
}

export function previewProviderLabel(p: PreviewEmbed["provider"]): string {
  switch (p) {
    case "drive":
      return "Google Drive";
    case "youtube":
      return "YouTube";
    case "vimeo":
      return "Vimeo";
  }
}
