import Image from "next/image";
import { cn } from "@/lib/utils";
import { moodClass, moodSrc, type KreaMood } from "@/lib/krea-moods";

/**
 * Krea détourée, en lévitation. Pas de cadre, pas de pastille ronde : le
 * personnage flotte et son ombre reste au sol.
 *
 * `mood` change son mouvement — et sa pose dès qu'un visuel dédié existe
 * (cf. lib/krea-moods.ts). Elle félicite, elle relance, elle réfléchit :
 * c'est ce qui la sépare d'un logo posé à côté du texte.
 *
 * Fichier à part du copilote : les pages qui veulent seulement sa tête
 * n'ont pas à embarquer tout le chat.
 */
export function KreaFloatingIcon({
  size,
  mood = "idle",
  className,
  priority,
}: {
  size: number;
  mood?: KreaMood;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn(moodClass(mood), className)} style={{ width: size }}>
      <Image
        src={moodSrc(mood)}
        alt="Krea"
        width={size}
        height={size}
        priority={priority}
        className="block h-auto w-full"
      />
    </span>
  );
}
