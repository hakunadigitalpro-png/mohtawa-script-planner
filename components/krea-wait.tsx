"use client";

import { useEffect, useState } from "react";
import { ThinkingIndicator } from "@/components/ai-generator";

/**
 * L'attente d'un appel IA long (20 à 90 s). Un simple bouton qui tourne passe
 * pour une panne au bout de dix secondes : on dit ce qui se passe, et que
 * l'étape avance.
 */
export function KreaWait({ steps }: { steps: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setI((n) => Math.min(n + 1, steps.length - 1)),
      15_000,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  return (
    <div aria-live="polite" className="space-y-2">
      <ThinkingIndicator label={steps[i] ?? ""} />
      <p className="text-center text-xs text-muted">
        Jusqu&apos;à une minute et demie. Tu peux changer d&apos;onglet, reste
        sur cette fiche.
      </p>
    </div>
  );
}
