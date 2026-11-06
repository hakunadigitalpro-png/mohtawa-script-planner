"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { platformsForType } from "@/lib/constants";
import {
  isForward,
  nextStep,
  primaryPublication,
  programmedStatusFor,
  todayISO,
  whyNotProgrammed,
  statusAfterResume,
  isProgrammedStatus,
} from "@/lib/content-lifecycle";
import type { ContentPublication } from "@/lib/types";

type Result = { ok: true } | { ok: false; error: string };
type ActivityEntry = { field: string; old_value: string | null; new_value: string | null };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Un lien collé sans son protocole reste un lien — même tolérance que l'onglet Performances. */
function normalizeUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/**
 * Le geste du bouton d'en-tête : « C'est programmé » ou « C'est en ligne ».
 *
 * Tout est relu en base avant d'écrire : le statut, le format, les
 * publications. Le moteur (`lib/content-lifecycle.ts`) dit ce qui est
 * permis ; cette action ne décide rien par elle-même. Les droits sont ceux
 * de la base (`is_brand_writer`, 0052) — un client invité n'arrive jamais
 * sur la fiche, et s'il forgeait l'appel, la RLS refuserait l'écriture.
 */
export async function advanceContent(input: {
  contentId: string;
  step: "mark_programmed" | "mark_live";
  /** Requis seulement si le contenu n'a encore aucune publication. */
  platform?: string | null;
  /** « Pour quand ? » : la date, requise quand aucune n'existe. */
  date?: string | null;
  time?: string | null;
  /** « Tu as le lien ? » : facultatif. */
  url?: string | null;
}): Promise<Result> {
  const supabase = await createClient();

  const [{ data: content }, { data: pubsData }] = await Promise.all([
    supabase
      .from("contents")
      .select("id, type, status")
      .eq("id", input.contentId)
      .maybeSingle(),
    supabase
      .from("content_publications")
      .select("*")
      .eq("content_id", input.contentId),
  ]);
  if (!content) return { ok: false, error: "Ce contenu ne t'est pas accessible." };

  const row = content as { id: string; type: string | null; status: string };
  const publications = (pubsData ?? []) as ContentPublication[];
  const primary = primaryPublication(publications);
  const today = todayISO();

  const step = nextStep({
    status: row.status,
    type: row.type,
    publicationDate: primary?.scheduled_date ?? null,
    today,
    url: primary?.url ?? null,
  });

  if (step.kind === "needs_format") {
    return { ok: false, error: "Choisis d'abord un format." };
  }
  if (step.kind !== input.step) {
    return {
      ok: false,
      error: "Ce contenu a changé entre-temps. Recharge la page.",
    };
  }
  if (!row.type) return { ok: false, error: "Choisis d'abord un format." };

  // Une publication à créer : il faut savoir où. Sinon on complète celle
  // qui existe — la principale, celle que le calendrier affiche.
  const platform = (input.platform ?? "").trim();
  const needsPlatform = publications.length === 0;
  if (needsPlatform) {
    if (!platform) return { ok: false, error: "Dis-moi d'abord où il sort." };
    if (!platformsForType(row.type).some((p) => p.value === platform)) {
      return { ok: false, error: "Cette plateforme ne convient pas à ce format." };
    }
  }

  if (step.kind === "mark_programmed") {
    const to = programmedStatusFor(row.type);
    let date = primary?.scheduled_date ?? null;

    if (step.needsDate) {
      const given = (input.date ?? "").trim();
      if (!DATE_RE.test(given)) return { ok: false, error: "Choisis une date." };
      if (given < today) {
        return {
          ok: false,
          error:
            "Choisis une date à venir : avec une date passée, je le mettrais en ligne tout de suite.",
        };
      }
      const time = (input.time ?? "").trim();
      const scheduledTime = time && TIME_RE.test(time) ? time : null;

      const write = needsPlatform
        ? supabase.from("content_publications").insert({
            content_id: row.id,
            platform,
            scheduled_date: given,
            scheduled_time: scheduledTime,
          })
        : supabase
            .from("content_publications")
            .update({ scheduled_date: given, scheduled_time: scheduledTime })
            .eq("id", primary!.id);
      const { error } = await write;
      if (error) return { ok: false, error: error.message };
      date = given;
    }

    const blocker = whyNotProgrammed({ to, hasDatedPublication: Boolean(date) });
    if (blocker) return { ok: false, error: blocker };
    if (!isForward(row.status, to)) {
      return { ok: false, error: "Ce contenu a changé entre-temps. Recharge la page." };
    }

    const { error } = await supabase
      .from("contents")
      .update({ status: to })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
  } else {
    if (!isForward(row.status, "live")) {
      return { ok: false, error: "Ce contenu a changé entre-temps. Recharge la page." };
    }
    const url = normalizeUrl(input.url);

    if (needsPlatform) {
      // Sorti sans jamais avoir été planifié : on note où et quand (aujourd'hui).
      const { error } = await supabase.from("content_publications").insert({
        content_id: row.id,
        platform,
        scheduled_date: today,
        url,
      });
      if (error) return { ok: false, error: error.message };
    } else {
      // En ligne aujourd'hui : une date prévue plus tard serait fausse, on
      // la ramène à aujourd'hui. Une date passée reste vraie, on n'y touche pas.
      const patch: Record<string, string | null> = {};
      if (url) patch.url = url;
      if (!primary!.scheduled_date || primary!.scheduled_date > today) {
        patch.scheduled_date = today;
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase
          .from("content_publications")
          .update(patch)
          .eq("id", primary!.id);
        if (error) return { ok: false, error: error.message };
      }
    }

    const { error } = await supabase
      .from("contents")
      .update({ status: "live" })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/content/${row.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath("/analytics");
  return { ok: true };
}

/**
 * Reprendre un contenu annulé : il retrouve le statut qu'il avait, lu dans
 * l'historique. La lecture passe par la RPC, réservée à l'équipe.
 */
export async function resumeContent(contentId: string): Promise<Result> {
  const supabase = await createClient();
  const [{ data: row }, { data: activity }] = await Promise.all([
    supabase.from("contents").select("status, type").eq("id", contentId).maybeSingle(),
    supabase.rpc("list_content_activity", { p_content_id: contentId }),
  ]);
  if (!row) return { ok: false, error: "Ce contenu n'existe plus." };
  if (row.status !== "cancelled") return { ok: true };

  const cancelledFrom = ((activity ?? []) as ActivityEntry[]).find(
    (a) => a.field === "status" && a.new_value === "cancelled",
  )?.old_value;

  let status = statusAfterResume({ previous: cancelledFrom, type: row.type });
  // « Programmé » exige une date : si elle a été retirée entre-temps, le contenu
  // reprend à l'étape d'avant, Validé.
  if (isProgrammedStatus(status)) {
    const { count } = await supabase
      .from("content_publications")
      .select("id", { count: "exact", head: true })
      .eq("content_id", contentId)
      .not("scheduled_date", "is", null);
    if (!count) status = "approved";
  }

  const { error } = await supabase
    .from("contents")
    .update({ status })
    .eq("id", contentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/content/${contentId}`);
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  return { ok: true };
}
