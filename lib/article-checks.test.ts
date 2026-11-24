import { describe, expect, it } from "vitest";
import {
  announcedCount,
  checkArticle,
  countToConfirm,
  type ArticleCheckPart,
} from "./article-checks";

const filler = (n: number, seed: string) =>
  Array.from({ length: n }, (_, i) => `${seed}${i}`).join(" ") + ".";

const part = (
  role: ArticleCheckPart["role"],
  title: string,
  body: string,
  id = `${role}-${title}`,
): ArticleCheckPart => ({ id, role, title, body });

/** Un article qui respecte tout. */
const good = () => ({
  title: "3 questions à poser à ton moulin",
  targetWords: 400,
  contact: "sonia@moulin.tn",
  shareText: "J'ai mis dix ans à comprendre ce que mes clients achetaient vraiment. Je raconte. #huile #export",
  parts: [
    part("intro", "", `Je presse mes olives à Sfax. ${filler(60, "i")}`),
    part("item", "D'où viennent tes olives", `${filler(90, "a")} Demande la parcelle.`),
    part("item", "Qui contrôle le jour même", `${filler(90, "b")} Exige un nom.`),
    part("item", "Que devient le lot suivant", `${filler(90, "c")} Compare deux bouteilles.`),
    part("outro", "", "Écris-moi à sonia@moulin.tn pour recevoir un échantillon."),
  ],
});
const codes = (i: Parameters<typeof checkArticle>[0]) => checkArticle(i).map((x) => x.code);

describe("announcedCount — ce que le titre promet", () => {
  it("lit un chiffre ou un nombre écrit, en français et en anglais", () => {
    expect(announcedCount("5 questions à poser")).toBe(5);
    expect(announcedCount("Les trois erreurs du débutant")).toBe(3);
    expect(announcedCount("Seven ways to lose a client")).toBe(7);
    expect(announcedCount("٥ أسئلة قبل ما تشري")).toBe(5);
    expect(announcedCount("خمسة أسئلة")).toBe(5);
  });
  it("ne prend pas une année, un prix ou une durée pour une liste", () => {
    for (const t of [
      "Ce qui change en 2027",
      "Vendre 20% plus cher",
      "J'ai perdu 10 ans",
      "Before you buy Tunisian olive oil: the questions to ask the mill",
      "Un client de perdu",
      "J'ai perdu dix ans",
      "Un appartement neuf à Sfax",
      "Livrer en 10 jours",
    ]) {
      expect(announcedCount(t), t).toBeNull();
    }
  });
});

describe("checkArticle", () => {
  it("ne dit rien d'un article conforme, ni d'un article vide", () => {
    expect(codes(good())).toEqual([]);
    expect(codes({ ...good(), parts: [] })).toEqual([]);
  });

  it("signale l'introduction et la conclusion absentes ou titrées", () => {
    const g = good();
    expect(codes({ ...g, parts: g.parts.slice(1, 4) })).toEqual(
      expect.arrayContaining(["no_intro", "no_outro"]),
    );
    g.parts[0].title = "Introduction";
    expect(codes(g)).toContain("intro_heading");
  });

  it("signale un intertitre de plus de 8 mots, et mène à la partie", () => {
    const g = good();
    g.parts[1].title = "Why the questions you ask the mill matter more than the sample";
    const issue = checkArticle(g).find((i) => i.code === "heading_long");
    expect(issue?.partId).toBe(g.parts[1].id);
  });

  it("numérote seulement ce que le titre annonce, et le bon nombre", () => {
    const g = good();
    const plain = g.parts.map((p) => (p.role === "item" ? { ...p, role: "text" as const } : p));
    expect(codes({ ...g, parts: plain })).toContain("numbering_missing");
    expect(codes({ ...g, title: "5 questions à poser" })).toContain("numbering_mismatch");
    expect(codes({ ...g, title: "Ce que je demande à un moulin" })).toContain(
      "numbering_unannounced",
    );
    expect(codes({ ...g, title: "Ce que je demande", parts: plain })).toEqual([]);
  });

  it("signale la longueur hors cible et le contact oublié", () => {
    const g = good();
    expect(codes({ ...g, targetWords: 700 })).toContain("length");
    expect(codes({ ...g, targetWords: 200 })).toContain("length");
    g.parts[4].body = "Réfléchis-y.";
    expect(codes(g)).toContain("outro_contact");
    // L'adresse suffit, quelle que soit la phrase ; un téléphone se lit espacé.
    const reach = (contact: string, body: string) => {
      const h = good();
      h.parts[4].body = body;
      return codes({ ...h, contact }).includes("outro_contact");
    };
    expect(reach("par mail : Sonia@Moulin.tn", "Écris à sonia@moulin.tn.")).toBe(false);
    expect(reach("+216 20 123 456", "Appelle le 20123456.")).toBe(false);
    expect(reach("message LinkedIn", "Envoie-moi un message.")).toBe(false);
    expect(reach("sonia@moulin.tn", "Écris-moi un mail.")).toBe(true);
  });

  it("signale la même formule de fin et une phrase répétée", () => {
    const g = good();
    g.parts[1].body = `${filler(90, "a")} Une bonne réponse nomme une personne.`;
    g.parts[2].body = `${filler(90, "b")} Une bonne réponse donne une date.`;
    expect(codes(g)).toContain("same_ending");
    const h = good();
    const twice = "Le même client revient toujours pour la même huile chaque année.";
    h.parts[1].body += ` ${twice} Fin une.`;
    h.parts[3].body += ` ${twice} Autre fin.`;
    expect(codes(h)).toContain("repeated_sentence");
  });

  it("compte ce qui reste à confirmer, dans toutes ses écritures", () => {
    expect(countToConfirm("a [À CONFIRMER] b [à confirmer : le pH] c [TO CONFIRM]")).toBe(3);
    expect(
      countToConfirm("[À CONFIRMER - délai] [À CONFIRMER le prix] [À CONFIRMER, x] [À CONFIRMER (prix)]"),
    ).toBe(4);
    expect(countToConfirm("[A\u0300 CONFIRMER]")).toBe(1);
    expect(countToConfirm("[à confirmerait] (à confirmer) à confirmer")).toBe(0);
    const g = good();
    g.parts[2].body += " Acidité : [À CONFIRMER].";
    expect(checkArticle(g)[0]).toMatchObject({ code: "to_confirm", partId: g.parts[2].id });
  });

  it("contrôle le texte de partage", () => {
    const g = good();
    g.parts[1].body = `Un échantillon ne te dit rien du lot suivant. ${filler(90, "a")} Demande.`;
    const share = (s: string) => codes({ ...g, shareText: s });
    expect(share("Un échantillon ne te dit rien du lot suivant !")).toContain("share_copied");
    expect(share("À lire. #a #b #c #d")).toContain("share_hashtags");
    expect(share("À lire 👇")).toContain("share_emoji");
    expect(share("La checklist est dans l'article.")).toContain("share_promise");
    expect(share("Un modèle à télécharger t'attend.")).toContain("share_promise");
    expect(share("Acidité [À CONFIRMER].")).toContain("to_confirm");
    expect(share("")).toEqual([]);
  });

  it("repère « je » dans l'article et « nous » dans le partage", () => {
    const g = good();
    g.parts[0].body = `Je presse mes olives. Je livre mes clients. ${filler(60, "i")}`;
    expect(codes({ ...g, shareText: "Nous avons écrit notre guide." })).toContain("share_voice");
    expect(codes({ ...g, shareText: "J'ai écrit ma méthode." })).not.toContain("share_voice");
  });
});
