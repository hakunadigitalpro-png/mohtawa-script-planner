import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import {
  platformLabel,
  typeLabel,
  statusLabel,
  STORY_SLOT_LABELS,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { PrintActions } from "./print-actions";
import "./print.css";
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
} from "@/lib/types";

export const metadata = {
  title: "Export PDF — Mohtawa",
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

  const [reelRes, storyRes, slidesRes, scenesRes, perfRes, brandRes] = await Promise.all([
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
  ]);

  const c = content as Content;
  const reel = (reelRes.data ?? null) as ReelDetails | null;
  const story = (storyRes.data ?? null) as StoryDetails | null;
  const slides = (slidesRes.data ?? []) as StorySlide[];
  const scenes = (scenesRes.data ?? []) as StoryboardScene[];
  const perf = (perfRes.data ?? null) as Performance | null;
  const brandName = brandRes.data?.name ?? "";

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
          <span>{statusLabel(c.status)}</span>
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
          {c.pillar && <Field label="Pilier" value={c.pillar} />}
          {c.objective && <Field label="Objectif" value={c.objective} />}
          {c.hook && <Field label="Accroche" value={c.hook} long />}
          {c.cta && <Field label="Call to Action" value={c.cta} long />}
          {c.tags && c.tags.length > 0 && (
            <Field label="Tags" value={c.tags.join(", ")} />
          )}
        </dl>
      </section>

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
              <p>{reel.script_full}</p>
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
        Mohtawa Script Planner · {formatDateFr(new Date())}
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
      <dd>{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="print-block">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
