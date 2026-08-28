"use server";

import { revalidatePath } from "next/cache";
import { AiError, aiDeadline } from "@/lib/ai";
import { guardAiAction } from "@/lib/ai-guard";
import { resolveActiveBrand } from "@/lib/brand";
import {
  KREA_TOOLS,
  kreaInteract,
  kreaSystemPrompt,
  type KreaContext,
  type KreaFunctionResult,
} from "@/lib/krea";
import { createContentRow } from "./contents/actions";
import { aiGenerateReel, applyReelGeneration } from "./contents/ai-actions";
import { aiGenerateStory, applyStoryGeneration } from "./contents/ai-actions";
import { aiGenerateVlog, applyVlogGeneration } from "./contents/ai-actions";

/** Une action visible que Krea a réellement effectuée — affichée dans le fil. */
export type KreaDeed =
  | { kind: "content_created"; id: string; title: string; type: string }
  | { kind: "script_written"; id: string }
  | { kind: "navigate"; href: string };

export type KreaAnswer =
  | { ok: true; message: string; interactionId: string | null; deeds: KreaDeed[] }
  | { ok: false; error: string };

const PAGE_HREFS: Record<string, string> = {
  dashboard: "/dashboard",
  calendrier: "/calendar",
  taches: "/tasks",
  analytics: "/analytics",
  accroches: "/hooks",
};

/** Au-delà, on coupe : une copilote qui enchaîne 10 outils part en vrille et
 *  dépasse de toute façon le temps que Vercel nous accorde. */
const MAX_TOOL_ROUNDS = 3;

/**
 * Rassemble ce que Krea doit savoir pour ne pas poser de questions dont la
 * réponse est déjà en base. Une seule série de lectures, en parallèle.
 */
