import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateFr } from "@/lib/utils";
import { PrintActions } from "../../print-actions";
import "../../print.css";
import type { BrandPillar, BrandStrategy, GeneratedStrategy } from "@/lib/types";

type IdeaRow = { id: string; title: string | null; pillar: string | null; notes: string | null; status: string };

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

  const [brandRes, strategyRes, pillarsRes, ideasRes] = await Promise.all([
    supabase.from("brands").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("brand_strategies")
      .select("*")
      .eq("brand_id", id)
      .maybeSingle(),
    supabase
      .from("brand_pillars")
      .select("id, name, objective, rubriques, examples, note, share_pct")
      .eq("brand_id", id)
      .order("position", { ascending: true }),
    // Les idées : les contenus sans date (0055), dans l'ordre où elles sont nées.
    supabase
      .from("contents")
      .select("id, title, pillar, notes, status")
      .eq("brand_id", id)
      .is("date", null)
      .order("created_at", { ascending: true }),
  ]);

  const brand = brandRes.data;
  const strategy = strategyRes.data as BrandStrategy | null;
  const s = (strategy?.generated as GeneratedStrategy | null | undefined) ?? null;
  const pillars = (pillarsRes.data ?? []) as BrandPillar[];
  const ideas = (ideasRes.data ?? []) as IdeaRow[];

  // Pas de marque accessible, ou rien du tout à exporter (ni stratégie, ni
  // thèmes, ni idées) : 404. Une marque qui n'a que ses thèmes a quand même
  // un document à remettre.
  if (!brand || (!s && pillars.length === 0 && ideas.length === 0)) notFound();

  // Numérotation continue des blocs, quel que soit ce qui existe.
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <div className="print-page strategy-doc">
      <PrintActions
        title={`Stratégie — ${brand.name}`}
        backHref={`/brands/${id}`}
      />

      <div className="strategy-cover">
        <p className="strategy-cover-brand">{brand.name} · Stratégie de contenu</p>
        <h1>{s?.positioning ?? brand.name}</h1>
        {s?.tagline && (
          <p className="strategy-cover-tagline">« {s.tagline} »</p>
        )}
        {strategy?.generated_at && s && (
          <p className="strategy-cover-date">
            Établie le {formatDateFr(strategy.generated_at)}
          </p>
        )}
      </div>

      {s && (
      <div className="strategy-grid">
        {/* Une cible = un bloc. C'est ce découpage qu'une agence facture. */}
        {s.audiences?.length ? (
          s.audiences.map((a, i) => (
            <Block
              key={i}
              n={num()}
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
            <Block n={num()} title="Ton audience" tone="lavender">
              <p className="strategy-text">{s.audience_summary}</p>
            </Block>

            {s.pain_points?.length > 0 && (
              <Block n={num()} title="Ce qui la bloque" tone="orange">
                <ul className="strategy-list">
                  {s.pain_points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </Block>
            )}
          </>
        )}

        <Block n={num()} title="Ta voix de marque" tone="lavender">
          <p className="strategy-text">{s.voice_summary}</p>
        </Block>

        {s.approach && (
          <Block n={num()} title="Ta méthode" tone="cream">
            <p className="strategy-text">{s.approach}</p>
          </Block>
        )}
      </div>

      )}

      {s && s.key_messages?.length > 0 && (
        <Block n={num()} title="À répéter dans ton contenu" tone="orange">
          <div className="strategy-messages">
            {s.key_messages.map((m, i) => (
              <p key={i} className="strategy-message">
                {m}
              </p>
            ))}
          </div>
        </Block>
      )}

      {s && s.hashtags?.length > 0 && (
        <Block n={num()} title="Tes hashtags récurrents" tone="cream">
          <ul className="strategy-hashtags">
            {s.hashtags.map((h, i) => (
              <li key={i}>#{h}</li>
            ))}
          </ul>
        </Block>
      )}

      {/* Les thèmes : ce dont la marque parle, avec la part de chacun. C'est
          la moitié du livrable qu'une agence remet — il manquait à l'export. */}
      {pillars.length > 0 && (
        <section className="strategy-section" id="themes">
          <h2 className="strategy-section-title">Tes thèmes de contenu</h2>
          {pillars.map((th, i) => (
            <Block
              key={th.id}
              n={num()}
              title={th.name}
              tone={i % 2 === 0 ? "orange" : "lavender"}
              aside={th.share_pct != null ? `${th.share_pct} % de tes contenus` : undefined}
            >
              {th.objective && <p className="strategy-text">{th.objective}</p>}
              {th.rubriques?.length > 0 && (
                <>
                  <p className="strategy-sub">Rubriques</p>
                  <ul className="strategy-list">
                    {th.rubriques.map((r, j) => (
                      <li key={j}>{r}</li>
                    ))}
                  </ul>
                </>
              )}
              {th.examples?.length > 0 && (
                <>
                  <p className="strategy-sub">Exemples de contenus</p>
                  <ul className="strategy-list">
                    {th.examples.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                </>
              )}
              {th.note && <p className="strategy-note">{th.note}</p>}
            </Block>
          ))}
        </section>
      )}

      {/* Les idées en réserve : ce qui n'a pas encore de date. */}
      {ideas.length > 0 && (
        <section className="strategy-section" id="idees">
          <h2 className="strategy-section-title">Tes idées en réserve</h2>
          <Block n={num()} title={`${ideas.length} idée${ideas.length > 1 ? "s" : ""} à développer`} tone="cream">
            <ul className="strategy-list">
              {ideas.map((idea) => (
                <li key={idea.id}>
                  <span className="strategy-idea-title">{idea.title || "Sans titre"}</span>
                  {idea.pillar && <span className="strategy-idea-tag">{idea.pillar}</span>}
                  {idea.notes && <span className="strategy-idea-notes">{idea.notes}</span>}
                </li>
              ))}
            </ul>
          </Block>
        </section>
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
  aside,
  children,
}: {
  n: string;
  title: string;
  tone: "orange" | "lavender" | "cream";
  /** À droite du titre : la part d'un thème, par exemple. */
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`strategy-block strategy-block-${tone}`}>
      <div className="strategy-block-head">
        <span className="strategy-num">{n}</span>
        <h2>{title}</h2>
        {aside && <span className="strategy-aside">{aside}</span>}
      </div>
      {children}
    </section>
  );
}
