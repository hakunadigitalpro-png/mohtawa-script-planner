/* =========================================================================
   E-mails transactionnels
   -------------------------------------------------------------------------
   L'app n'avait aucun envoi d'e-mail : tout se passait dans la cloche de
   notifications, donc il fallait déjà être connecté pour apprendre qu'on
   avait quelque chose à faire. Pour un client qui ouvre Kreatly une fois
   par semaine, c'est l'équivalent de rien.

   Même principe que la clé Gemini : sans `RESEND_API_KEY`, tout est
   silencieusement désactivé. Un e-mail qui échoue ne doit JAMAIS faire
   échouer l'action de l'utilisatrice — on n'annule pas une validation
   client parce qu'un serveur de mail répond mal.
   ========================================================================= */

const RESEND_URL = "https://api.resend.com/emails";

/** Au-delà, on abandonne : l'action de l'utilisatrice passe avant. */
const EMAIL_TIMEOUT_MS = 8_000;

/** Garde-fou : une marque de 200 membres ne doit pas bloquer une action. */
const MAX_RECIPIENTS = 20;

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://mohtawa-script-planner.vercel.app"
  );
}

/**
 * Tant qu'aucun domaine n'est vérifié chez Resend, `onboarding@resend.dev`
 * fonctionne mais n'atteint QUE l'adresse du propriétaire du compte. Pour
 * écrire à un client, il faut renseigner RESEND_FROM avec un domaine vérifié.
 */
function fromAddress(): string {
  return process.env.RESEND_FROM || "Kreatly <onboarding@resend.dev>";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Gabarit unique, aux couleurs de la charte. Styles en ligne et mise en page
 * en tableau : les clients mail ignorent les feuilles de style externes et
 * la plupart des mises en page modernes.
 */
export function renderEmail(opts: {
  title: string;
  intro: string;
  /** Le contenu concerné — titre + méta, encadré. */
  card?: { title: string; meta?: string };
  /** Le mot du client, rendu tel quel. */
  quote?: string;
  ctaLabel: string;
  ctaPath: string;
  footer?: string;
}): string {
  const url = `${siteUrl()}${opts.ctaPath}`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#fdf6ef;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ef;padding:28px 16px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffaf4;border-radius:20px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ff5722;padding-bottom:10px;">Kreatly</td></tr>
    <tr><td style="font-size:21px;line-height:1.35;font-weight:800;color:#08040f;padding-bottom:12px;">${escapeHtml(opts.title)}</td></tr>
    <tr><td style="font-size:15px;line-height:1.6;color:#3a3340;padding-bottom:20px;">${escapeHtml(opts.intro)}</td></tr>
    ${
      opts.card
        ? `<tr><td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf6ef;border-radius:14px;padding:16px;">
        <tr><td style="font-size:16px;font-weight:700;color:#08040f;line-height:1.4;" dir="auto">${escapeHtml(opts.card.title)}</td></tr>
        ${opts.card.meta ? `<tr><td style="font-size:13px;color:#6b6472;padding-top:6px;">${escapeHtml(opts.card.meta)}</td></tr>` : ""}
      </table></td></tr>`
        : ""
    }
    ${
      opts.quote
        ? `<tr><td style="padding-bottom:20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #ff5722;padding:4px 0 4px 14px;">
        <tr><td style="font-size:15px;line-height:1.6;color:#3a3340;white-space:pre-wrap;" dir="auto">${escapeHtml(opts.quote)}</td></tr>
      </table></td></tr>`
        : ""
    }
    <tr><td style="padding-bottom:22px;">
      <a href="${url}" style="display:inline-block;background:#ff5722;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:999px;">${escapeHtml(opts.ctaLabel)}</a>
    </td></tr>
    <tr><td style="font-size:12px;line-height:1.6;color:#8b8491;border-top:1px solid #efe6db;padding-top:16px;">
      ${escapeHtml(opts.footer ?? "Tu reçois cet e-mail parce que tu fais partie de cet espace de travail Kreatly.")}
      <br><a href="${url}" style="color:#8b8491;">${escapeHtml(url)}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

/**
 * Envoie un e-mail par destinataire — jamais une liste groupée, pour que les
 * adresses des uns ne soient pas visibles des autres.
 *
 * Ne lève jamais. Renvoie le nombre d'envois réussis, utile pour les logs.
 */
export async function sendEmail(input: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<number> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 0;

  const recipients = [...new Set(input.to.filter(Boolean))].slice(
    0,
    MAX_RECIPIENTS,
  );
  if (!recipients.length) return 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const results = await Promise.allSettled(
      recipients.map((to) =>
        fetch(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress(),
            to: [to],
            subject: input.subject,
            html: input.html,
            ...(input.replyTo ? { reply_to: input.replyTo } : {}),
          }),
          signal: controller.signal,
        }).then(async (r) => {
          if (!r.ok) {
            throw new Error(`${r.status} ${await r.text().catch(() => "")}`);
          }
          return true;
        }),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      console.error(
        "[email] %d/%d envois échoués : %s",
        failed.length,
        recipients.length,
        (failed[0] as PromiseRejectedResult).reason,
      );
    }
    return results.length - failed.length;
  } catch (err) {
    console.error("[email] envoi impossible :", err);
    return 0;
  } finally {
    clearTimeout(timer);
  }
}
