import { describe, expect, it } from "vitest";
import { parseSeries, spreadDates } from "./series-import";

describe("parseSeries", () => {
  it("prend la ligne numérotée comme titre et la suite comme script", () => {
    const items = parseSeries(
      [
        "1. لازم نهبط كل يوم باش نولي visible؟",
        "Idée centrale : la répétition d'un message clair.",
        "Conclusion : le but n'est pas d'être vue tous les jours.",
        "2. نركّز على qualité وإلا quantité؟",
        "Idée centrale : assez de quantité pour apprendre.",
      ].join("\n"),
    );

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("لازم نهبط كل يوم باش نولي visible؟");
    expect(items[0].script).toContain("Idée centrale");
    expect(items[0].script).toContain("Conclusion");
    expect(items[0].script).not.toContain("qualité");
    expect(items[1].number).toBe(2);
  });

  it("ignore ce qui précède le premier sujet", () => {
    const items = parseSeries("Mes sujets du mois\n\n1. Premier\ncorps");
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Premier");
  });

  it("ne coupe PAS sur une liste numérotée imbriquée", () => {
    // Le piège : « 1. » et « 2. » à l'intérieur du sujet 7 ne sont pas des
    // sujets. La numérotation continue les rejette (on attend 8).
    const items = parseSeries(
      [
        "7. Mon sujet",
        "Trois questions à se poser :",
        "1. À qui je parle ?",
        "2. Quel problème je traite ?",
        "8. Sujet suivant",
        "corps",
      ].join("\n"),
    );

    expect(items).toHaveLength(2);
    expect(items[0].script).toContain("À qui je parle");
    expect(items[0].script).toContain("Quel problème");
    expect(items[1].title).toBe("Sujet suivant");
  });

  it("rejette une renumérotation en fin de document", () => {
    // Le récapitulatif « les 8 que je tournerais en premier » repart à 1 :
    // ce ne sont pas de nouveaux sujets.
    const items = parseSeries(
      ["1. Un", "corps", "2. Deux", "corps", "1. Un (rappel)"].join("\n"),
    );
    expect(items).toHaveLength(2);
  });

  it("retire les intertitres de section du script", () => {
    const items = parseSeries(
      ["1. Un", "corps", "Batch 2 — Personal Branding", "2. Deux", "x"].join(
        "\n",
      ),
    );
    expect(items[0].script).toBe("corps");
  });

  it("accepte la parenthèse comme séparateur", () => {
    expect(parseSeries("1) Un\ncorps")[0].title).toBe("Un");
  });

  it("renvoie une liste vide sur un texte sans numéro", () => {
    expect(parseSeries("juste du texte\nsans numéro")).toEqual([]);
  });

  it("tolère un sujet sans corps", () => {
    const items = parseSeries("1. Titre seul\n2. Autre\ncorps");
    expect(items[0].script).toBe("");
    expect(items).toHaveLength(2);
  });
});

describe("spreadDates", () => {
  it("tient la cadence sur la durée, sans dériver", () => {
    const d = spreadDates("2026-09-21", 7, 3);
    expect(d[0]).toBe("2026-09-21");
    // 7 contenus à 3/semaine = 2 semaines pile, pas plus.
    expect(d[6]).toBe("2026-10-05");
  });

  it("gère une publication par semaine", () => {
    const d = spreadDates("2026-09-21", 3, 1);
    expect(d).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
  });

  it("gère le quotidien", () => {
    const d = spreadDates("2026-09-21", 3, 7);
    expect(d).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
  });

  it("renvoie une liste vide sur une date invalide", () => {
    expect(spreadDates("pas-une-date", 3, 3)).toEqual([]);
  });
});
