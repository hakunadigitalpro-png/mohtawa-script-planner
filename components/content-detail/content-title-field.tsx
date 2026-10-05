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
  const inputRef = useRef<HTMLInputElement>(null);
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
        setFailed(true);
        setValue(saved); // on ne laisse pas croire que c'est enregistré
        return;
      }
      setSaved(next);
      router.refresh();
    });
  };

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
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
        dir="auto"
        placeholder={placeholder}
        aria-label="Titre du contenu"
        className={cn(
          // Sans bordure au repos : on lit un titre, on ne remplit pas un
          // formulaire. Le cadre n'apparaît qu'au survol et à la saisie.
          "w-full rounded-xl border border-transparent bg-transparent px-2 py-1 -mx-2",
          "text-2xl font-extrabold leading-tight text-white sm:text-3xl",
          "transition-colors placeholder:text-white/40",
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
