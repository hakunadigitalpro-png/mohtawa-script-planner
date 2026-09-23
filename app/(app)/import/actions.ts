"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveBrandId } from "@/lib/brand";
import { isSimpleType } from "@/lib/constants";
import { MAX_SERIES_ITEMS, spreadDates } from "@/lib/series-import";

/**
 * Formats acceptés à l'import. La Story est volontairement absente : son
 * contenu vit en 5 diapositives numérotées, un bloc de texte long n'aurait
 * nulle part où aller sans être découpé arbitrairement.
 */
export const IMPORTABLE_TYPES = [
  "reel",
  "vlog",
  "post",
  "carousel",
  "infographic",
] as const;

export type ImportableType = (typeof IMPORTABLE_TYPES)[number];

export type ImportResult =
  | { ok: true; created: number }
  | { ok: false; error: string };

/**
 * Crée une série de contenus d'un coup.
 *
 * Tout part en TROIS insertions groupées, pas une boucle. La première version
 * réutilisait l'action du bouton « Nouveau contenu » pour chaque sujet : à
 * 4 allers-retours en base par contenu, 15 sujets faisaient 60 requêtes en
 * série et la fonction Vercel était coupée avant la fin. Une insertion par
 * table suffit, et le tout devient atomique par table plutôt que laissé à
 * moitié fait.
 *
 * Les identifiants sont tirés ici plutôt que par la base : on sait alors quel
 * script appartient à quelle fiche sans dépendre de l'ordre de retour.
 */
export async function importSeries(input: {
  items: { title: string; script: string }[];
  type: ImportableType;
  platform?: string;
  /** Thème appliqué à toute la série — une série traite un sujet. */
  theme?: string;
  /** Première date de publication (AAAA-MM-JJ). Vide = aucune date. */
  startDate?: string;
  perWeek: number;
}): Promise<ImportResult> {
  const items = input.items.filter((i) => i.title.trim());
  if (!items.length) return { ok: false, error: "Aucun sujet à importer." };
  if (items.length > MAX_SERIES_ITEMS) {
    return {
      ok: false,
      error: `${items.length} sujets d'un coup, c'est beaucoup — ${MAX_SERIES_ITEMS} au maximum.`,
    };
  }

  const brandId = await getActiveBrandId();
  if (!brandId) return { ok: false, error: "Aucune marque active." };

  const supabase = await createClient();
  const dates = input.startDate
    ? spreadDates(input.startDate, items.length, input.perWeek)
    : [];
  const theme = input.theme?.trim();
  const platform = input.platform?.trim() || null;
  const simple = isSimpleType(input.type);

  const prepared = items.map((item, i) => ({
    id: crypto.randomUUID(),
    title: item.title.trim(),
    script: item.script.trim(),
    date: dates[i] ?? null,
  }));

  // 1. Les fiches. `user_id` est rempli par le trigger BEFORE INSERT (0002).
  const { error: contentsError } = await supabase.from("contents").insert(
    prepared.map((p) => ({
      id: p.id,
      brand_id: brandId,
      type: input.type,
      title: p.title,
      date: p.date,
      platform,
      status: "idea",
      // Le trigger 0018 synchronise la colonne singulière depuis pillars[0].
      ...(theme ? { pillars: [theme], pillar: theme } : {}),
      // Un post ou un carrousel n'a pas de script : son texte EST sa légende.
      ...(simple && p.script ? { caption: p.script } : {}),
    })),
  );
  if (contentsError) return { ok: false, error: contentsError.message };

  // 2. Les publications — sans elles, le calendrier multi-plateformes ne
  //    verrait pas ces contenus (il se base sur cette table, pas sur
  //    `contents.date` qui n'est qu'une colonne de compatibilité).
  if (platform) {
    await supabase.from("content_publications").insert(
      prepared.map((p) => ({
        content_id: p.id,
        platform,
        scheduled_date: p.date,
      })),
    );
  }

  // 3. Le détail du format, script inclus dès l'insertion.
  if (input.type === "reel") {
    await supabase.from("reel_details").insert(
      prepared.map((p) => ({
        content_id: p.id,
        ...(p.script ? { script_full: p.script } : {}),
      })),
    );
  } else if (input.type === "vlog") {
    await supabase.from("vlog_details").insert(
      prepared.map((p) => ({
        content_id: p.id,
        ...(p.script ? { voiceover: p.script } : {}),
      })),
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, created: prepared.length };
}
