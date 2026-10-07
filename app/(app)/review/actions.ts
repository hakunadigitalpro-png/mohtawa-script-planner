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
    .select("id, brand_id, title, type, date, brands(name)")
    .eq("id", contentId)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as {
    id: string;
    brand_id: string;
    title: string | null;
    type: string;
    date: string | null;
    brands?: { name: string } | { name: string }[] | null;
  };
  // PostgREST renvoie l'objet lié tantôt seul, tantôt dans un tableau selon
  // la façon dont il infère la relation — on accepte les deux.
  const rel = c.brands;
  const brandName =
    (Array.isArray(rel) ? rel[0]?.name : rel?.name)?.trim() || null;

  const meta = [typeLabel(c.type), c.date ? formatDateFr(c.date) : null]
    .filter(Boolean)
    .join(" · ");
  return {
    brandId: c.brand_id,
    brandName,
    title: c.title || "Sans titre",
    meta,
  };
}

/**
 * Le nom affiché de l'expéditeur.
 *
 * Une consultante gère plusieurs marques, et chaque marque a SON client. Le
 * client d'Adala ne connaît pas « Kreatly » : il doit voir arriver un e-mail
 * d'Adala. L'adresse, elle, reste celle du domaine vérifié — c'est elle qui
 * porte la preuve DNS, on ne peut pas la changer par marque.
 */
function senderName(brandName: string | null): string | undefined {
  return brandName ? `${brandName} via Kreatly` : undefined;
}

/** Une remarque du client. `mediaId` null : elle porte sur l'ensemble. */
export type ReviewNoteInput = { mediaId: string | null; body: string };

/**
 * Nomme chaque remarque pour l'e-mail — « Diapo 2 », et pas un identifiant.
 *
 * Les numéros sont relus en base plutôt que repris du navigateur : c'est la
 * position réelle des visuels qui fait foi, et l'e-mail part à l'équipe sans
 * qu'elle puisse vérifier d'où vient le chiffre.
 */
async function noteDigest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentId: string,
  notes: ReviewNoteInput[],
): Promise<string | undefined> {
  if (!notes.length) return undefined;

  const { data } = await supabase
    .from("content_media")
    .select("id")
    .eq("content_id", contentId)
    .order("position", { ascending: true });

  const rank = new Map<string, number>();
  ((data ?? []) as { id: string }[]).forEach((m, i) => rank.set(m.id, i + 1));
  const many = rank.size > 1;

  return notes
    .map((n) => {
      const n0 = n.mediaId ? rank.get(n.mediaId) : undefined;
      const label = n.mediaId
        ? many && n0
          ? `Diapo ${n0}`
          : "Le visuel"
        : "Sur l'ensemble";
      return `${label} — ${n.body}`;
    })
    .join("\n\n");
}

/**
 * La décision du client, et ses remarques — une par visuel s'il le veut.
 *
 * Tout passe par la RPC `client_review_content_many` (migration 0057). Ce
 * n'est pas une question de droits : `comments_insert_members` (0009)
 * autorise bien un client à écrire ses commentaires, la 0052 l'a laissé
 * exprès. C'est une question d'atomicité — un « je demande une modif' »
 * sans la remarque qui l'explique ne doit jamais pouvoir exister.
 *
 * Les remarques partent avec les DEUX décisions : un client qui valide en
 * disant « parfait, la 3 est ma préférée » n'a pas à choisir entre se taire
 * et demander une modification dont il ne veut pas.
 */
export async function reviewContent(input: {
  contentId: string;
  decision: "approve" | "revise";
  notes?: ReviewNoteInput[];
}): Promise<ReviewResult> {
  const notes = (input.notes ?? [])
    .map((n) => ({ mediaId: n.mediaId, body: n.body.trim() }))
    .filter((n) => n.body.length > 0);

  // Un « je demande une modif' » sans explication laisse l'équipe sans rien
  // à corriger : la boucle tournerait à vide. La RPC le refuse aussi — ici
  // c'est pour le dire avec des mots plutôt qu'avec un code d'erreur.
  if (input.decision === "revise" && notes.length === 0) {
    return {
      ok: false,
      error: "Dis-nous ce qui ne va pas, sinon on ne saura pas quoi corriger.",
    };
  }

  const supabase = await createClient();
  const card = await contentCard(supabase, input.contentId);

  const { error } = await supabase.rpc("client_review_content_many", {
    p_content_id: input.contentId,
    p_decision: input.decision,
    p_notes: notes.map((n) => ({ media_id: n.mediaId, body: n.body })),
  });

  if (error) {
    if (error.message.includes("not_pending")) {
      return {
        ok: false,
        error: "Ce contenu n'attend plus ta validation — quelqu'un est passé avant.",
      };
    }
    if (error.message.includes("invalid_media")) {
      return {
        ok: false,
        error: "Un des visuels n'existe plus. Recharge la page et réessaie.",
      };
    }
    if (error.message.includes("Forbidden") || error.message.includes("not_found")) {
      return { ok: false, error: "Ce contenu ne t'est pas accessible." };
    }
    // La migration 0057 n'a pas encore été jouée : un message en français
    // plutôt qu'une erreur Postgres brute sous les yeux d'un client.
    if (
      error.code === "PGRST202" ||
      error.message.includes("Could not find the function")
    ) {
      return {
        ok: false,
        error:
          "La mise à jour de la base n'est pas encore en place. Préviens l'équipe, ta réponse n'a pas été enregistrée.",
      };
    }
    return { ok: false, error: error.message };
  }

  // L'e-mail APRÈS l'écriture, et jamais bloquant : la décision est prise,
  // elle ne doit pas être remise en cause par un serveur de mail. Un seul
  // e-mail pour tout le lot — c'est un passage du client, pas six.
  if (card) {
    const { to, replyTo } = await audience(supabase, card.brandId, "equipe");
    const approved = input.decision === "approve";
    const digest = await noteDigest(supabase, input.contentId, notes);
    await sendEmail({
      to,
      replyTo,
      fromName: senderName(card.brandName),
      subject: approved
        ? `Validé : ${card.title}`
        : `Modification demandée : ${card.title}`,
      html: renderEmail({
        title: approved
          ? "Ton client a validé ce contenu"
          : "Ton client demande une modification",
        intro: approved
          ? digest
            ? "C'est bon de son côté — il a laissé un mot au passage."
            : "C'est bon de son côté, tu peux le programmer."
          : "Voici ce qu'il a écrit — ses remarques sont aussi sur les visuels concernés.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        quote: digest,
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
      fromName: senderName(card.brandName),
      subject: card.brandName
        ? `${card.brandName} — à valider : ${card.title}`
        : `À valider : ${card.title}`,
      html: renderEmail({
        title: "Un contenu attend ton avis",
        intro:
          "Regarde-le, puis dis si c'est bon ou ce qu'il faut changer. Tu peux cliquer une diapo pour que ta remarque porte dessus.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        ctaLabel: "Voir et valider",
        ctaPath: `/review?c=${contentId}`,
        footer: card.brandName
          ? `Tu reçois cet e-mail parce qu'on t'a invité à valider les contenus de ${card.brandName}.`
          : "Tu reçois cet e-mail parce qu'on t'a invité à valider les contenus de cette marque.",
      }),
    });
  }

  revalidatePath("/review");
  revalidatePath("/calendar");
  revalidatePath(`/content/${contentId}`);
  return { ok: true };
}
