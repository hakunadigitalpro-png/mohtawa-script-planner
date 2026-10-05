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

/**
 * Garde anti open-redirect pour le paramètre `next` (login/register). Ne
 * renvoie que des chemins internes ; tout ce qui n'est pas un chemin
 * commençant par un seul `/` (URL externe, `//host`, non-string) retombe sur
 * `/dashboard`.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== "string") return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//")) return "/dashboard";
  return value;
}

/**
 * Extraction JSON tolérante des réponses de l'IA (Claude ne garantit pas du
 * JSON pur) : retire un éventuel bloc ```json … ```, sinon prend du premier
 * `{` au dernier `}`. Renvoie la chaîne à passer à JSON.parse (l'appelant
 * gère l'échec de parsing).
 */
export function extractJsonBlock(text: string): string {
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    raw = fenced[1].trim();
  } else {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      raw = raw.slice(start, end + 1);
    }
  }
  return raw;
}

export function formatDateFr(date: string | Date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Une invitation "sans expiration" (migration 0043) a en réalité un
 * `expires_at` poussé à +100 ans plutôt qu'une colonne nullable — ça évite
 * de retoucher la logique existante. Ici on détecte ce cas côté affichage
 * pour ne pas montrer une date absurde ("expire en 2126") à l'utilisateur.
 */
export function isFarFuture(isoDate: string, thresholdYears = 5): boolean {
  const years =
    (new Date(isoDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 365);
  return years > thresholdYears;
}

/**
 * « mardi 13 octobre 2026 » — pour les en-têtes, où la date sert à situer
 * l'utilisateur plutôt qu'à être lue en diagonale dans un tableau.
 *
 * Midi et pas minuit : une date seule (AAAA-MM-JJ) est interprétée en UTC,
 * et reculerait d'un jour à l'affichage dans un fuseau négatif.
 */
export function formatDateLongFr(date: string): string {
  const d = new Date(date.length <= 10 ? `${date}T12:00:00` : date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** « 09h00 » depuis un HH:MM:SS. Renvoie null si l'heure est absente. */
export function formatTimeFr(time: string | null | undefined): string | null {
  if (!time) return null;
  const [h, m] = time.split(":");
  if (!h || !m) return null;
  return `${h}h${m}`;
}
