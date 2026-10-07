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
 * Une tentative de la remplacer par un corps entier ANIMÉ dans le coin
 * (07/10/2026) a été abandonnée : le rendu 3D fourni était blanc sur fond
 * blanc, et le détourage mangeait ses jambes et ses avant-bras. Invisible
 * sur le crème de l'app, flagrant dès qu'on la pose sur une couleur. Pour
 * y revenir il faut un rendu AVEC canal alpha, ou sur un fond contrasté.
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
