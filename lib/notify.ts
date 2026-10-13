import { getTranslations } from "next-intl/server";
import type { createClient } from "@/lib/supabase/server";
import { renderEmail, sendEmail } from "@/lib/email";
import { typeLabel } from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";

/* =========================================================================
   Qui prévient qui
   -------------------------------------------------------------------------
   Tout ce qui décide QUI reçoit QUOI vit ici. `lib/email.ts` n'est que le
   transport (gabarit, Resend) ; les triggers 0013/0046/0057 font la cloche ;
   les actions appellent, elles ne décident pas.

   L'équipe vit dans l'app : la cloche lui suffit. Le client, lui, ne vient
   que quand on l'appelle — chaque fois qu'on attend quelque chose de lui, ou
   qu'on lui a répondu, un e-mail part. Un e-mail par événement, jamais pour
   un échange interne, jamais à soi-même, jamais bloquant pour l'action.
   ========================================================================= */

type Supabase = Awaited<ReturnType<typeof createClient>>;

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
export async function audience(
  supabase: Supabase,
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
export async function contentCard(supabase: Supabase, contentId: string) {
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
export function senderName(brandName: string | null): string | undefined {
  return brandName ? `${brandName} via Kreatly` : undefined;
}

/**
 * L'équipe a répondu à une remarque. Si l'auteur de la remarque est un
 * client (`viewer`), il reçoit la réponse par e-mail : il n'ouvre pas l'app
 * pour voir si on lui a écrit. Un échange interne ne part pas, et on ne
 * s'écrit pas à soi-même. Ne lève jamais.
 */
export async function notifyClientOfReply(
  supabase: Supabase,
  input: { parentId: string; body: string },
): Promise<void> {
  try {
    const { data: parent } = await supabase
      .from("content_comments")
      .select("user_id, content_id")
      .eq("id", input.parentId)
      .maybeSingle();
    const p = parent as { user_id: string | null; content_id: string } | null;
    if (!p?.user_id) return;

    const card = await contentCard(supabase, p.content_id);
    if (!card) return;

    const [{ data: members }, { data: auth }] = await Promise.all([
      supabase.rpc("list_brand_members_with_emails", { p_brand_id: card.brandId }),
      supabase.auth.getUser(),
    ]);
    const me = auth?.user;
    const author = ((members ?? []) as MemberRow[]).find(
      (m) => m.user_id === p.user_id,
    );
    if (!author || author.role !== "viewer") return;
    if (me && author.user_id === me.id) return;
    // Un client qui répond à un autre client : ce n'est pas « l'équipe t'a
    // répondu ». Rien ne part.
    const mine = me
      ? ((members ?? []) as MemberRow[]).find((m) => m.user_id === me.id)
      : undefined;
    if (mine?.role === "viewer") return;

    await sendEmail({
      to: [author.email],
      replyTo: me?.email ?? undefined,
      fromName: senderName(card.brandName),
      subject: card.brandName
        ? `${card.brandName} — l'équipe t'a répondu : ${card.title}`
        : `L'équipe t'a répondu : ${card.title}`,
      html: renderEmail({
        title: "L'équipe t'a répondu",
        intro: "Voici sa réponse à ta remarque.",
        card: {
          title: card.title,
          meta: [card.brandName, card.meta].filter(Boolean).join(" · "),
        },
        quote: input.body,
        ctaLabel: "Voir la réponse",
        ctaPath: `/review?c=${p.content_id}`,
        footer: card.brandName
          ? `Tu reçois cet e-mail parce qu'on t'a invité à valider les contenus de ${card.brandName}.`
          : "Tu reçois cet e-mail parce qu'on t'a invité à valider les contenus de cette marque.",
      }),
    });
  } catch (err) {
    console.error("[notify] réponse au client :", err);
  }
}

/**
 * Une invitation remise par e-mail. L'adresse n'est pas stockée : une
 * invitation est un lien (0008/0043), l'e-mail n'est que sa remise. Ne lève
 * jamais ; renvoie vrai si l'envoi est parti.
 */
export async function notifyInvitation(
  supabase: Supabase,
  input: {
    brandId: string;
    email: string;
    token: string;
    role: string;
    note: string | null;
  },
): Promise<boolean> {
  try {
    const [{ data: brand }, { data: auth }, tRoles] = await Promise.all([
      supabase.from("brands").select("name").eq("id", input.brandId).maybeSingle(),
      supabase.auth.getUser(),
      getTranslations("team.roles"),
    ]);
    const brandName = (brand as { name: string } | null)?.name?.trim() || null;
    const me = auth?.user;
    const meta = (me?.user_metadata ?? {}) as Record<string, string>;
    const inviter =
      meta.full_name?.trim() || me?.email?.split("@")[0] || "Quelqu'un";
    let roleLabel = input.role;
    try {
      roleLabel = tRoles(input.role);
    } catch {
      /* libellé brut */
    }

    const sent = await sendEmail({
      to: [input.email],
      replyTo: me?.email ?? undefined,
      fromName: senderName(brandName),
      subject: brandName
        ? `${inviter} t'invite à rejoindre ${brandName} sur Kreatly`
        : `${inviter} t'invite sur Kreatly`,
      html: renderEmail({
        title: brandName
          ? `${inviter} t'invite à rejoindre ${brandName}`
          : `${inviter} t'invite sur Kreatly`,
        intro: `Ton rôle : ${roleLabel}. Ouvre l'invitation, crée ton compte ou connecte-toi, et tu y es.`,
        quote: input.note ?? undefined,
        ctaLabel: "Ouvrir l'invitation",
        ctaPath: `/invite/${input.token}`,
        footer: "Tu reçois cet e-mail parce que quelqu'un t'a invité sur Kreatly. Si tu ne connais pas cette personne, ignore-le.",
      }),
    });
    return sent > 0;
  } catch (err) {
    console.error("[notify] invitation :", err);
    return false;
  }
}
