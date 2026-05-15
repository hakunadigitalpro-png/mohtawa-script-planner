import { notFound } from "next/navigation";
import Image from "next/image";
import { Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  platformLabel,
  typeLabel,
  typeColor,
  statusLabel,
  statusColor,
  STORY_SLOT_LABELS,
} from "@/lib/constants";
import { formatDateFr } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge, ColorDot } from "@/components/ui/badge";
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
} from "@/lib/types";

export const metadata = {
  title: "Vidéo partagée — Mohtawa",
  robots: { index: false, follow: false },
};

type Bundle = {
  content: Content;
  brand_name: string | null;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  slides: StorySlide[];
  scenes: StoryboardScene[];
  performance: Performance | null;
};

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_shared_content", {
    p_token: token,
  });
  if (error || !data) notFound();

  const bundle = data as Bundle;
  const c = bundle.content;
  const isStory = c.type === "story";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <div className="flex size-8 items-center justify-center rounded-xl bg-ink text-white">
              <Sparkles className="size-4" />
            </div>
            Mohtawa
          </Link>
          <span className="rounded-full bg-secondary/70 px-3 py-1 text-xs font-semibold text-muted">
            Lecture seule
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Title block */}
        <div className="space-y-2">
          {bundle.brand_name && (
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
              {bundle.brand_name}
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight">
            {c.title || "Sans titre"}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{
                background: `${typeColor(c.type)}1f`,
                color: typeColor(c.type),
              }}
            >
              <ColorDot color={typeColor(c.type)} />
              {typeLabel(c.type)}
            </span>
            <Badge
              className="text-white"
              style={{ background: statusColor(c.status) }}
            >
              {statusLabel(c.status)}
            </Badge>
            {c.platform && <span className="text-muted">· {platformLabel(c.platform)}</span>}
            {c.date && <span className="text-muted">· {formatDateFr(c.date)}</span>}
          </div>
        </div>

        {/* Plan */}
        {(c.pillar || c.objective || c.hook || c.cta) && (
          <Section title="Plan">
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {c.pillar && <Field label="Pilier" value={c.pillar} />}
              {c.objective && <Field label="Objectif" value={c.objective} />}
              {c.hook && <Field label="Accroche" value={c.hook} long />}
              {c.cta && <Field label="Call to Action" value={c.cta} long />}
            </dl>
          </Section>
        )}

        {/* Reel script */}
        {!isStory && bundle.reel && (
          <Section title="Script">
            <div className="space-y-4">
              {bundle.reel.intro && <Block label="Introduction" value={bundle.reel.intro} />}
              {bundle.reel.point1 && <Block label="Point 1" value={bundle.reel.point1} />}
              {bundle.reel.point2 && <Block label="Point 2" value={bundle.reel.point2} />}
              {bundle.reel.point3 && <Block label="Point 3" value={bundle.reel.point3} />}
              {bundle.reel.transition && <Block label="Transition / B-roll" value={bundle.reel.transition} />}
              {bundle.reel.recap && <Block label="Récap" value={bundle.reel.recap} />}
              {bundle.reel.outro && <Block label="Outro" value={bundle.reel.outro} />}
            </div>
            {bundle.reel.script_full && (
              <div className="mt-5 rounded-2xl bg-secondary/40 p-4 text-sm whitespace-pre-wrap">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                  Script complet
                </div>
                {bundle.reel.script_full}
              </div>
            )}
          </Section>
        )}

        {/* Storyboard */}
        {!isStory && bundle.scenes.length > 0 && (
          <Section title="Storyboard">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bundle.scenes.map((s) => (
                <div
                  key={s.id}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
                >
                  <div className="border-b border-border/60 bg-secondary/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                    Plan {String(s.scene_number).padStart(2, "0")}
                  </div>
                  {s.image_url && (
                    <div className="relative aspect-video w-full bg-secondary/30">
                      <Image
                        src={s.image_url}
                        alt={`Plan ${s.scene_number}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 300px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="space-y-2 p-3 text-sm">
                    {s.description && <p className="whitespace-pre-wrap">{s.description}</p>}
                    {s.camera_angle && (
                      <p className="text-xs text-muted">📷 {s.camera_angle}</p>
                    )}
                    {s.on_screen_text && (
                      <p className="text-xs text-muted">💬 {s.on_screen_text}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Stories */}
        {isStory && (
          <Section title="Storyboard Planner">
            {bundle.story && (
              <dl className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-5">
                {bundle.story.objective && (
                  <Field label="Objectif" value={bundle.story.objective} long />
                )}
                {bundle.story.cta_soft && (
                  <Field label="CTA soft" value={bundle.story.cta_soft} long />
                )}
              </dl>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((slot) => {
                const slide = bundle.slides.find((s) => s.slot_number === slot);
                const label =
                  slot === 1 ? "Title / Intro" :
                  slot === 5 ? "Call to Action" :
                  STORY_SLOT_LABELS[slot] ?? `Story ${slot}`;
                return (
                  <div key={slot} className="flex flex-col">
                    <div className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
                      {label}
                    </div>
                    <div className="overflow-hidden rounded-2xl border-4 border-foreground/80 bg-card">
                      <div className="relative aspect-[9/16] w-full bg-secondary/30">
                        {slide?.image_url && (
                          <Image
                            src={slide.image_url}
                            alt={label}
                            fill
                            sizes="200px"
                            className="object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                    </div>
                    {slide?.body && (
                      <p className="mt-2 text-[11px] leading-snug">{slide.body}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* Performance */}
        {bundle.performance &&
          (bundle.performance.views ||
            bundle.performance.likes ||
            bundle.performance.notes) && (
            <Section title="Performances">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {bundle.performance.views != null && (
                  <Field label="Vues" value={String(bundle.performance.views)} />
                )}
                {bundle.performance.likes != null && (
                  <Field label="Likes" value={String(bundle.performance.likes)} />
                )}
                {bundle.performance.comments != null && (
                  <Field
                    label="Commentaires"
                    value={String(bundle.performance.comments)}
                  />
                )}
                {bundle.performance.shares != null && (
                  <Field label="Partages" value={String(bundle.performance.shares)} />
                )}
                {bundle.performance.saves != null && (
                  <Field
                    label="Sauvegardes"
                    value={String(bundle.performance.saves)}
                  />
                )}
                {bundle.performance.retention != null && (
                  <Field
                    label="Rétention (%)"
                    value={String(bundle.performance.retention)}
                  />
                )}
                {bundle.performance.notes && (
                  <Field
                    label="Analyse"
                    value={bundle.performance.notes}
                    long
                  />
                )}
              </dl>
            </Section>
          )}

        {/* Footer CTA */}
        <div className="pt-6 pb-12 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            Créer ta propre fiche avec Mohtawa
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-[11px] font-bold uppercase tracking-wider text-muted">
        {title}
      </h2>
      {children}
    </Card>
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
    <div className={long ? "md:col-span-2" : ""}>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">
        {label}
      </div>
      <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}
