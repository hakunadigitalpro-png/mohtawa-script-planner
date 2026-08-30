import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  moodClass,
  moodSrc,
  moodWidth,
  type KreaMood,
} from "@/lib/krea-moods";

/**
 * Krea détourée, en lévitation. Pas de cadre, pas de pastille ronde : le
 * personnage flotte et son ombre reste au sol.
 *
 * `mood` change sa POSE et son mouvement — elle félicite, elle relance, elle
 * réfléchit. C'est ce qui la sépare d'un logo posé à côté du texte.
 *
 * `size` est une HAUTEUR, pas une largeur : le portrait est presque carré,
 * les poses corps entier ne le sont pas. Caler sur la largeur ferait rétrécir
 * Krea à chaque changement d'humeur.
 *
 * Fichier à part du copilote : les pages qui veulent seulement son visage
 * n'ont pas à embarquer tout le chat.
 */
export function KreaFloatingIcon({
  size,
  mood = "idle",
  className,
  priority,
}: {
  /** Hauteur affichée, en pixels. */
  size: number;
  mood?: KreaMood;
  className?: string;
  priority?: boolean;
}) {
  const width = moodWidth(mood, size);

  return (
    <span
      className={cn(moodClass(mood), className)}
      style={{ width, height: size }}
    >
      <Image
        src={moodSrc(mood)}
        alt="Krea"
        width={width}
        height={size}
        priority={priority}
        className="block h-full w-full object-contain"
      />
    </span>
  );
}
