import type { createClient } from "@/lib/supabase/server";
import { renderEmail, sendEmail } from "@/lib/email";
import { audience, senderName } from "@/lib/notify";
import { formatDateFr } from "@/lib/utils";

/* =========================================================================
   Notifications des Campagnes Ads
   -------------------------------------------------------------------------
   Décision 24 (« qui prévient qui ») : le client reçoit un e-mail chaque
   fois qu'on attend quelque chose de lui ou qu'on lui a répondu. L'équipe
   vit dans l'app, mais faute de cloche DB pour les campagnes en V1, on
   l'avertit aussi par e-mail (une seule décision, pas vingt).
   Jamais bloquant : si l'envoi échoue, l'action réussit quand même.
   ========================================================================= */

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function campaignCard(supabase: Supabase, campaignId: string) {
  const { data } = await supabase
    .from("ad_campaigns")
    .select("id, brand_id, title, date_start, date_end, brands(name)")
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return null;
  const c = data as unknown as {
    id: string;
    brand_id: string;
    title: string | null;
    date_start: string | null;
    date_end: string | null;
    brands?: { name: string } | { name: string }[] | null;
  };
  const rel = c.brands;
  const brandName =
    (Array.isArray(rel) ? rel[0]?.name : rel?.name)?.trim() || null;
  const meta = [
    c.date_start ? formatDateFr(c.date_start) : null,
    c.date_end && c.date_end !== c.date_start ? formatDateFr(c.date_end) : null,
  ]
    .filter(Boolean)
    .join(" → ");
  return {
    brandId: c.brand_id,
    brandName,
    title: c.title?.trim() || "Campagne sans titre",
    meta,
  };
}

/** À la soumission : le client reçoit l'invitation à relire la proposition. */
export async function notifyClientOfAdSubmission(
  supabase: Supabase,
  campaignId: string,
): Promise<void> {
  try {
    const card = await campaignCard(supabase, campaignId);
    if (!card) return;
    const { to, replyTo } = await audience(supabase, card.brandId, "clients");
    if (to.length === 0) return;

    await sendEmail({
      to,
      replyTo,
      fromName: senderName(card.brandName),
      subject: card.brandName
        ? `${card.brandName} — une proposition de campagne à relire : ${card.title}`
        : `Une proposition de campagne à relire : ${card.title}`,
      html: renderEmail({
        title: "Une proposition de campagne à relire",
        intro:
          "L'équipe te soumet une campagne publicitaire. Regarde la proposition, puis valide ou demande une modif.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        ctaLabel: "Voir la proposition",
        ctaPath: `/ads/${campaignId}`,
        footer: card.brandName
          ? `Tu reçois cet e-mail parce qu'on t'a invité à valider les campagnes de ${card.brandName}.`
          : "Tu reçois cet e-mail parce qu'on t'a invité à valider les campagnes de cette marque.",
      }),
    });
  } catch (err) {
    console.error("[notify-ads] soumission :", err);
  }
}

/** Après la décision du client : l'équipe reçoit le verdict + le mot éventuel. */
export async function notifyTeamOfAdClientDecision(
  supabase: Supabase,
  campaignId: string,
  decision: "approve" | "revise",
): Promise<void> {
  try {
    const card = await campaignCard(supabase, campaignId);
    if (!card) return;
    const { to, replyTo } = await audience(supabase, card.brandId, "equipe");
    if (to.length === 0) return;

    const titleWord = decision === "approve" ? "validée" : "à retravailler";
    await sendEmail({
      to,
      replyTo,
      fromName: senderName(card.brandName),
      subject: card.brandName
        ? `${card.brandName} — campagne ${titleWord} : ${card.title}`
        : `Campagne ${titleWord} : ${card.title}`,
      html: renderEmail({
        title:
          decision === "approve"
            ? "Le client a validé la campagne"
            : "Le client demande une modification",
        intro:
          decision === "approve"
            ? "Tu peux la programmer et la lancer."
            : "Ouvre la campagne pour voir le détail de ce qu'il faut changer.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        ctaLabel: "Ouvrir la campagne",
        ctaPath: `/ads/${campaignId}`,
      }),
    });
  } catch (err) {
    console.error("[notify-ads] décision client :", err);
  }
}

/**
 * Un membre de l'équipe a répondu à une remarque. Si le client (`viewer`)
 * est dans la boucle, il reçoit la réponse par e-mail — mêmes règles que
 * `notifyClientOfReply` pour les contenus.
 */
export async function notifyClientOfAdReply(
  supabase: Supabase,
  campaignId: string,
  authorId: string,
  body: string,
): Promise<void> {
  try {
    const card = await campaignCard(supabase, campaignId);
    if (!card) return;

    // L'auteur doit être équipe (sinon c'est le client qui parle, pas une
    // réponse). On lit son rôle sur la marque.
    const { data: members } = await supabase.rpc(
      "list_brand_members_with_emails",
      { p_brand_id: card.brandId },
    );
    type Row = { user_id: string; email: string; role: string };
    const rows = (members ?? []) as Row[];
    const author = rows.find((m) => m.user_id === authorId);
    if (!author || author.role === "viewer") return;

    // On n'écrit qu'au client qui a déjà parlé sur cette campagne — pas
    // d'alerte « quelque chose se passe ici » envoyée sans contexte.
    const { data: viewerSpoke } = await supabase
      .from("ad_campaign_comments")
      .select("user_id")
      .eq("campaign_id", campaignId);
    const viewerIds = new Set(
      ((viewerSpoke ?? []) as { user_id: string }[]).map((r) => r.user_id),
    );
    const clients = rows.filter(
      (m) => m.role === "viewer" && viewerIds.has(m.user_id),
    );
    if (clients.length === 0) return;

    await sendEmail({
      to: clients.map((c) => c.email),
      replyTo: author.email,
      fromName: senderName(card.brandName),
      subject: card.brandName
        ? `${card.brandName} — l'équipe t'a répondu : ${card.title}`
        : `L'équipe t'a répondu : ${card.title}`,
      html: renderEmail({
        title: "L'équipe t'a répondu",
        intro: "Voici sa réponse à ta remarque sur la campagne.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        quote: body,
        ctaLabel: "Voir la réponse",
        ctaPath: `/ads/${campaignId}`,
      }),
    });
  } catch (err) {
    console.error("[notify-ads] réponse :", err);
  }
}
