import { describe, expect, it } from "vitest";
import {
  ARTICLE_TEMPLATE,
  EMPTY_BRIEF,
  briefSummary,
  claimsMissing,
  withRoles,
  cleanBrief,
  cleanDraft,
  cleanSheet,
  draftParts,
  isUsableDraft,
  mergeSheet,
  orderParts,
  parseArticle,
  partNumber,
  prefillBrief,
  setNumbering,
  sheetChanges,
} from "./article";

const reply = `Voici :
@@TITRES@@
- 3 questions à poser à ton moulin
- « Avant d'acheter : trois questions »
1. Ce que je demande en 3 points
@@SOUS-TITRE@@
Pour les importateurs qui veulent le même goût à chaque lot
@@INTRODUCTION@@
Je presse mes olives à Sfax.

Deuxième paragraphe, avec "guillemets" et { accolades }.
@@PARTIE@@ 1. D'où viennent tes olives
Texte un.
@@PARTIE@@
Qui contrôle
Texte deux.
@@PARTIE@@ **Le lot suivant**
Texte trois [À CONFIRMER].
@@CONCLUSION@@
Écris-moi.
@@PARTAGE@@
J'ai mis dix ans. #huile
@@IMAGE@@
Un moulin, tôt le matin.
@@A-VALIDER@@
- Acidité sous 0,8 %
- Aucune
@@FIN@@`;

describe("parseArticle", () => {
  it("lit une réponse complète, sans se laisser piéger par la ponctuation", () => {
    const d = parseArticle(reply);
    expect(d.missing).toEqual([]);
    expect(d.titles).toEqual([
      "3 questions à poser à ton moulin",
      "Avant d'acheter : trois questions",
      "Ce que je demande en 3 points",
    ]);
    expect(d.intro).toContain('"guillemets" et { accolades }');
    expect(d.parts).toEqual([
      { title: "D'où viennent tes olives", body: "Texte un." },
      { title: "Qui contrôle", body: "Texte deux." },
      { title: "Le lot suivant", body: "Texte trois [À CONFIRMER]." },
    ]);
    expect(d.claims).toEqual(["Acidité sous 0,8 %"]);
    expect(d.coverBrief).toBe("Un moulin, tôt le matin.");
  });

  it("garde les blocs fermés d'une réponse coupée, jamais le dernier", () => {
    const cut = parseArticle(reply.slice(0, reply.indexOf("Texte trois") + 5), true);
    expect(cut.parts).toHaveLength(2);
    expect(cut.outro).toBe("");
    expect(cut.missing).toEqual([
      "la conclusion",
      "le texte de partage",
      "l'idée d'image",
      "les points à valider",
    ]);
    expect(claimsMissing(cut)).toBe(true);
    expect(isUsableDraft(cut)).toBe(true);
    expect(isUsableDraft(parseArticle("désolé, je ne peux pas"))).toBe(false);
  });

  it("finie normalement sans la balise FIN, elle garde son dernier bloc", () => {
    const d = parseArticle(reply.replace("@@FIN@@", "").replace("- Aucune\n", ""));
    expect(d.claims).toEqual(["Acidité sous 0,8 %"]);
    expect(d.missing).toEqual([]);
    // Une liste réellement vide n'est pas une liste manquante.
    const none = parseArticle(reply.replace("- Acidité sous 0,8 %\n", ""));
    expect(none.claims).toEqual([]);
    expect(claimsMissing(none)).toBe(false);
  });

  it("ne mange pas un chiffre au début d'un intertitre ou d'un point", () => {
    const d = parseArticle(
      reply
        .replace("1. D'où viennent tes olives", "0.8 % d'acidité, pas plus")
        .replace("Qui contrôle", "24-48 h pour presser")
        .replace("- Acidité sous 0,8 %", "- 0.8 % d'acidité\n- -18 °C au stockage"),
    );
    expect(d.parts.map((p) => p.title).slice(0, 2)).toEqual([
      "0.8 % d'acidité, pas plus",
      "24-48 h pour presser",
    ]);
    expect(d.claims).toEqual(["0.8 % d'acidité", "-18 °C au stockage"]);
  });

  it("accepte des parties numérotées et des fins de ligne Windows", () => {
    const d = parseArticle(
      reply.replace("@@PARTIE@@ 1.", "@@PARTIE 1@@ 1.").replace(/\n/g, "\r\n"),
    );
    expect(d.parts).toHaveLength(3);
    expect(d.missing).toEqual([]);
  });

  it("le gabarit montré au modèle est lui-même lisible", () => {
    expect(parseArticle(ARTICLE_TEMPLATE).missing).toEqual([]);
  });

  it("lit l'arabe et les balises accentuées ou entourées d'espaces", () => {
    const d = parseArticle(
      reply.replace("@@A-VALIDER@@", "@@ À-VALIDER @@").replace("Texte un.", "نص أول."),
    );
    expect(d.claims).toHaveLength(1);
    expect(d.parts[0].body).toBe("نص أول.");
  });
});

