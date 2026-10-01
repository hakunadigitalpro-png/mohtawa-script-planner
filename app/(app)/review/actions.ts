"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { renderEmail, sendEmail } from "@/lib/email";
import { typeLabel } from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";

type ReviewResult = { ok: true } | { ok: false; error: string };

type MemberRow = { user_id: string; email: string; role: string };

/**
 * Qui prévenir, et de la part de qui.
 *
 * Tout passe par `list_brand_members_with_emails` (0008) : les adresses des
 * autres membres ne sont pas lisibles directement, seule cette fonction les
 * expose, et uniquement à un membre de la marque.
 *
 * `replyTo` est l'adresse de celui qui agit : un client qui répond à l'e-mail
 * écrit à l'équipe, pas dans le vide.
 */
async function audience(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
  want: "clients" | "equipe",
): Promise<{ to: string[]; replyTo?: string }> {
  const [{ data }, { data: auth }] = await Promise.all([
    supabase.rpc("list_brand_members_with_emails", { p_brand_id: brandId }),
    supabase.auth.getUser(),
  ]);

  const me = auth?.user?.email ?? undefined;
  const rows = (data ?? []) as MemberRow[];
  const to = rows
    .filter((m) =>
      want === "clients" ? m.role === "viewer" : m.role !== "viewer",
    )
    .map((m) => m.email)
    // On ne s'écrit pas à soi-même : l'auteur de l'action sait ce qu'il
    // vient de faire.
    .filter((e) => e && e !== me);

  return { to, replyTo: me };
}

/** Le contenu concerné, pour composer un e-mail qui dit de quoi il parle. */
async function contentCard(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
) {
  const { data } = await supabase
    .from("contents")
    .select("id, brand_id, title, type, date")
    .eq("id", contentId)
    .maybeSingle();
  if (!data) return null;
  const c = data as {
    id: string;
    brand_id: string;
    title: string | null;
    type: string;
    date: string | null;
  };
  const meta = [typeLabel(c.type), c.date ? formatDateFr(c.date) : null]
    .filter(Boolean)
    .join(" · ");
  return {
    brandId: c.brand_id,
    title: c.title || "Sans titre",
    meta,
  };
}

/**
 * La décision du client. Tout passe par la RPC `client_review_content`
 * (migration 0052) : depuis cette migration, un `viewer` n'a plus AUCUN
 * droit d'écriture direct sur `contents`. La fonction est le seul passage,
 * et elle ne touche que le statut, la traçabilité et le commentaire.
 */
export async function reviewContent(input: {
  contentId: string;
  decision: "approve" | "revise";
  comment?: string;
  /** Visuel visé par la remarque — sinon le retour porte sur l'ensemble. */
  mediaId?: string;
}): Promise<ReviewResult> {
  const comment = input.comment?.trim();

  // Un « je demande une modif' » sans explication laisse l'équipe sans rien
  // à corriger : la boucle tournerait à vide.
  if (input.decision === "revise" && !comment) {
    return { ok: false, error: "Dis-nous ce qui ne va pas, sinon on ne saura pas quoi corriger." };
  }

  const supabase = await createClient();
  const card = await contentCard(supabase, input.contentId);

  const { error } = await supabase.rpc("client_review_content", {
    p_content_id: input.contentId,
    p_decision: input.decision,
    p_comment: comment || null,
    p_target_type: input.mediaId ? "media" : "plan",
    p_target_id: input.mediaId ?? "general",
  });

  if (error) {
    if (error.message.includes("not_pending")) {
      return {
        ok: false,
        error: "Ce contenu n'attend plus ta validation — quelqu'un est passé avant.",
      };
    }
    if (error.message.includes("Forbidden") || error.message.includes("not_found")) {
      return { ok: false, error: "Ce contenu ne t'est pas accessible." };
    }
    return { ok: false, error: error.message };
  }

  // L'e-mail APRÈS l'écriture, et jamais bloquant : la décision est prise,
  // elle ne doit pas être remise en cause par un serveur de mail.
  if (card) {
    const { to, replyTo } = await audience(supabase, card.brandId, "equipe");
    const approved = input.decision === "approve";
    await sendEmail({
      to,
      replyTo,
      subject: approved
        ? `Validé : ${card.title}`
        : `Modification demandée : ${card.title}`,
      html: renderEmail({
        title: approved
          ? "Ton client a validé ce contenu"
          : "Ton client demande une modification",
        intro: approved
          ? "C'est bon de son côté, tu peux le programmer."
          : "Voici ce qu'il a écrit — sa remarque est aussi dans les commentaires du contenu.",
        card: { title: card.title, meta: card.meta },
        quote: approved ? undefined : comment,
        ctaLabel: "Ouvrir le contenu",
        ctaPath: `/content/${input.contentId}`,
      }),
    });
  }

  revalidatePath("/review");
  revalidatePath("/calendar");
  revalidatePath(`/content/${input.contentId}`);
  return { ok: true };
}

/**
 * Le pendant côté équipe : envoyer un contenu au client. Sans ça la boucle
 * n'a pas de début — rien ne mettait jamais un contenu en `pending_review`.
 */
export async function submitForReview(contentId: string): Promise<ReviewResult> {
  const supabase = await createClient();
  const card = await contentCard(supabase, contentId);

  const { error } = await supabase.rpc("submit_for_review", {
    p_content_id: contentId,
  });
  if (error) {
    if (error.message.includes("Forbidden")) {
      return { ok: false, error: "Tu n'as pas les droits pour envoyer ce contenu." };
    }
    return { ok: false, error: error.message };
  }

  // C'est l'e-mail qui manquait le plus : sans lui, le client n'apprenait
  // qu'on attendait quelque chose de lui qu'en ouvrant l'app de lui-même.
  if (card) {
    const { to, replyTo } = await audience(supabase, card.brandId, "clients");
    await sendEmail({
      to,
      replyTo,
      subject: `À valider : ${card.title}`,
      html: renderEmail({
        title: "Un contenu attend ton avis",
        intro:
          "Regarde-le, puis dis si c'est bon ou ce qu'il faut changer. Tu peux cliquer une diapo pour que ta remarque porte dessus.",
        card: { title: card.title, meta: card.meta },
        ctaLabel: "Voir et valider",
        ctaPath: `/review?c=${contentId}`,
        footer:
          "Tu reçois cet e-mail parce qu'on t'a invité à valider les contenus de cette marque.",
      }),
    });
  }

  revalidatePath("/review");
  revalidatePath("/calendar");
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
