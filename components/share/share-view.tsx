"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  MessageSquare,
  X,
  Send,
  CornerDownRight,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addGuestComment } from "@/app/share/[token]/actions";
import type {
  Content,
  ReelDetails,
  StoryDetails,
  StorySlide,
  StoryboardScene,
  Performance,
} from "@/lib/types";

const GUEST_NAME_KEY = "mohtawa_guest_name";
const GUEST_EMAIL_KEY = "mohtawa_guest_email";

type SharedComment = {
  id: string;
  target_type: "plan" | "script" | "scene" | "slide";
  target_id: string;
  parent_id: string | null;
  body: string;
  resolved: boolean;
  is_guest: boolean;
  guest_name: string | null;
  created_at: string;
};

type Bundle = {
  content: Content;
  brand_name: string | null;
  reel: ReelDetails | null;
  story: StoryDetails | null;
  slides: StorySlide[];
  scenes: StoryboardScene[];
  performance: Performance | null;
  comments: SharedComment[];
};

type ActiveTarget = {
  type: "plan" | "script" | "scene" | "slide";
  id: string;
  label: string;
};

export function ShareView({
  bundle,
  token,
}: {
  bundle: Bundle;
  token: string;
}) {
  const c = bundle.content;
  const isStory = c.type === "story";
  const canComment = c.share_mode === "comment";

  // Identité invité persistée en localStorage (re-utilisée entre visites).
  const [guestName, setGuestName] = React.useState("");
  const [guestEmail, setGuestEmail] = React.useState("");
  React.useEffect(() => {
    try {
      setGuestName(localStorage.getItem(GUEST_NAME_KEY) ?? "");
      setGuestEmail(localStorage.getItem(GUEST_EMAIL_KEY) ?? "");
    } catch {
      // localStorage indisponible → on travaille sans
    }
  }, []);

  // Drawer state : quel target est actif ?
  const [activeTarget, setActiveTarget] = React.useState<ActiveTarget | null>(
    null,
  );

  // Index des commentaires par "target_type:target_id" pour count rapide.
  const commentsByTarget = React.useMemo(() => {
    const map = new Map<string, SharedComment[]>();
    bundle.comments.forEach((cm) => {
      const key = `${cm.target_type}:${cm.target_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cm);
    });
    return map;
  }, [bundle.comments]);

  const countFor = (type: string, id: string) =>
    commentsByTarget.get(`${type}:${id}`)?.filter((c) => !c.parent_id).length ??
    0;

  const openTarget = (target: ActiveTarget) => setActiveTarget(target);
  const closeDrawer = () => setActiveTarget(null);

  const persistGuestIdentity = (name: string, email: string) => {
    setGuestName(name);
    setGuestEmail(email);
    try {
      if (name) localStorage.setItem(GUEST_NAME_KEY, name);
      if (email) localStorage.setItem(GUEST_EMAIL_KEY, email);
      else localStorage.removeItem(GUEST_EMAIL_KEY);
    } catch {
      // ignore
    }
  };

  // Petit wrapper pour ajouter un bouton commentaire inline si autorisé.
  const Btn = (props: {
    type: ActiveTarget["type"];
    id: string;
    label: string;
  }) => {
    if (!canComment) return null;
    const count = countFor(props.type, props.id);
    return (
      <GuestCommentInlineButton
        count={count}
        onClick={() =>
          openTarget({ type: props.type, id: props.id, label: props.label })
        }
      />
    );
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="inline-flex">
            <Logo wordmarkClassName="text-sm" />
          </Link>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              canComment
                ? "bg-accent/15 text-accent"
                : "bg-secondary/70 text-muted",
            )}
          >
            {canComment ? "Commentaires autorisés" : "Lecture seule"}
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
            {c.platform && (
              <span className="text-muted">· {platformLabel(c.platform)}</span>
            )}
            {c.date && <span className="text-muted">· {formatDateFr(c.date)}</span>}
          </div>
        </div>

        {/* Plan — visible uniquement si au moins un champ est rempli.
            Chaque sous-champ (Accroche, CTA) garde son bouton commenter inline
            pour que le client puisse réagir au détail. */}
        {(c.pillar || c.objective || c.hook || c.cta) && (
          <Section
            title="Plan"
            headerExtra={
              <Btn type="plan" id="general" label="Plan · Infos générales" />
            }
          >
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {c.pillar && <Field label="Thème" value={c.pillar} />}
              {c.objective && <Field label="Objectif" value={c.objective} />}
              {c.hook && (
                <Field
                  label="Accroche"
                  value={c.hook}
                  long
                  inlineExtra={<Btn type="plan" id="hook" label="Accroche" />}
                />
              )}
              {c.cta && (
                <Field
                  label="Call to Action"
                  value={c.cta}
                  long
                  inlineExtra={
                    <Btn type="plan" id="cta" label="Call to Action" />
                  }
                />
              )}
            </dl>
          </Section>
        )}

        {/* Reel script — affiché uniquement si la vidéo est un Reel ET au
            moins un bloc est rempli. Chaque bloc rempli a son bouton commenter
            inline. */}
        {!isStory && bundle.reel && (
          <Section
            title="Script"
            headerExtra={
              <Btn type="script" id="script_full" label="Script · Complet" />
            }
          >
            <div className="space-y-4">
              {bundle.reel.intro && (
                <Block
                  label="Introduction"
                  value={bundle.reel.intro}
                  extra={<Btn type="script" id="intro" label="Script · Intro" />}
                />
              )}
              {bundle.reel.point1 && (
                <Block
                  label="Point 1"
                  value={bundle.reel.point1}
                  extra={<Btn type="script" id="point1" label="Script · Point 1" />}
                />
              )}
              {bundle.reel.point2 && (
                <Block
                  label="Point 2"
                  value={bundle.reel.point2}
                  extra={<Btn type="script" id="point2" label="Script · Point 2" />}
                />
              )}
              {bundle.reel.point3 && (
                <Block
                  label="Point 3"
                  value={bundle.reel.point3}
                  extra={<Btn type="script" id="point3" label="Script · Point 3" />}
                />
              )}
              {bundle.reel.transition && (
                <Block
                  label="Transition / B-roll"
                  value={bundle.reel.transition}
                  extra={
                    <Btn type="script" id="transition" label="Script · Transition" />
                  }
                />
              )}
              {bundle.reel.recap && (
                <Block
                  label="Récap"
                  value={bundle.reel.recap}
                  extra={<Btn type="script" id="recap" label="Script · Récap" />}
                />
              )}
              {bundle.reel.outro && (
                <Block
                  label="Outro"
                  value={bundle.reel.outro}
                  extra={<Btn type="script" id="outro" label="Script · Outro" />}
                />
              )}
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
                  <div className="flex items-center justify-between gap-1 border-b border-border/60 bg-secondary/50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <span>Plan {String(s.scene_number).padStart(2, "0")}</span>
                    <Btn
                      type="scene"
                      id={s.id}
                      label={`Plan ${String(s.scene_number).padStart(2, "0")}`}
                    />
                  </div>
                  {s.image_url && (
                    <div className="relative aspect-video w-full bg-secondary/30">
                      <Image
                        src={s.image_url}
                        alt={`Plan ${s.scene_number}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 300px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-2 p-3 text-sm">
                    {s.description && (
                      <p className="whitespace-pre-wrap">{s.description}</p>
                    )}
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
              <dl className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {bundle.story.objective && (
                  <Field
                    label="Objectif"
                    value={bundle.story.objective}
                    long
                  />
                )}
                {bundle.story.cta_soft && (
                  <Field
                    label="CTA soft"
                    value={bundle.story.cta_soft}
                    long
                  />
                )}
              </dl>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((slot) => {
                const slide = bundle.slides.find((s) => s.slot_number === slot);
                const label =
                  slot === 1
                    ? "Title / Intro"
                    : slot === 5
                      ? "Call to Action"
                      : STORY_SLOT_LABELS[slot] ?? `Story ${slot}`;
                return (
                  <div key={slot} className="flex flex-col">
                    <div className="mb-1.5 flex items-center justify-center gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-muted">
                      <span>{label}</span>
                      <Btn
                        type="slide"
                        id={String(slot)}
                        label={`Story · ${label}`}
                      />
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
                          />
                        )}
                      </div>
                    </div>
                    {slide?.body && (
                      <p className="mt-2 text-[11px] leading-snug">
                        {slide.body}
                      </p>
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
                  <Field
                    label="Partages"
                    value={String(bundle.performance.shares)}
                  />
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
                  <Field label="Analyse" value={bundle.performance.notes} long />
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
            Créer ta propre fiche avec Kreatly
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </main>

      {/* Drawer pour le thread actif (rendu uniquement si comment mode + target) */}
      {canComment && activeTarget && (
        <GuestCommentDrawer
          token={token}
          target={activeTarget}
          comments={commentsByTarget.get(
            `${activeTarget.type}:${activeTarget.id}`,
          ) ?? []}
          guestName={guestName}
          guestEmail={guestEmail}
          onClose={closeDrawer}
          onIdentitySave={persistGuestIdentity}
        />
      )}
    </div>
  );
}

/* ============================ Section/Field/Block helpers ============================ */

function Section({
  title,
  children,
  headerExtra,
}: {
  title: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {title}
        </h2>
        {headerExtra}
      </div>
      {children}
    </Card>
  );
}

function Field({
  label,
  value,
  long = false,
  inlineExtra,
}: {
  label: string;
  value: string;
  long?: boolean;
  inlineExtra?: React.ReactNode;
}) {
  return (
    <div className={long ? "md:col-span-2" : ""}>
      <dt className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        <span>{label}</span>
        {inlineExtra}
      </dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

function Block({
  label,
  value,
  extra,
}: {
  label: string;
  value: string;
  extra?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        <span>{label}</span>
        {extra}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

/* ============================ Comment inline button ============================ */

function GuestCommentInlineButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition",
        count > 0
          ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/15"
          : "border-border/60 bg-card text-muted hover:border-foreground/30 hover:text-foreground",
      )}
      aria-label="Commenter ce bloc"
    >
      <MessageSquare className="size-3" />
      {count > 0 ? count : "Commenter"}
    </button>
  );
}

/* ============================ Drawer ============================ */

function GuestCommentDrawer({
  token,
  target,
  comments,
  guestName: initialGuestName,
  guestEmail: initialGuestEmail,
  onClose,
  onIdentitySave,
}: {
  token: string;
  target: ActiveTarget;
  comments: SharedComment[];
  guestName: string;
  guestEmail: string;
  onClose: () => void;
  onIdentitySave: (name: string, email: string) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [body, setBody] = React.useState("");
  const [replyToId, setReplyToId] = React.useState<string | null>(null);
  const [replyBody, setReplyBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  // Identité locale (peut être modifiée à la 1ère contribution)
  const [name, setName] = React.useState(initialGuestName);
  const [email, setEmail] = React.useState(initialGuestEmail);

  // Sépare les commentaires racine et les réponses pour rendre les threads
  const roots = comments.filter((c) => !c.parent_id);
  const repliesByParent = React.useMemo(() => {
    const map = new Map<string, SharedComment[]>();
    comments.forEach((c) => {
      if (c.parent_id) {
        if (!map.has(c.parent_id)) map.set(c.parent_id, []);
        map.get(c.parent_id)!.push(c);
      }
    });
    return map;
  }, [comments]);

  // Echap pour fermer
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent, parentId: string | null) => {
    e.preventDefault();
    setError(null);

    const usedBody = parentId ? replyBody : body;
    if (!usedBody.trim()) return;
    if (!name.trim()) {
      setError("Renseigne ton nom pour commenter.");
      return;
    }

    startTransition(async () => {
      const res = await addGuestComment({
        token,
        targetType: target.type,
        targetId: target.id,
        parentId,
        body: usedBody,
        guestName: name,
        guestEmail: email,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      // Sauvegarde l'identité en localStorage pour les prochains commentaires
      onIdentitySave(name.trim(), email.trim());
      if (parentId) {
        setReplyBody("");
        setReplyToId(null);
      } else {
        setBody("");
      }
      // Refresh le RSC pour récupérer les nouveaux commentaires
      router.refresh();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label={`Commentaires sur ${target.label}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel droit */}
      <div className="relative ms-auto flex h-full w-full max-w-md flex-col bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div>
            <h2 className="text-base font-semibold">Commentaires</h2>
            <p className="text-xs text-muted">{target.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-secondary"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Liste des commentaires */}
        <div className="flex-1 overflow-y-auto p-4">
          {roots.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
              Aucun commentaire ici.
              <br />
              Sois le premier à laisser un retour.
            </div>
          ) : (
            <ul className="space-y-4">
              {roots.map((root) => {
                const replies = repliesByParent.get(root.id) ?? [];
                return (
                  <li key={root.id}>
                    <CommentBubble c={root} />
                    {replies.length > 0 && (
                      <ul className="mt-2 space-y-2 ps-6">
                        {replies.map((r) => (
                          <li key={r.id}>
                            <CommentBubble c={r} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {replyToId !== root.id ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyToId(root.id);
                          setReplyBody("");
                        }}
                        className="ms-9 mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-muted hover:text-foreground"
                      >
                        <CornerDownRight className="size-3" />
                        Répondre
                      </button>
                    ) : (
                      <form
                        onSubmit={(e) => submit(e, root.id)}
                        className="ms-9 mt-2 space-y-2"
                      >
                        <Textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Ta réponse…"
                          className="min-h-16 text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button type="submit" size="sm" disabled={pending}>
                            <Send className="size-3" />
                            Envoyer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReplyToId(null);
                              setReplyBody("");
                            }}
                          >
                            Annuler
                          </Button>
                        </div>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Formulaire d'ajout */}
        <form
          onSubmit={(e) => submit(e, null)}
          className="space-y-2 border-t border-border/60 bg-secondary/30 p-4"
        >
          {(!initialGuestName || !name) && (
            <>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom (requis)"
                className="h-9 text-sm"
                maxLength={80}
              />
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ton email (optionnel)"
                type="email"
                className="h-9 text-sm"
              />
            </>
          )}
          {initialGuestName && name && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">
                Tu commentes en tant que{" "}
                <span className="font-semibold text-foreground">{name}</span>
              </span>
              <button
                type="button"
                onClick={() => setName("")}
                className="text-muted underline hover:text-foreground"
              >
                Changer
              </button>
            </div>
          )}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Laisse ton retour sur ce bloc…"
            className="min-h-20 text-sm"
            maxLength={2000}
          />
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            <Send className="size-3.5" />
            {pending ? "Envoi…" : "Envoyer le commentaire"}
          </Button>
        </form>
      </div>
    </div>
  );
}

function CommentBubble({ c }: { c: SharedComment }) {
  const authorLabel = c.guest_name ?? "Équipe";
  return (
    <div className="flex items-start gap-2">
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase",
          c.is_guest
            ? "bg-orange-soft text-orange-strong"
            : "bg-secondary",
        )}
      >
        {authorLabel.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="font-semibold text-foreground">{authorLabel}</span>
          {c.is_guest ? (
            <span className="rounded-full bg-orange-soft/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-strong">
              Invité
            </span>
          ) : (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted">
              Équipe
            </span>
          )}
          <span className="text-muted">·</span>
          <span className="text-muted">{relativeTime(c.created_at)}</span>
        </div>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">
          {c.body}
        </p>
      </div>
    </div>
  );
}

/** Temps relatif simple en français pour la page partage (pas d'intl deps). */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
