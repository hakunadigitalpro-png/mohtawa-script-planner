"use client";

import { useEffect } from "react";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

export function PrintActions({ title }: { title: string }) {
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = `${title} — Export Mohtawa`;
    }
  }, [title]);

  return (
    <div className="print-actions no-print">
      <Link href="/dashboard" className="print-back">
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
