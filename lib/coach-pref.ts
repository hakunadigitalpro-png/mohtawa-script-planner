/**
 * « Krea me guide » : oui ou non.
 *
 * Un cookie, pas la base : c'est une préférence d'affichage, comme le thème
 * et le menu (`lib/theme.ts`, `lib/nav-pref.ts`). Lu côté serveur pour que
 * l'interrupteur du Profil arrive déjà dans le bon état, sans sauter ; et
 * par navigateur plutôt que par compte, ce qui est précisément ce qu'il faut
 * pour une démo : sur un poste neuf, les visites sont actives.
 *
 * UNE seule voie d'écriture, côté client (`setCoachMode` ci-dessous), comme
 * le pli du menu : un `revalidatePath` du layout pour une préférence
 * d'affichage re-rendrait toute l'application. La valeur courante vit dans
 * un petit magasin externe amorcé par le serveur, pour que la visite et
 * l'interrupteur du Profil voient le même état sans rechargement.
 *
 * Pas de `next/headers` en tête de fichier — ce module est aussi lu côté
 * client ; il serait importé par erreur dans le bundle du navigateur.
 */
export const COACH_COOKIE = "kreatly_coach";

export type CoachMode = "on" | "off";

export function isCoachMode(v: string | undefined | null): v is CoachMode {
  return v === "on" || v === "off";
}

/** Activé par défaut : on ne découvre pas une application en silence. */
export async function getCoachMode(): Promise<CoachMode> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(COACH_COOKIE)?.value;
  return isCoachMode(raw) ? raw : "on";
}

/* ------------------------ Magasin client, amorcé en SSR ------------------- */

let current: CoachMode | null = null;
const listeners = new Set<() => void>();

/** Appelé par les composants qui reçoivent la valeur du serveur. */
export function seedCoachMode(mode: CoachMode): void {
  if (current === null) current = mode;
}

export function setCoachMode(mode: CoachMode): void {
  current = mode;
  try {
    document.cookie = `${COACH_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    // Pas de cookie possible : la préférence vaut pour cette page, c'est tout.
  }
  for (const l of listeners) l();
}

export function subscribeCoachMode(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function coachModeSnapshot(): CoachMode {
  return current ?? "on";
}
