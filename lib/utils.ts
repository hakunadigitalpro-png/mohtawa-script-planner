import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Liste blanche : renvoie une copie de `obj` ne gardant QUE les clés autorisées
 * (et présentes). Sécurise les Server Actions contre le mass-assignment — un
 * objet `patch` venu du client ne peut plus injecter de colonnes cachées
 * (`brand_id`, `share_token`, `user_id`…) : seules les clés listées passent.
 * `undefined` est ignoré (= « ne pas toucher ») ; `null` est conservé.
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<Partial<T>, K> {
  const out = {} as Pick<Partial<T>, K>;
  for (const k of keys) {
    if (obj[k] !== undefined) out[k] = obj[k];
  }
  return out;
}

export function formatDateFr(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
