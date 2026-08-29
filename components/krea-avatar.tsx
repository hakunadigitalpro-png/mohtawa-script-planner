import { cn } from "@/lib/utils";
import { KreaFloatingIcon } from "@/components/krea/krea-floating-icon";

/**
 * Signature de Krea, posée partout où elle « parle » : générateurs IA, visite
 * guidée, assistant de thèmes, écran sans marque.
 *
 * Elle réutilise l'icône flottante, la MÊME que le copilote. L'ancienne
 * version recadrait le portrait en cercle (`rounded-full object-cover`), ce
 * qui coupait ses oreilles — d'où l'impression de deux Krea différentes selon
 * l'écran. Une seule source, plus de divergence possible.
 */
export function KreaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <KreaFloatingIcon size={30} className="shrink-0" />
      <span className="text-xs font-bold uppercase tracking-wider text-accent">
        Krea
      </span>
    </span>
  );
}
