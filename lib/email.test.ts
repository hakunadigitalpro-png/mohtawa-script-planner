import { describe, expect, it } from "vitest";
import { safeDisplayName } from "./email";

/**
 * Le nom de la marque est saisi librement par l'utilisatrice et finit dans
 * un en-tête SMTP `From`. Un retour à la ligne y suffirait à ajouter un
 * en-tête de son choix — un Bcc, par exemple. D'où ces tests.
 */
describe("safeDisplayName", () => {
  it("laisse un nom normal intact", () => {
    expect(safeDisplayName("Adala")).toBe("Adala");
  });

  it("garde les accents et les espaces internes", () => {
    expect(safeDisplayName("Café des Délices")).toBe("Café des Délices");
  });

  it("neutralise un retour à la ligne (injection d'en-tête)", () => {
    const attack = "Adala\r\nBcc: voleur@exemple.com";
    const out = safeDisplayName(attack);
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
    expect(out).toBe("Adala Bcc: voleur@exemple.com");
  });

  it("neutralise les chevrons qui fermeraient l'adresse", () => {
    expect(safeDisplayName('Adala <autre@exemple.com>')).toBe(
      "Adala autre@exemple.com",
    );
  });

  it("neutralise les guillemets qui fermeraient le nom cité", () => {
    expect(safeDisplayName('Adala" <x@y.z> "')).toBe("Adala x@y.z");
  });

  it("neutralise l'antislash d'échappement", () => {
    expect(safeDisplayName("Ada\\la")).toBe("Ada la");
  });

  it("réduit les espaces multiples et coupe aux bords", () => {
    expect(safeDisplayName("  Adala    Médiation  ")).toBe("Adala Médiation");
  });

  it("plafonne la longueur", () => {
    expect(safeDisplayName("A".repeat(200))).toHaveLength(60);
  });

  it("renvoie une chaîne vide si tout a été retiré", () => {
    expect(safeDisplayName('<>"\\')).toBe("");
  });
});
