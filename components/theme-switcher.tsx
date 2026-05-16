"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sun, Moon, Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateTheme } from "@/app/(app)/actions";

type Theme = "light" | "dark" | "custom";

const PRESET_ACCENTS = [
  "#ff6b35", // orange (default)
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

const PRESET_TINTS = [
  "#fdf6ef", // warm cream (default)
  "#f5f0fa", // lavender mist
  "#eef7f3", // mint mist
  "#eef2ff", // ice blue
  "#fef2f2", // rose mist
  "#f8fafc", // pure neutral
];

export function ThemeSwitcher({
  initialTheme,
  initialAccent,
  initialTint,
}: {
  initialTheme: Theme;
  initialAccent: string;
  initialTint: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [accent, setAccent] = useState(initialAccent);
  const [tint, setTint] = useState(initialTint);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const apply = (
    next: { theme: Theme; accent: string; tint: string },
  ) => {
    startTransition(async () => {
      await updateTheme(next);
      setSavedAt(Date.now());
      router.refresh();
    });
  };

  const onPickTheme = (t: Theme) => {
    setTheme(t);
    apply({ theme: t, accent, tint });
  };

  const onPickAccent = (a: string) => {
    setAccent(a);
    if (theme !== "custom") setTheme("custom");
    apply({ theme: "custom", accent: a, tint });
  };

  const onPickTint = (t: string) => {
    setTint(t);
    if (theme !== "custom") setTheme("custom");
    apply({ theme: "custom", accent, tint: t });
  };

  const reset = () => {
    setTheme("light");
    setAccent("#ff6b35");
    setTint("#fdf6ef");
    apply({ theme: "light", accent: "#ff6b35", tint: "#fdf6ef" });
  };

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div>
        <div className="mb-2 text-sm font-semibold">Mode d&apos;affichage</div>
        <div className="grid grid-cols-3 gap-2">
          <ModeCard
            label="Clair"
            icon={<Sun className="size-4" />}
            active={theme === "light"}
            onClick={() => onPickTheme("light")}
          />
          <ModeCard
            label="Sombre"
            icon={<Moon className="size-4" />}
            active={theme === "dark"}
            onClick={() => onPickTheme("dark")}
          />
          <ModeCard
            label="Perso"
            icon={<Palette className="size-4" />}
            active={theme === "custom"}
            onClick={() => onPickTheme("custom")}
          />
        </div>
      </div>

      {/* Accent color */}
      <div>
        <div className="mb-2 text-sm font-semibold">Couleur d&apos;accent</div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_ACCENTS.map((c) => (
            <ColorChip
              key={c}
              color={c}
              active={accent.toLowerCase() === c.toLowerCase()}
              onClick={() => onPickAccent(c)}
            />
          ))}
          <CustomColorInput value={accent} onChange={onPickAccent} />
        </div>
      </div>

      {/* Background tint (only meaningful for light/custom) */}
      {theme !== "dark" && (
        <div>
          <div className="mb-2 text-sm font-semibold">Teinte du fond</div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_TINTS.map((c) => (
              <ColorChip
                key={c}
                color={c}
                active={tint.toLowerCase() === c.toLowerCase()}
                onClick={() => onPickTint(c)}
              />
            ))}
            <CustomColorInput value={tint} onChange={onPickTint} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Le gradient warm reste par-dessus pour garder l&apos;ambiance.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={pending}
        >
          Réinitialiser par défaut
        </Button>
        {savedAt && (
          <span className="text-xs text-muted">
            {pending ? "Enregistrement..." : "Préférences enregistrées ✓"}
          </span>
        )}
      </div>
    </div>
  );
}

function ModeCard({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 text-sm font-semibold transition-all",
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border bg-card text-muted hover:border-foreground/30 hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-full",
          active ? "bg-accent text-accent-foreground" : "bg-secondary text-muted",
        )}
      >
        {icon}
      </span>
      <span>{label}</span>
      {active && (
        <span className="absolute end-2 top-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-3" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function ColorChip({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Couleur ${color}`}
      className={cn(
        "relative size-9 rounded-full border-2 transition-transform hover:scale-110",
        active ? "border-foreground" : "border-border",
      )}
      style={{ background: color }}
    >
      {active && (
        <Check
          className="absolute inset-0 m-auto size-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          strokeWidth={3}
        />
      )}
    </button>
  );
}

function CustomColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border bg-card text-xs font-bold text-muted hover:border-foreground/40">
      <Palette className="size-4" />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}
