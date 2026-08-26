import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Nettoyage du stockage — les fichiers ne se suppriment PAS tout seuls quand
 * la ligne qui les référence disparaît (Postgres ne cascade pas vers Storage).
 * Sans ça, le quota se remplit d'images de contenus qui n'existent plus.
 *
 * ⚠️ ORDRE CRITIQUE : les policies RLS de suppression (`content_media_delete`,
 * `insights_delete`) exigent que la ligne `contents` correspondante existe
 * ENCORE — elles font une jointure dessus. Il faut donc TOUJOURS supprimer
 * les fichiers AVANT la ligne : après, plus aucune requête client ne peut les
 * effacer, ils sont orphelins définitifs.
 *
 * Tout est best-effort et ne lève jamais : un souci de stockage ne doit
 * jamais empêcher l'utilisatrice de supprimer son contenu.
 */

/** Buckets qui rangent leurs fichiers dans un dossier `{content_id}/`. */
export const CONTENT_BUCKETS = ["content-media", "insights"] as const;

const DEFAULT_BUCKET = "content-media";
const LIST_PAGE = 100;

/** Supprime tous les fichiers d'un dossier (paginé — `list` plafonne à 100). */
export async function removeStorageFolder(
  supabase: ServerClient,
  bucket: string,
  folder: string,
): Promise<void> {
  try {
    const paths: string[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(folder, { limit: LIST_PAGE, offset });
      if (error || !data || data.length === 0) break;
      paths.push(...data.map((f) => `${folder}/${f.name}`));
      if (data.length < LIST_PAGE) break;
      offset += LIST_PAGE;
    }
    if (paths.length > 0) {
      await supabase.storage.from(bucket).remove(paths);
    }
  } catch {
    // best-effort : on n'empêche jamais la suppression métier
  }
}

/** Tous les fichiers d'un contenu, dans les deux buckets concernés. */
export async function removeContentFiles(
  supabase: ServerClient,
  contentId: string,
): Promise<void> {
  await Promise.all(
    CONTENT_BUCKETS.map((bucket) =>
      removeStorageFolder(supabase, bucket, contentId),
    ),
  );
}

/** Chemin de stockage extrait d'une URL publique, ou null si ce n'en est pas une. */
export function storagePathFromPublicUrl(
  url: string,
  bucket: string = DEFAULT_BUCKET,
): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

/**
 * Supprime le fichier pointé par une URL publique, UNIQUEMENT s'il appartient
 * au dossier attendu.
 *
 * Le garde-fou est indispensable : `addSceneFromPreset` copie l'URL de l'image
 * d'un setup (`presets/{brand_id}/…`) dans la scène créée. Sans ce contrôle,
 * supprimer une scène effacerait un fichier PARTAGÉ avec le setup lui-même et
 * avec toutes les autres scènes issues de ce setup.
 */
export async function removeOwnedFile(
  supabase: ServerClient,
  url: string,
  ownerFolder: string,
  bucket: string = DEFAULT_BUCKET,
): Promise<void> {
  const path = storagePathFromPublicUrl(url, bucket);
  if (!path || !path.startsWith(`${ownerFolder}/`)) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch {
    // best-effort
  }
}
