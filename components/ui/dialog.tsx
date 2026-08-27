"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type DialogContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
};
const DialogContext = React.createContext<DialogContextType | null>(null);

export function Dialog({
  open,
  onOpenChange,
  children,
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  /**
   * Quand false, le clic sur le fond et la touche Échap ne ferment plus la
   * modal (seul le bouton "X" explicite le fait encore) — utile pour un
   * formulaire en plusieurs étapes où un clic accidentel à côté ne doit pas
   * faire disparaître la progression en cours.
   */
  dismissible?: boolean;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onOpenChange, dismissible]);

  // Monté côté client uniquement : `createPortal` a besoin du `document`.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  // La modal est déportée dans <body> plutôt que rendue à l'endroit du code.
  // Sinon, ouverte depuis un conteneur qui crée un contexte d'empilement
  // (une section à halos, une carte transformée…), elle passerait SOUS la
  // sidebar malgré son z-50.
  return createPortal(
    <DialogContext.Provider value={{ open, setOpen: onOpenChange }}>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/30 p-4 backdrop-blur-sm"
        onClick={() => dismissible && onOpenChange(false)}
      >
        {children}
      </div>
    </DialogContext.Provider>,
    document.body,
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(DialogContext);
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "relative my-8 w-full max-w-2xl rounded-3xl border border-border/60 bg-card shadow-[0_24px_60px_-20px_rgba(26,15,37,0.25)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => ctx?.setOpen(false)}
        className="absolute end-4 top-4 inline-flex size-8 items-center justify-center rounded-full text-muted hover:bg-secondary hover:text-foreground"
        aria-label="Fermer"
      >
        <X className="size-4" />
      </button>
      {children}
    </div>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-6 pt-6 pb-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-xl font-bold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-sm text-muted", className)} {...props} />
  );
}

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-4", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-6 pb-6 pt-2",
        className,
      )}
      {...props}
    />
  );
}
