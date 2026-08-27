import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/utils";
import { PrintActions } from "../../print-actions";
import "../../print.css";
import type { BrandStrategy, GeneratedStrategy } from "@/lib/types";

export const metadata = {
  title: "Stratégie de contenu — Kreatly",
};

/**
 * Export de la stratégie de contenu — même approche que l'export des
 * contenus : une page imprimable + le print-to-PDF du navigateur, aucune
 * librairie PDF (décision produit #12).
 *
 * Le paramètre est un brand_id (la stratégie est 1:1 avec la marque). RLS
 * fait le contrôle d'accès : un non-membre n'obtient rien et tombe sur un 404.
 */
export default async function StrategyPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [brandRes, strategyRes] = await Promise.all([
    supabase.from("brands").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("brand_strategies")
      .select("*")
      .eq("brand_id", id)
      .maybeSingle(),
  ]);

  const brand = brandRes.data;
  const strategy = strategyRes.data as BrandStrategy | null;
  const s = strategy?.generated as GeneratedStrategy | null | undefined;

  // Pas de marque accessible, ou pas encore de stratégie générée : il n'y a
  // rien à exporter.
  if (!brand || !s) notFound();

  return (
    <div className="print-page">
      <PrintActions
        title={`Stratégie — ${brand.name}`}
        backHref={`/brands/${id}`}
      />

      <header className="print-header">
        <p className="print-brand">{brand.name}</p>
        <h1 className="print-title">Stratégie de contenu</h1>
        {strategy?.generated_at && (
          <div className="print-meta">
            <span>Générée le {formatDateFr(strategy.generated_at)}</span>
          </div>
        )}
      </header>

      <section className="print-section">
        <h2>Positionnement</h2>
        <p className="strategy-lead">{s.positioning}</p>
        {s.tagline && <p className="strategy-tagline">« {s.tagline} »</p>}
      </section>

      <section className="print-section">
        <h2>Audience</h2>
        <p className="strategy-text">{s.audience_summary}</p>
      </section>

      {s.pain_points?.length > 0 && (
        <section className="print-section">
          <h2>Ce qui bloque cette audience</h2>
          <ul className="strategy-list">
            {s.pain_points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="print-section">
        <h2>Voix de marque</h2>
        <p className="strategy-text">{s.voice_summary}</p>
      </section>

      {s.approach && (
        <section className="print-section">
          <h2>Méthode</h2>
          <p className="strategy-text">{s.approach}</p>
        </section>
      )}

      {s.key_messages?.length > 0 && (
        <section className="print-section">
          <h2>Messages clés à répéter</h2>
          <ul className="strategy-list">
            {s.key_messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </section>
      )}

      {s.hashtags?.length > 0 && (
        <section className="print-section">
          <h2>Hashtags récurrents</h2>
          <p className="strategy-hashtags">
            {s.hashtags.map((h) => `#${h}`).join("  ")}
          </p>
        </section>
      )}

      <footer className="print-footer">
        Stratégie générée avec Kreatly · {brand.name}
      </footer>
    </div>
  );
}
