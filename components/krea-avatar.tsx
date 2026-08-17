import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Identité visuelle de Krea, la coach IA de Kreatly — réutilisée partout où
 * elle "parle" : visite guidée, assistants IA, note du dashboard. Portrait
 * détouré (public/mascot/krea-avatar.png) plutôt qu'une icône générique.
 */
export function KreaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Image
        src="/mascot/krea-avatar.png"
        alt="Krea"
        width={28}
        height={28}
        className="size-6 shrink-0 rounded-full object-cover"
      />
      <span className="text-xs font-bold uppercase tracking-wider text-accent">
        Krea
      </span>
    </span>
  );
}
