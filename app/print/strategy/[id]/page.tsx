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
 * contenus : page imprimable + print-to-PDF du navigateur, aucune librairie
 * PDF (décision produit #12).
 *
 * C'est le livrable que l'utilisatrice met entre les mains d'un client : il
 * doit tenir la comparaison avec une stratégie d'agence, d'où la mise en
 * page (couverture, sections numérotées, aplats de la charte) plutôt qu'un
 * simple export texte.
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

  // Pas de marque accessible, ou pas encore de stratégie générée : rien à
  // exporter.
  if (!brand || !s) notFound();

  return (
    <div className="print-page strategy-doc">
      <PrintActions
        title={`Stratégie — ${brand.name}`}
        backHref={`/brands/${id}`}
      />

      <div className="strategy-cover">
        <p className="strategy-cover-brand">{brand.name} · Stratégie de contenu</p>
        <h1>{s.positioning}</h1>
        {s.tagline && (
          <p className="strategy-cover-tagline">« {s.tagline} »</p>
        )}
        {strategy?.generated_at && (
          <p className="strategy-cover-date">
            Établie le {formatDateFr(strategy.generated_at)}
          </p>
        )}
      </div>

      <div className="strategy-grid">
        {/* Une cible = un bloc. C'est ce découpage qu'une agence facture. */}
        {s.audiences?.length ? (
          s.audiences.map((a, i) => (
            <Block
              key={i}
              n={String(i + 1).padStart(2, "0")}
              title={a.name}
              tone={i % 2 === 0 ? "lavender" : "orange"}
            >
              <p className="strategy-text">
                {a.who} {a.wants}
              </p>
              {a.pain_points?.length > 0 && (
                <ul className="strategy-list">
                  {a.pain_points.map((pt, j) => (
                    <li key={j}>{pt}</li>
                  ))}
                </ul>
              )}
            </Block>
          ))
        ) : (
          <>
            <Block n="01" title="Ton audience" tone="lavender">
              <p className="strategy-text">{s.audience_summary}</p>
            </Block>

            {s.pain_points?.length > 0 && (
              <Block n="02" title="Ce qui la bloque" tone="orange">
                <ul className="strategy-list">
                  {s.pain_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        )}

        <Block n="03" title="Ta voix de marque" tone="lavender">
          <p className="strategy-text">{s.voice_summary}</p>
        </Block>

        {s.approach && (
          <Block n="04" title="Ta méthode" tone="cream">
            <p className="strategy-text">{s.approach}</p>
          </Block>
        )}
      </div>

      {s.key_messages?.length > 0 && (
        <Block n="05" title="À répéter dans ton contenu" tone="orange">
          <div className="strategy-messages">
            {s.key_messages.map((m, i) => (
              <p key={i} className="strategy-message">
                {m}
              </p>
            ))}
          </div>
        </Block>
      )}

      {s.hashtags?.length > 0 && (
        <Block n="06" title="Tes hashtags récurrents" tone="cream">
          <ul className="strategy-hashtags">
            {s.hashtags.map((h, i) => (
              <li key={i}>#{h}</li>
            ))}
          </ul>
        </Block>
      )}

      <footer className="print-footer">
        {brand.name} · Stratégie établie avec Kreatly
      </footer>
    </div>
  );
}

function Block({
  n,
  title,
  tone,
  children,
}: {
  n: string;
  title: string;
  tone: "orange" | "lavender" | "cream";
  children: React.ReactNode;
}) {
  return (
    <section className={`strategy-block strategy-block-${tone}`}>
      <div className="strategy-block-head">
        <span className="strategy-num">{n}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}
