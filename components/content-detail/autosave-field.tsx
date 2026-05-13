"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

export function useAutosave<T>(
  value: T,
  save: (v: T) => Promise<{ error?: string; ok?: boolean } | undefined>,
  delay = 700,
) {
  const [status, setStatus] = useState<Status>("idle");
  const initial = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");
    timer.current = setTimeout(async () => {
      const res = await save(value);
      if (res?.error) setStatus("error");
      else setStatus("saved");
    }, delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return status;
}

export function AutosaveIndicator({ status }: { status: Status }) {
  const text = {
    idle: "",
    saving: "Enregistrement...",
    saved: "Enregistré ✓",
    error: "Erreur",
  }[status];
  return (
    <span
      className={cn(
        "text-xs transition-opacity",
        status === "idle" ? "opacity-0" : "opacity-100",
        status === "error" ? "text-destructive" : "text-muted",
      )}
    >
      {text}
    </span>
  );
}
