"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateContent } from "@/app/(app)/contents/actions";
import { cn } from "@/lib/utils";

/**
 * Le titre, modifiable là où on le lit : dans l'en-tête de la fiche.
 *
 * Action ATOMIQUE, pas de bouton Enregistrer — même choix que l'éditeur de
 * publications juste en dessous. C'est aussi pour ça que le titre a été
 * retiré du formulaire du Plan : deux éditeurs pour un même champ et c'est
 * la modification la plus récente qui se fait écraser sans rien dire.
 *
 * Validation sur Entrée ou en quittant le champ, jamais à la frappe :
 * l'application a abandonné l'enregistrement automatique partout ailleurs,
 * et un titre qui part à chaque lettre enverrait vingt requêtes pour un mot.
 * Échap annule et remet la valeur d'avant.
 */
export function ContentTitleField({
  contentId,
  initialTitle,
  placeholder,
}: {
  contentId: string;
  initialTitle: string;
  placeholder: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialTitle);
  // Ce qui est réellement en base — sert de point de retour pour Échap et
  // évite d'enregistrer quand rien n'a changé.
  const [saved, setSaved] = useState(initialTitle);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const commit = () => {
    const next = value.trim();
    if (next === saved.trim()) {
      setValue(saved);
      return;
    }
    setFailed(false);
    startTransition(async () => {
      const res = await updateContent(contentId, { title: next || undefined });
      if (res && "error" in res && res.error) {
        // On GARDE ce qui a été tapé. Remettre l'ancien titre effacerait son
        // travail et lui dirait « réessaie » sans plus rien à réessayer.
        // Le prochain départ du champ retentera l'enregistrement.
        setFailed(true);
        return;
      }
      setSaved(next);
      router.refresh();
    });
  };

  return (
    <div className="space-y-1">
      {/* Un `textarea` et pas un `input` : sur un écran plein, les boutons
          d'action laissent environ 360 px au titre, soit une vingtaine de
          caractères. Un champ d'une seule ligne ne replie pas et n'ellipse
          pas — il coupe net, sans rien pour signaler la suite. Celui-ci
          grandit avec son contenu. */}
      <textarea
        ref={inputRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue(saved);
            inputRef.current?.blur();
          }
        }}
        disabled={pending}
        // `dir="auto"` sur un champ VIDE retombe sur la gauche : en arabe,
        // le texte d'invite se collerait à gauche alors que tout le reste du
        // bandeau est à droite.
        dir={value.trim() ? "auto" : undefined}
        placeholder={placeholder}
        aria-label="Titre du contenu"
        className={cn(
          // Sans bordure au repos : on lit un titre, on ne remplit pas un
          // formulaire. Le cadre n'apparaît qu'au survol et à la saisie.
          "-mx-2 block w-full resize-none overflow-hidden rounded-xl px-2 py-1",
          "[field-sizing:content]",
          "text-3xl font-bold tracking-tight leading-tight text-white",
          "transition-colors placeholder:text-white/40",
          // Un filet permanent sous le texte : il dit « champ » sans dire
          // « formulaire ». Sans lui, rien ne signalait qu'on peut écrire ici
          // — et sur téléphone il n'y a pas de survol pour le découvrir.
          "border border-transparent border-b-white/15 bg-transparent",
          "hover:border-white/25 hover:bg-white/5",
          "focus:border-white/40 focus:bg-white/10 focus:outline-none",
          pending && "opacity-60",
        )}
      />
      {failed && (
        <p className="px-0.5 text-xs font-medium text-white/90" role="alert">
          Le titre n&apos;a pas pu être enregistré. Réessaie.
        </p>
      )}
    </div>
  );
}
