import type { LucideIcon } from "lucide-react";

/**
 * Champ stylé « Diprella » : fond gris clair, sans bordure, icône en tête.
 * Utilisé dans les formulaires de connexion / inscription.
 */
export function AuthField({
  icon: Icon,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon: LucideIcon }) {
  return (
    <div className="relative w-full">
      <Icon className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9aa0a6]" />
      <input
        {...props}
        className="h-11 w-full rounded-lg border-0 bg-[#eff0f2] ps-10 pe-3.5 text-sm text-[#1a1420] outline-none transition placeholder:text-[#9aa0a6] focus:bg-[#e7e9ec] focus:ring-2 focus:ring-accent/40"
      />
    </div>
  );
}
