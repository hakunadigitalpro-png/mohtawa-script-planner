"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  value: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
};

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "—",
  id,
  name,
  disabled,
  className,
  contentClassName,
  ariaLabel,
}: SelectProps) {
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

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;
  const isPlaceholder = !selected;

  const handlePick = (v: string) => {
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-full border border-input bg-card pl-4 pr-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50",
          isPlaceholder && "text-muted",
          className,
        )}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Hidden input for form submission (FormData compatibility) */}
      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-border/60 bg-card py-1.5 shadow-[0_12px_40px_-10px_rgba(10,6,18,0.18)]",
            contentClassName,
          )}
        >
          {options.length === 0 && (
            <li className="px-4 py-2 text-sm text-muted">Aucune option</li>
          )}
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => handlePick(opt.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-secondary font-semibold"
                      : "hover:bg-secondary/70",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check className="size-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
