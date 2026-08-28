import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Krea détourée, en lévitation. Pas de cadre, pas de pastille ronde : le
 * personnage flotte et son ombre reste au sol. C'est `.krea-float`
 * (globals.css) qui porte l'animation — et qui la coupe si le système
 * demande des animations réduites.
 *
 * Fichier à part du copilote : les pages qui veulent seulement sa tête
 * (une note d'encouragement) n'ont pas à embarquer tout le chat.
 */
export function KreaFloatingIcon({
  size,
  className,
  priority,
}: {
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("krea-float", className)} style={{ width: size }}>
      <Image
        src="/mascot/krea-avatar.png"
        alt="Krea"
        width={size}
        height={size}
        priority={priority}
        className="block h-auto w-full"
      />
    </span>
  );
}
