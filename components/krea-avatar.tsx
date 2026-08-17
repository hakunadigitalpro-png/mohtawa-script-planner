import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Identité visuelle de Krea, la coach IA de Kreatly — réutilisée partout où
 * elle "parle" : visite guidée, assistants IA, note du dashboard. Un badge
 * simple (pas de mascotte illustrée — cf. décision produit) pour rester
 * cohérent avec le système de design existant plutôt que d'ajouter un
 * nouveau personnage.
 */
export function KreaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Sparkles className="size-3" />
      </span>
      <span className="text-xs font-bold uppercase tracking-wider text-accent">
        Krea
      </span>
    </span>
  );
}
