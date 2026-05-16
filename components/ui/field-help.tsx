"use client";

import * as React from "react";
import { Info, PlayCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Petit bouton "i" cliquable qui ouvre une modal d'aide contextuelle.
 *
 * Usage :
 *   <FieldHelp title="Pilier de contenu" videoUrl="https://youtu.be/...">
 *     <p>Mon contenu d'aide</p>
 *   </FieldHelp>
 */
export function FieldHelp({
  title,
  description,
  videoUrl,
  children,
  className,
  ariaLabel,
}: {
  title: string;
  description?: string;
  videoUrl?: string;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={ariaLabel ?? `En savoir plus sur ${title}`}
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
          className,
        )}
      >
        <Info className="size-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-accent" />
              {title}
            </DialogTitle>
            {description ? (
              <DialogDescription>{description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogBody className="max-h-[70vh] overflow-y-auto pb-6 text-sm leading-relaxed text-foreground">
            <div className="field-help-prose space-y-4">{children}</div>
            {videoUrl ? <VideoLink url={videoUrl} /> : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

function VideoLink({ url }: { url: string }) {
  // On reste sur un simple lien externe (pas d'iframe) :
  // - plus léger, pas de cookies YouTube imposés à l'user
  // - ouvre dans un nouvel onglet → l'user peut continuer à lire l'aide
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 flex items-center gap-3 rounded-2xl border border-border/60 bg-secondary/40 p-4 transition hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <PlayCircle className="size-5" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-foreground">
          Voir la vidéo explicative
        </span>
        <span className="block text-xs text-muted">
          Ouvre YouTube dans un nouvel onglet
        </span>
      </span>
    </a>
  );
}

/**
 * Petits helpers de styling pour rester cohérent dans les contenus d'aide.
 * (Évite de répéter les mêmes classes Tailwind partout.)
 */

export function HelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
        {title}
      </h3>
      <div className="space-y-2 text-sm text-foreground/90">{children}</div>
    </section>
  );
}

export function HelpList({
  items,
  ordered = false,
}: {
  items: React.ReactNode[];
  ordered?: boolean;
}) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag
      className={cn(
        "space-y-1.5 ps-5 text-sm text-foreground/90",
        ordered ? "list-decimal" : "list-disc",
      )}
    >
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

export function HelpCallout({
  variant = "info",
  children,
}: {
  variant?: "info" | "tip" | "warning";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-accent/30 bg-accent/5 text-foreground",
    tip: "border-emerald-300/40 bg-emerald-50/60 text-foreground",
    warning: "border-amber-300/50 bg-amber-50/60 text-foreground",
  } as const;

  return (
    <div
      className={cn(
        "rounded-2xl border px-4 py-3 text-sm leading-relaxed",
        styles[variant],
      )}
    >
      {children}
    </div>
  );
}
