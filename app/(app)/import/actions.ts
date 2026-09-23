"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createContentRow } from "../contents/actions";
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
  | { ok: true; created: number; firstId: string | null }
  | { ok: false; error: string };

/**
 * Crée une série de contenus d'un coup. Chaque fiche passe par la MÊME action
 * que le bouton « Nouveau contenu » : la sécurité multi-marques s'applique
 * donc à l'identique, sans code de contrôle supplémentaire ici.
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

  const dates = input.startDate
    ? spreadDates(input.startDate, items.length, input.perWeek)
    : [];

  const supabase = await createClient();
  let created = 0;
  let firstId: string | null = null;

  for (const [i, item] of items.entries()) {
    const row = await createContentRow({
      type: input.type,
      title: item.title.trim(),
      date: dates[i] ?? null,
      platform: input.platform || null,
      pillar: input.theme,
    });
    // On s'arrête à la première erreur plutôt que de continuer en silence :
    // mieux vaut 4 fiches créées et un message clair que 15 fiches dont on ne
    // sait pas lesquelles ont abouti.
    if ("error" in row) {
      return {
        ok: false,
        error:
          created > 0
            ? `${created} contenus créés, puis une erreur : ${row.error}`
            : row.error,
      };
    }

    if (!firstId) firstId = row.id;
    created++;

    const script = item.script.trim();
    if (!script) continue;

    // Le texte va dans le champ naturel du format : le script pour un reel,
    // la voix-off pour un vlog, la légende pour les formats sans script.
    if (input.type === "reel") {
      await supabase
        .from("reel_details")
        .upsert({ content_id: row.id, script_full: script });
    } else if (input.type === "vlog") {
      await supabase
        .from("vlog_details")
        .upsert({ content_id: row.id, voiceover: script });
    } else {
      await supabase
        .from("contents")
        .update({ caption: script })
        .eq("id", row.id);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  return { ok: true, created, firstId };
}
