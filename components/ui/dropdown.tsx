"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DropdownContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
  menuRef: React.MutableRefObject<HTMLDivElement | null>;
  align: "start" | "end";
};
const DropdownContext = React.createContext<DropdownContextType | null>(null);

export function Dropdown({
  children,
  align = "end",
}: {
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Click/tap en dehors du trigger ET du menu (le menu est dans un portal,
    // donc pas un descendant DOM du trigger → on teste les deux refs).
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef, menuRef, align }}>
      <div className="relative inline-block">{children}</div>
    </DropdownContext.Provider>
  );
}

export function DropdownTrigger({
  children,
  asChild = false,
  className,
}: {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx) return null;
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    ctx.setOpen(!ctx.open);
  };
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(
      children as React.ReactElement<{
        onClick?: (e: React.MouseEvent) => void;
        ref?: React.Ref<HTMLElement>;
      }>,
      { onClick, ref: ctx.triggerRef },
    );
  }
  return (
    <button
      type="button"
      ref={ctx.triggerRef as React.Ref<HTMLButtonElement>}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

export function DropdownContent({
  children,
  align: alignProp,
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  const align = alignProp ?? ctx?.align ?? "end";
  const [pos, setPos] = React.useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);

  React.useEffect(() => {
    if (!ctx?.open) {
      setPos(null);
      return;
    }
    const update = () => {
      const el = ctx.triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const top = r.bottom + 6;
      if (align === "end") {
        // Bord droit du menu aligné sur le bord droit du trigger.
        setPos({ top, right: Math.max(8, window.innerWidth - r.right) });
      } else {
        setPos({ top, left: Math.max(8, r.left) });
      }
    };
    update();
    // Le menu est en position fixed → on le recolle si on scrolle/redimensionne.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [ctx?.open, align, ctx?.triggerRef]);

  if (!ctx?.open || !pos || typeof document === "undefined") return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    right: pos.right,
  };

  // Rendu dans <body> → jamais rogné par un overflow-hidden parent, jamais
  // recouvert par un stacking context de carte. z-[60] = au-dessus des barres
  // de nav mobiles (z-40).
  return createPortal(
    <div
      ref={ctx.menuRef}
      role="menu"
      style={style}
      className={cn(
        "z-[60] max-h-[70vh] min-w-48 overflow-y-auto rounded-2xl border border-border/60 bg-card py-1.5 shadow-[0_12px_40px_-10px_rgba(26,15,37,0.18)]",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownItem({
  children,
  onClick,
  destructive = false,
  disabled = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.(e);
        ctx?.setOpen(false);
      }}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-2 text-start text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1 h-px bg-border/60" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
      {children}
    </div>
  );
}
