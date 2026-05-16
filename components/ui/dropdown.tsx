"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type DropdownContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
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
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className={cn("relative inline-block", align === "end" ? "text-end" : "")}>
        {children}
      </div>
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
    return React.cloneElement(children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>, { onClick });
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function DropdownContent({
  children,
  align = "end",
  className,
}: {
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const ctx = React.useContext(DropdownContext);
  if (!ctx?.open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "absolute z-30 mt-2 min-w-48 overflow-hidden rounded-2xl border border-border/60 bg-card py-1.5 shadow-[0_12px_40px_-10px_rgba(26,15,37,0.18)]",
        align === "end" ? "end-0" : "start-0",
        className,
      )}
    >
      {children}
    </div>
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