describe("draftParts — numéroté seulement si le titre choisi l'annonce", () => {
  const d = parseArticle(reply);
  it("numérote quand le nombre correspond", () => {
    expect(draftParts(d, d.titles[0]).map((p) => p.role)).toEqual([
      "intro", "item", "item", "item", "outro",
    ]);
  });
  it("ne numérote ni sans annonce, ni quand le nombre est faux", () => {
    for (const t of ["Ce que je demande à un moulin", "5 questions à poser"]) {
      expect(draftParts(d, t).map((p) => p.role)).toEqual([
        "intro", "text", "text", "text", "outro",
      ]);
    }
  });
});

describe("partNumber", () => {
  const parts = [{ role: "intro" }, { role: "item" }, { role: "text" }, { role: "item" }, { role: "outro" }];
  it("n'affiche un numéro que sur les points annoncés d'un article", () => {
    expect(parts.map((_, i) => partNumber("article", parts, i))).toEqual([null, 1, null, 2, null]);
  });
  it("numérote tout ailleurs, et un ancien article sans rôle comme avant", () => {
    expect(partNumber("podcast", [{}, {}], 1)).toBe(2);
    expect(partNumber("article", [{ role: null }, {}], 1)).toBe(2);
    expect(partNumber("article", [{ role: "intro" }, {}], 1)).toBeNull();
  });
  it("donne leur rôle aux parties d'un ancien article, sans toucher aux autres", () => {
    expect(withRoles([{}, { role: null }]).map((p) => p.role)).toEqual(["item", "item"]);
    expect(withRoles([{ role: "intro" }, {}]).map((p) => p.role)).toEqual(["intro", "text"]);
  });
});

describe("orderParts et setNumbering", () => {
  it("l'introduction ouvre, la conclusion ferme", () => {
    const p = [{ role: "outro" }, { role: "text" }, { role: "intro" }, { role: "item" }];
    expect(orderParts(p).map((x) => x.role)).toEqual(["intro", "text", "item", "outro"]);
    expect(setNumbering(orderParts(p), true).map((x) => x.role)).toEqual([
      "intro", "item", "item", "outro",
    ]);
  });
});

describe("le brief", () => {
  it("se préremplit de la fiche auteur, puis de la stratégie, et s'arrête là", () => {
    const b = prefillBrief({
      sheet: { author: "Sonia, moulin de Sfax", contact: "sonia@moulin.tn", position: "supplier" },
      answers: { proof_result: "12 ans d'export", legitimacy: "Labo interne", who_you_are: "ignoré" },
      audience: { name: "Importateurs", who: "acheteurs européens", wants: "x" },
    });
    expect(b.author).toBe("Sonia, moulin de Sfax");
    expect(b.position).toBe("supplier");
    expect(b.proofs).toBe("12 ans d'export\nLabo interne");
    expect(b.reader).toBe("Importateurs — acheteurs européens");
    expect(b.action).toBe("");
    expect(b.words).toBe(700);
  });

  it("le brief déjà écrit de cet article prime", () => {
    const b = prefillBrief({ saved: { reader: "Moi", words: 800 }, sheet: { author: "Autre" } });
    expect(b).toMatchObject({ reader: "Moi", words: 800, author: "" });
  });

  it("compléter un vide enregistre, modifier un acquis seulement si on le demande", () => {
    const sheet = { author: "Sonia" };
    const brief = { ...EMPTY_BRIEF, author: "Sonia B.", contact: "a@b.tn" };
    expect(sheetChanges(sheet, brief)).toEqual({ added: ["contact"], changed: ["author"] });
    expect(mergeSheet(sheet, brief, false)).toEqual({ author: "Sonia", contact: "a@b.tn" });
    expect(mergeSheet(sheet, brief, true)).toEqual({ author: "Sonia B.", contact: "a@b.tn" });
    // Un champ vidé pour CET article ne vide pas la fiche.
    expect(mergeSheet(sheet, EMPTY_BRIEF, true)).toEqual({ author: "Sonia" });
  });

  it("n'accepte que des valeurs connues", () => {
    expect(cleanBrief({ words: 5000, position: "roi", language: "xx", edition: 3 })).toEqual(EMPTY_BRIEF);
    expect(cleanSheet({ position: "roi", author: "  A  ", inconnu: "x" })).toEqual({ author: "A" });
    expect(cleanBrief(null)).toEqual(EMPTY_BRIEF);
    expect(briefSummary({ ...EMPTY_BRIEF, reader: "Importateurs" })).toBe("Importateurs · 700 mots");
  });
});

describe("cleanDraft", () => {
  it("relit un brouillon enregistré, refuse un objet vide", () => {
    const d = parseArticle(reply);
    expect(cleanDraft(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(cleanDraft({})).toBeNull();
    expect(cleanDraft("x")).toBeNull();
  });
});
