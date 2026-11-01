import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * L'identifiant du build en cours d'exécution. Next.js l'écrit dans
 * `.next/BUILD_ID` à chaque `next build` : il change à chaque déploiement
 * Coolify, c'est donc le signal le plus simple et le plus sûr pour dire
 * « une nouvelle version est en ligne ». Lu une fois par processus (le
 * fichier ne change pas tant que le conteneur tourne). En dev, pas de
 * fichier → "dev", et le bandeau ne s'affiche jamais.
 */
let cached: string | null = null;

export function getBuildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
  } catch {
    cached = "dev";
  }
  return cached;
}
