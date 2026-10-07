import { Loader2 } from "lucide-react";

/**
 * L'état « l'IA travaille », partout pareil.
 *
 * Un bouton qui se contente de griser et de changer son texte ne dit pas
 * grand-chose : rien ne bouge, et une génération qui prend vingt secondes
 * ressemble alors à une panne. Le point qui tourne est le seul signe que
 * quelque chose se passe encore.
 *
 * Volontairement un composant partagé plutôt qu'un spinner recopié dans
 * chaque bouton : l'attente doit se reconnaître d'un écran à l'autre.
 */
export function Thinking({ label }: { label?: string }) {
  return (
    <>
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
      <span>{label ?? "Je réfléchis…"}</span>
    </>
  );
}
