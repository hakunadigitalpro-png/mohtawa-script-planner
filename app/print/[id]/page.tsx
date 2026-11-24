import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { partNumber } from "@/lib/article";
import { longformSpec } from "@/lib/longform";
import {
  platformLabel,
  typeLabel,
  statusLabel,
  STORY_SLOT_LABELS,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { PrintActions } from "../print-actions";
import "../print.css";
import type {
  Content,
  ArticleClaim,
  ContentMedia,
  ContentSection,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
  VlogDetails,
} from "@/lib/types";

export const metadata = {
  title: "Export PDF — Kreatly",
};

export default async function PrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: content } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!content) notFound();

  // L'export est un outil d'équipe (notes, production) : un client invité a son
  // écran de validation, comme sur la fiche.
  const { data: canWrite } = await supabase.rpc("is_brand_writer", {
    b: content.brand_id,
  });
  if (canWrite === false) redirect(`/review?c=${id}`);

  const [
    reelRes,
    storyRes,
    slidesRes,
    scenesRes,
    perfRes,
    brandRes,
    vlogRes,
    mediaRes,
    sectionsRes,
    claimsRes,
  ] = await Promise.all([
    supabase.from("reel_details").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("story_details").select("*").eq("content_id", id).maybeSingle(),
    supabase
      .from("story_slides")
      .select("*")
      .eq("content_id", id)
      .order("slot_number", { ascending: true }),
    supabase
      .from("storyboard_scenes")
      .select("*")
      .eq("content_id", id)
      .order("scene_number", { ascending: true }),
    supabase.from("performances").select("*").eq("content_id", id).maybeSingle(),
    supabase.from("brands").select("name").eq("id", content.brand_id).maybeSingle(),
    supabase.from("vlog_details").select("*").eq("content_id", id).maybeSingle(),
    supabase
      .from("content_media")
      .select("*")
      .eq("content_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("content_sections")
      .select("*")
      .eq("content_id", id)
      .in("kind", ["section", "guest"])
      .order("position", { ascending: true }),
    supabase
      .from("article_claims")
      .select("id, content_id, position, text, checked_at")
      .eq("content_id", id)
      .order("position", { ascending: true }),
  ]);

  const c = content as Content;
  const reel = (reelRes.data ?? null) as ReelDetails | null;
  const story = (storyRes.data ?? null) as StoryDetails | null;
  const slides = (slidesRes.data ?? []) as StorySlide[];
  const scenes = (scenesRes.data ?? []) as StoryboardScene[];
  const perf = (perfRes.data ?? null) as Performance | null;
  const brandName = brandRes.data?.name ?? "";
  const vlog = (vlogRes.data ?? null) as VlogDetails | null;
  const media = ((mediaRes.data ?? []) as ContentMedia[]).filter((m) => m.image_url);
  const sections = (sectionsRes.data ?? []) as ContentSection[];
  const claims = (claimsRes.data ?? []) as ArticleClaim[];
  const guest = sections.find((s) => s.kind === "guest") ?? null;
  const parts = sections.filter(
    (s) => s.kind === "section" && (s.title?.trim() || s.body?.trim()),
  );
  const longform = longformSpec(c.type);
  const hasVlog = Boolean(
    vlog &&
      (vlog.angle ||
        vlog.hook ||
        vlog.arc_situation ||
        vlog.arc_development ||
        vlog.arc_payoff ||
        vlog.voiceover),
  );

  const isStory = c.type === "story";

  return (
    <div className="print-page">
      <PrintActions title={c.title || "Sans titre"} />

      <header className="print-header">
        <div className="print-brand">{brandName}</div>
        <h1 className="print-title">{c.title || "Sans titre"}</h1>
        <div className="print-meta">
          <span>{typeLabel(c.type)}</span>
          <span>·</span>
          <span>{platformLabel(c.platform)}</span>
          <span>·</span>
          <span>{statusLabel(c.status, c.type)}</span>
          {c.date && (
            <>
              <span>·</span>
              <span>{formatDateFr(c.date)}</span>
            </>
          )}
        </div>
      </header>

      <section className="print-section">
        <h2>Plan</h2>
        <dl className="print-grid">
          {c.pillar && <Field label="Thème" value={c.pillar} />}
          {c.objective && <Field label="Objectif" value={c.objective} />}
          {c.hook && <Field label="Accroche" value={c.hook} long />}
          {c.cta && <Field label="Call to Action" value={c.cta} long />}
          {c.tags && c.tags.length > 0 && (
            <Field label="Tags" value={c.tags.join(", ")} />
          )}
        </dl>
      </section>

      {media.length > 0 && (
        <section className="print-section">
          <h2>{longform?.coverTitle ?? (media.length > 1 ? "Visuels" : "Visuel")}</h2>
          <div className={media.length > 1 ? "print-media" : "print-media print-media-single"}>
            {media.map((m, i) => (
              // eslint-disable-next-line @next/next/no-img-element -- ratio inconnu, rendu papier.
              <img key={m.id} src={m.image_url!} alt={`Visuel ${i + 1}`} />
            ))}
          </div>
        </section>
      )}

      {c.caption?.trim() && (
        <section className="print-section print-section-flow">
          <h2>{longform?.captionTitle ?? "Légende"}</h2>
          <p className="print-text" dir="auto">{c.caption}</p>
        </section>
      )}

      {hasVlog && vlog && (
        <section className="print-section print-section-flow">
          <h2>Vlog</h2>
          <dl className="print-list">
            {vlog.angle && <Block label="Angle" value={vlog.angle} />}
            {vlog.hook && <Block label="Accroche" value={vlog.hook} />}
            {vlog.arc_situation && <Block label="Situation" value={vlog.arc_situation} />}
            {vlog.arc_development && (
              <Block label="Développement" value={vlog.arc_development} />
            )}
            {vlog.arc_payoff && <Block label="Chute" value={vlog.arc_payoff} />}
            {vlog.voiceover && <Block label="Voix off" value={vlog.voiceover} />}
          </dl>
        </section>
      )}

      {longform && parts.length > 0 && (
        <section className="print-section print-section-flow">
          <h2>{longform.tab}</h2>
          {guest?.title && (
            <p className="print-text" dir="auto">
              Invité : {guest.title}
              {guest.body ? ` — ${guest.body}` : ""}
            </p>
          )}
          {c.subtitle && <p className="print-text" dir="auto">{c.subtitle}</p>}
          {parts.map((p, i) => {
            const n = partNumber(c.type, parts, i);
            const heading = p.title || (c.type === "article" ? "" : "Sans titre");
            return (
              <div key={p.id} className="print-part">
                {heading && (
                  <h3 dir="auto">
                    {n ? `${n}. ` : ""}
                    {heading}
                    {p.minutes ? ` (${p.minutes} min)` : ""}
                  </h3>
                )}
                {p.body && <p className="print-text" dir="auto">{p.body}</p>}
              </div>
            );
          })}
        </section>
      )}

      {claims.length > 0 && (
        <section className="print-section">
          <h2>À valider par l&apos;auteur</h2>
          <ul className="print-text">
            {claims.map((x) => (
              <li key={x.id} dir="auto">
                {x.checked_at ? "☑" : "☐"} {x.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isStory && reel && (
        <section className="print-section">
          <h2>Script</h2>
          <dl className="print-list">
            {reel.intro && <Block label="Introduction" value={reel.intro} />}
            {reel.point1 && <Block label="Point 1" value={reel.point1} />}
            {reel.point2 && <Block label="Point 2" value={reel.point2} />}
            {reel.point3 && <Block label="Point 3" value={reel.point3} />}
            {reel.transition && (
              <Block label="Transition / B-roll" value={reel.transition} />
            )}
            {reel.recap && <Block label="Récap" value={reel.recap} />}
            {reel.outro && <Block label="Outro" value={reel.outro} />}
          </dl>
          {reel.script_full && (
            <div className="print-script-full">
              <h3>Script complet</h3>
              <p dir="auto">{reel.script_full}</p>
            </div>
          )}
        </section>
      )}

      {!isStory && scenes.length > 0 && (
        <section className="print-section">
          <h2>Storyboard</h2>
          <div className="print-storyboard">
            {scenes.map((s) => (
              <div key={s.id} className="print-scene">
                <div className="print-scene-header">
                  Plan {String(s.scene_number).padStart(2, "0")}
                </div>
                {s.image_url && (
                  <div className="print-scene-image">
                    <Image
                      src={s.image_url}
                      alt={`Plan ${s.scene_number}`}
                      width={400}
                      height={225}
                      unoptimized
                    />
                  </div>
                )}
                {s.description && (
                  <div className="print-scene-field">
                    <span>Action / Dialogue</span>
                    <p>{s.description}</p>
                  </div>
                )}
                {s.camera_angle && (
                  <div className="print-scene-field">
                    <span>Caméra / Plan</span>
                    <p>{s.camera_angle}</p>
                  </div>
                )}
                {s.on_screen_text && (
                  <div className="print-scene-field">
                    <span>Texte affiché</span>
                    <p>{s.on_screen_text}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {isStory && (
        <section className="print-section">
          <h2>Storyboard Planner</h2>
          {story && (
            <dl className="print-grid">
              {story.objective && (
                <Field label="Objectif de la séquence" value={story.objective} long />
              )}
              {story.cta_soft && <Field label="CTA soft" value={story.cta_soft} long />}
            </dl>
          )}
          <div className="print-stories">
            {[1, 2, 3, 4, 5].map((slot) => {
              const slide = slides.find((s) => s.slot_number === slot) ?? null;
              const label =
                slot === 1
                  ? "Title / Introduction"
                  : slot === 5
                    ? "Call to Action"
                    : STORY_SLOT_LABELS[slot] ?? `Story ${slot}`;
              return (
                <div key={slot} className="print-story-card">
                  <div className="print-story-label">{label}</div>
                  {slide?.image_url && (
                    <div className="print-story-image">
                      <Image
                        src={slide.image_url}
                        alt={label}
                        width={300}
                        height={533}
                        unoptimized
                      />
                    </div>
                  )}
                  {slide?.body && <p className="print-story-body">{slide.body}</p>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {perf && (perf.views || perf.likes || perf.comments || perf.notes) && (
        <section className="print-section">
          <h2>Performances</h2>
          <dl className="print-grid">
            {perf.views != null && <Field label="Vues" value={String(perf.views)} />}
            {perf.likes != null && <Field label="Likes" value={String(perf.likes)} />}
            {perf.comments != null && (
              <Field label="Commentaires" value={String(perf.comments)} />
            )}
            {perf.shares != null && (
              <Field label="Partages" value={String(perf.shares)} />
            )}
            {perf.saves != null && (
              <Field label="Sauvegardes" value={String(perf.saves)} />
            )}
            {perf.retention != null && (
              <Field label="Rétention (%)" value={String(perf.retention)} />
            )}
            {perf.notes && <Field label="Analyse" value={perf.notes} long />}
          </dl>
        </section>
      )}

      <footer className="print-footer">
        Kreatly Script Planner · {formatDateFr(new Date())}
      </footer>
    </div>
  );
}

function Field({
  label,
  value,
  long = false,
}: {
  label: string;
  value: string;
  long?: boolean;
}) {
  return (
    <div className={long ? "print-field print-field-long" : "print-field"}>
      <dt>{label}</dt>
      <dd dir="auto">{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-block">
      <dt>{label}</dt>
      <dd dir="auto">{value}</dd>
    </div>
  );
}
