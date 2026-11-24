"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { POSITION_LABELS, type SheetField } from "@/lib/article";

const POSITION_OPTIONS = [
  { value: "", label: "À préciser" },
  ...Object.entries(POSITION_LABELS).map(([value, label]) => ({ value, label })),
];

const FIELDS: Record<
  SheetField,
  { label: string; placeholder: string; kind: "line" | "text" | "position" }
> = {
  author: {
    label: "Qui signe",
    placeholder: "Ex : Sonia Trabelsi, gérante d'un moulin à Sfax",
    kind: "line",
  },
  position: { label: "Tu parles en tant que", placeholder: "", kind: "position" },
  context: {
    label: "D'où viennent tes exemples",
    placeholder: "Ex : mon moulin à Sfax, mes clients en Italie et au Canada",
    kind: "line",
  },
  proofs: {
    label: "Preuves à citer",
    placeholder: "Faits, chiffres, exemples vécus. Un par ligne.",
    kind: "text",
  },
  limits: {
    label: "À ne pas promettre",
    placeholder: "Ex : un délai de livraison, un prix, un label que tu n'as pas",
    kind: "text",
  },
  contact: {
    label: "Comment te joindre",
    placeholder: "Ex : sonia@moulin.tn",
    kind: "line",
  },
  rhythm: {
    label: "Si c'est une newsletter : ce qu'elle apporte, à quel rythme",
    placeholder: "Ex : deux fois par mois, une question d'acheteur et sa réponse",
    kind: "line",
  },
};

/** Un champ de la fiche auteur — le même dans le brief et sur la page marque. */
export function AuthorSheetField({
  field,
  value,
  onChange,
  idPrefix,
}: {
  field: SheetField;
  value: string;
  onChange: (v: string) => void;
  idPrefix: string;
}) {
  const f = FIELDS[field];
  const id = `${idPrefix}-${field}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{f.label}</Label>
      {f.kind === "position" ? (
        <Select id={id} value={value} onValueChange={onChange} options={POSITION_OPTIONS} />
      ) : f.kind === "line" ? (
        <Input
          id={id}
          dir="auto"
          value={value}
          maxLength={300}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Textarea
          id={id}
          dir="auto"
          value={value}
          maxLength={3000}
          placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-16 text-sm [field-sizing:content]"
        />
      )}
    </div>
  );
}
