"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PrintActions({
  title,
  backHref = "/dashboard",
}: {
  title: string;
  /** Où revenir en quittant l'export — la fiche d'origine, pas toujours le
   *  dashboard (une stratégie ramène à sa marque). */
  backHref?: string;
}) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${title} — Export Kreatly`;
    }
  }, [title]);

  return (
    <div className="print-actions no-print">
      <Link href={backHref} className="print-back">
        <ArrowLeft className="size-4" />
        Retour à l&apos;app
      </Link>
      <button
        type="button"
        onClick={() => window.print()}
        className="print-button"
      >
        <Printer className="size-4" />
        Imprimer / Enregistrer en PDF
      </button>
    </div>
  );
}
