import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser, pushEnabled } from "@/lib/push";

/**
 * Cron quotidien — appelé par Vercel Cron (configuré dans vercel.json).
 *
 * Pour chaque utilisateur qui a un abonnement push ET au moins une
 * publication programmée aujourd'hui, on envoie une seule notification
 * récapitulative par marque : « DIMPO · 2 contenus à publier aujourd'hui ».
 *
 * Zéro effet de bord sur un contenu déjà publié (`isLiveStatus`), zéro
 * push à qui n'a rien aujourd'hui — ni silence ni spam.
 */
export async function GET(req: Request) {
  // Vercel Cron ajoute l'en-tête `Authorization: Bearer <CRON_SECRET>` si
  // la variable est définie. On refuse les appels sans elle en prod pour
  // éviter que n'importe qui déclenche l'envoi en appelant l'URL.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  if (!pushEnabled()) {
    return NextResponse.json({ error: "push not configured" }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Aujourd'hui au fuseau de Tunis (UTC+1, pas de DST) : on calcule la
  // date en Europe/Paris en été / Africa/Tunis en hiver → même résultat
  // la plupart de l'année ; une approximation suffit pour un rappel.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Africa/Tunis",
  }); // "YYYY-MM-DD"

  // 1) Les utilisateurs qui ont au moins un abonnement push.
  const { data: subUsers } = await admin
    .from("push_subscriptions")
    .select("user_id");
  const userIds = [...new Set((subUsers ?? []).map((r) => r.user_id as string))];
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, users: 0, pushes: 0 });
  }

  let totalPushes = 0;

  for (const userId of userIds) {
    // 2) Les marques où ce user est membre.
    const { data: memberships } = await admin
      .from("brand_members")
      .select("brand_id, brands(name)")
      .eq("user_id", userId);
    // Supabase typebanks `brands` comme un tableau (relation nested) ;
    // en pratique un `brand_id` renvoie zéro ou une marque.
    const brands = ((memberships ?? []) as unknown as {
      brand_id: string;
      brands: { name: string }[] | { name: string } | null;
    }[]).map((m) => ({
      brand_id: m.brand_id,
      name: Array.isArray(m.brands) ? m.brands[0]?.name ?? null : m.brands?.name ?? null,
    }));
    if (brands.length === 0) continue;

    // 3) Les contenus programmés AUJOURD'HUI dans ces marques.
    //    On lit `contents.date` ET `content_publications.scheduled_date`
    //    pour couvrir les deux chemins (ancien champ global + multi-plateforme).
    const brandIds = brands.map((b) => b.brand_id);

    const [{ data: byDate }, { data: byPub }] = await Promise.all([
      admin
        .from("contents")
        .select("id, title, type, brand_id, status")
        .in("brand_id", brandIds)
        .eq("date", today),
      admin
        .from("content_publications")
        .select("content_id, contents!inner(id, title, type, brand_id, status)")
        .in("contents.brand_id", brandIds)
        .eq("scheduled_date", today),
    ]);

    type Row = {
      id: string;
      title: string | null;
      type: string | null;
      brand_id: string;
      status: string | null;
    };
    const items = new Map<string, Row>();
    for (const r of (byDate ?? []) as Row[]) items.set(r.id, r);
    for (const r of (byPub ?? []) as unknown as { contents: Row | Row[] | null }[]) {
      const c = Array.isArray(r.contents) ? r.contents[0] : r.contents;
      if (c) items.set(c.id, c);
    }

    // Un contenu déjà « live » ou « published » n'a plus besoin d'un rappel.
    const DONE = new Set(["live", "published"]);
    const todo = [...items.values()].filter((it) => !DONE.has(it.status ?? ""));
    if (todo.length === 0) continue;

    // 4) Un push par marque — en cas d'activité partagée, on évite d'en
    //    envoyer dix d'affilée. L'URL ouvre le calendrier sur la marque.
    const byBrand = new Map<string, Row[]>();
    for (const it of todo) {
      const list = byBrand.get(it.brand_id) ?? [];
      list.push(it);
      byBrand.set(it.brand_id, list);
    }

    for (const [brandId, rows] of byBrand) {
      const brandName =
        brands.find((b) => b.brand_id === brandId)?.name ?? "Kreatly";
      const n = rows.length;
      const first = rows[0];
      const body =
        n === 1
          ? `À publier aujourd'hui : « ${first.title || "Sans titre"} »`
          : `${n} contenus à publier aujourd'hui.`;

      const { sent } = await sendPushToUser(userId, {
        title: brandName,
        body,
        url: `/calendar?brand=${brandId}`,
        tag: `daily-${brandId}-${today}`,
      });
      totalPushes += sent;
    }
  }

  return NextResponse.json({ ok: true, users: userIds.length, pushes: totalPushes });
}
