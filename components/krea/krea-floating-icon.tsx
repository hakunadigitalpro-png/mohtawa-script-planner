import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Krea détourée, en lévitation. Pas de cadre, pas de pastille ronde : le
 * personnage flotte et son ombre reste au sol. C'est `.krea-float`
 * (globals.css) qui porte l'animation — et qui la coupe si le système
 * demande des animations réduites.
 *
 * Un seul visuel : son portrait. Les poses corps entier (trophée,
 * encouragement, réflexion) ont été retirées — une tête reconnaissable
 * partout vaut mieux qu'un personnage qui change de cadrage d'un écran à
 * l'autre.
 *
 * Fichier à part du copilote : les pages qui veulent seulement son visage
 * n'ont pas à embarquer tout le chat.
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
