/**
 * Les petits calculs du module Publicités, sans base ni écran : ce que l'on
 * compte sur une campagne, et ce qu'on additionne sur une liste de campagnes.
 */

type ReadableAd = {
  hook?: string | null;
  visual_url?: string | null;
  video_url?: string | null;
  slides?: { visual_url?: string | null; video_url?: string | null; text?: string | null }[];
};

const filled = (v: string | null | undefined) => Boolean(v && v.trim());

/**
 * Une annonce est prête quand elle a de quoi être diffusée : un visuel ou une
 * vidéo, et un texte. Pour un carrousel, chaque diapo doit avoir les deux, une
 * diapo sans image part cassée.
 */
export function isAdReady(ad: ReadableAd): boolean {
  const slides = ad.slides ?? [];
  if (slides.length > 0) {
    return slides.every(
      (s) => (filled(s.visual_url) || filled(s.video_url)) && filled(s.text),
    );
  }
  return (filled(ad.visual_url) || filled(ad.video_url)) && filled(ad.hook);
}

/** « 5 annonces prêtes sur 7 » pour une campagne. */
export function adReadiness(adSets: { ads: ReadableAd[] }[]): { ready: number; total: number } {
  const ads = adSets.flatMap((s) => s.ads);
  return { ready: ads.filter(isAdReady).length, total: ads.length };
}

/**
 * Le budget est du texte libre : « 300 », « 1 200,50 TND », « 1,500 ». On en
 * tire un nombre pour l'addition. Null si on n'y arrive pas : mieux vaut un
 * total sans cette ligne qu'un total faux.
 */
export function parseBudget(v: string | null | undefined): number | null {
  if (!v) return null;
  // « 300-500 » ou « 200 €/jour » ne sont pas un montant global à additionner.
  if (/\d\s*[-–—]\s*\d|\/\s*j/i.test(v)) return null;
  const m = v.replace(/[\s  ]/g, "").match(/\d+(?:[.,]\d+)*/);
  if (!m) return null;
  let digits = m[0];
  const last = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
  if (last >= 0) {
    // Exactement trois chiffres après le dernier séparateur : un séparateur de
    // milliers (« 1,500 »). Sinon, des décimales (« 1200,50 »).
    const decimals = digits.length - last - 1;
    const whole = digits.slice(0, last).replace(/[.,]/g, "");
    digits = decimals === 3 ? `${whole}${digits.slice(last + 1)}` : `${whole}.${digits.slice(last + 1)}`;
  }
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

export type CampaignTotals = {
  count: number;
  live: number;
  awaitingClient: number;
  budget: number;
  reach: number;
  clicks: number;
  leads: number;
};

/** L'unité écrite à côté du montant, si elle y est. */
function budgetUnit(v: string | null | undefined): string | null {
  const m = (v ?? "").toLowerCase().match(/tnd|dt|eur|€|cad|usd|\$/);
  if (!m) return null;
  if (m[0] === "dt") return "tnd";
  if (m[0] === "eur") return "€";
  if (m[0] === "usd" || m[0] === "cad") return m[0];
  return m[0];
}

/**
 * Le récap au-dessus de la liste. Une campagne arrêtée n'a plus de budget à
 * prévoir. Des devises différentes ne s'additionnent pas : le budget reste alors
 * à 0, et l'écran n'affiche pas le total.
 */
export function summarizeCampaigns(
  campaigns: {
    status: string;
    review_state?: string | null;
    budget_global?: string | null;
    reach?: number | null;
    clicks?: number | null;
    leads?: number | null;
  }[],
): CampaignTotals {
  const totals: CampaignTotals = {
    count: campaigns.length,
    live: 0,
    awaitingClient: 0,
    budget: 0,
    reach: 0,
    clicks: 0,
    leads: 0,
  };
  const units = new Set(
    campaigns
      .filter((c) => c.status !== "stopped")
      .map((c) => budgetUnit(c.budget_global))
      .filter(Boolean),
  );
  for (const c of campaigns) {
    if (c.status === "live") totals.live += 1;
    if (c.review_state === "pending_review") totals.awaitingClient += 1;
    if (c.status !== "stopped" && units.size <= 1) {
      totals.budget += parseBudget(c.budget_global) ?? 0;
    }
    totals.reach += c.reach ?? 0;
    totals.clicks += c.clicks ?? 0;
    totals.leads += c.leads ?? 0;
  }
  return totals;
}