async function buildContext(
  page: string,
  openContentId: string | null,
): Promise<KreaContext> {
  const { active } = await resolveActiveBrand();
  const { supabase } = await guardAiAction("krea");

  const today = new Date().toISOString().slice(0, 10);
  if (!active) {
    return {
      brandName: null,
      brandId: null,
      page,
      hasStrategy: false,
      themes: [],
      setups: [],
      contentCount: 0,
      today,
    };
  }

  const [themesRes, setupsRes, strategyRes, countRes, openRes] =
    await Promise.all([
      supabase.from("brand_pillars").select("name").eq("brand_id", active.id),
      supabase
        .from("brand_scene_presets")
        .select("label")
        .eq("brand_id", active.id),
      supabase
        .from("brand_strategies")
        .select("id")
        .eq("brand_id", active.id)
        .maybeSingle(),
      supabase
        .from("contents")
        .select("id", { count: "exact", head: true })
        .eq("brand_id", active.id),
      openContentId
        ? supabase
            .from("contents")
            .select("id, title, type")
            .eq("id", openContentId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const open = (openRes as { data: { id: string; title: string | null; type: string } | null })
    .data;

  return {
    brandName: active.name,
    brandId: active.id,
    page,
    openContent: open
      ? { id: open.id, title: open.title || "Sans titre", type: open.type }
      : null,
    hasStrategy: Boolean(strategyRes.data),
    themes: ((themesRes.data ?? []) as { name: string }[]).map((t) => t.name),
    setups: ((setupsRes.data ?? []) as { label: string }[]).map((s) => s.label),
    contentCount: countRes.count ?? 0,
    today,
  };
}

/** Écrit et enregistre le script d'un contenu, selon son type. */
async function writeScript(
  contentId: string,
  sujet: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await guardAiAction("krea");
  const { data: content } = await supabase
    .from("contents")
    .select("type, platform")
    .eq("id", contentId)
    .maybeSingle();
  if (!content) return { ok: false, error: "Contenu introuvable." };

  const type = (content as { type: string }).type;
  const platform = (content as { platform: string | null }).platform ?? undefined;

  if (type === "reel") {
    const gen = await aiGenerateReel({ contentId, topic: sujet, platform });
    if (!gen.ok) return { ok: false, error: gen.error };
    const applied = await applyReelGeneration({
      contentId,
      accroche: gen.data.accroche,
      corps: gen.data.corps,
      outro: gen.data.outro,
    });
    if (!applied.ok) return { ok: false, error: applied.error };
    return { ok: true };
  }

  if (type === "story") {
    const gen = await aiGenerateStory({ contentId, topic: sujet });
    if (!gen.ok) return { ok: false, error: gen.error };
    const applied = await applyStoryGeneration({ contentId, ...gen.data });
    if (!applied.ok) return { ok: false, error: applied.error };
    return { ok: true };
  }

  if (type === "vlog") {
    const gen = await aiGenerateVlog({ contentId, topic: sujet });
    if (!gen.ok) return { ok: false, error: gen.error };
    // Le générateur propose 2-3 accroches à choisir. Krea agit : elle retient
    // la première, l'utilisatrice changera dans la fiche si elle préfère.
    const { hooks, ...rest } = gen.data;
    const applied = await applyVlogGeneration({
      contentId,
      hook: hooks[0] ?? "",
      ...rest,
    });
    if (!applied.ok) return { ok: false, error: applied.error };
    return { ok: true };
  }

  return {
    ok: false,
    error:
      "Ce format n'a pas de script — c'est une légende et des visuels, à remplir dans la fiche.",
  };
}

/**
 * Un tour de conversation avec Krea. Elle peut enchaîner jusqu'à trois outils
 * avant de répondre ; chaque outil passe par les mêmes server actions que les
 * boutons de l'interface, donc la RLS s'applique exactement pareil.
 */
export async function askKrea(input: {
  message: string;
  /** Fil de discussion côté Google — évite de repayer l'historique. */
  interactionId?: string | null;
  /** Page où se trouve l'utilisatrice, en clair (ex : "le calendrier"). */
  page: string;
  openContentId?: string | null;
}): Promise<KreaAnswer> {
  try {
    const ctx = await buildContext(input.page, input.openContentId ?? null);
    const system = kreaSystemPrompt(ctx);
    const deadline = aiDeadline();
    const deeds: KreaDeed[] = [];

    let reply = await kreaInteract({
      system,
      input: input.message,
      previousInteractionId: input.interactionId ?? null,
      tools: KREA_TOOLS,
      deadline,
    });

    for (let round = 0; round < MAX_TOOL_ROUNDS && reply.calls.length; round++) {
      const results: KreaFunctionResult[] = [];

      for (const call of reply.calls) {
        const args = call.arguments as Record<string, string | undefined>;
        let payload: unknown;

        if (call.name === "creer_contenu") {
          const created = await createContentRow({
            type: String(args.type ?? "reel"),
            title: args.titre,
            date: args.date ?? null,
            platform: args.plateforme ?? null,
            pillar: args.theme,
          });
          if ("error" in created) {
            payload = { erreur: created.error };
          } else {
            deeds.push({
              kind: "content_created",
              id: created.id,
              title: args.titre ?? "Sans titre",
              type: created.type,
            });
            payload = { content_id: created.id, type: created.type };
          }
        } else if (call.name === "rediger_script") {
          const res = await writeScript(
            String(args.content_id ?? ""),
            String(args.sujet ?? ""),
          );
          if (res.ok) {
            deeds.push({ kind: "script_written", id: String(args.content_id) });
            payload = { ecrit: true };
          } else {
            payload = { erreur: res.error };
          }
        } else if (call.name === "ouvrir_page") {
          const key = String(args.page ?? "dashboard");
          const href =
            key === "marque" && ctx.brandId
              ? `/brands/${ctx.brandId}`
              : (PAGE_HREFS[key] ?? "/dashboard");
          deeds.push({ kind: "navigate", href });
          payload = { ouvert: href };
        } else {
          payload = { erreur: "Outil inconnu." };
        }

        results.push({
          type: "function_result",
          name: call.name,
          call_id: call.id,
          result: [{ type: "text", text: JSON.stringify(payload) }],
        });
      }

      reply = await kreaInteract({
        system,
        input: results,
        previousInteractionId: reply.interactionId,
        tools: KREA_TOOLS,
        deadline,
      });
    }

    if (deeds.length) {
      revalidatePath("/dashboard");
      revalidatePath("/calendar");
    }

    return {
      ok: true,
      message:
        reply.text ||
        "C'est fait. Dis-moi ce que tu veux faire ensuite et je m'en occupe.",
      interactionId: reply.interactionId,
      deeds,
    };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    return { ok: false, error: "Krea a eu un souci. Réessaie." };
  }
}
