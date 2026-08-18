import { describe, it, expect } from "vitest";
import { isLightSource, checkLighting } from "./filming-rules";
import type { EquipmentPlacement } from "./types";

const at = (
  label: string,
  position: EquipmentPlacement["position"],
): EquipmentPlacement => ({ label, position, note: "" });

describe("isLightSource — détection d'une source de lumière", () => {
  it("reconnaît la lumière naturelle, accents et casse compris", () => {
    expect(isLightSource("fenêtre en arrière plan")).toBe(true);
    expect(isLightSource("FENETRE")).toBe(true);
    expect(isLightSource("Grande baie vitrée")).toBe(true);
    expect(isLightSource("window behind me")).toBe(true);
  });

  it("reconnaît les sources artificielles", () => {
    expect(isLightSource("anneau lumineux LED")).toBe(true);
    expect(isLightSource("Softbox 60x60")).toBe(true);
    expect(isLightSource("petite lampe de bureau")).toBe(true);
    expect(isLightSource("panneau LED")).toBe(true);
  });

  it("reconnaît l'arabe", () => {
    expect(isLightSource("نافذة")).toBe(true);
    expect(isLightSource("إضاءة LED")).toBe(true);
  });

  it("ne confond pas le matériel non lumineux", () => {
    expect(isLightSource("trépied")).toBe(false);
    expect(isLightSource("micro-cravate")).toBe(false);
    expect(isLightSource("fond blanc")).toBe(false);
    expect(isLightSource("iPhone 14")).toBe(false);
  });
});

describe("checkLighting — au moins une lumière doit être devant", () => {
  it("signale le cas réel qui a motivé la règle : fenêtre dans le dos", () => {
    const issue = checkLighting([at("fenetre en arriere plan", "arriere")]);
    expect(issue).not.toBeNull();
    expect(issue?.kind).toBe("backlit_only_light");
    expect(issue?.lights).toEqual(["fenetre en arriere plan"]);
  });

  it("accepte une fenêtre à 45° devant (placement recommandé)", () => {
    expect(checkLighting([at("fenêtre", "avant_gauche")])).toBeNull();
    expect(checkLighting([at("fenêtre", "avant_droite")])).toBeNull();
    expect(checkLighting([at("fenêtre", "face")])).toBeNull();
  });

  it("accepte un contre-jour d'accentuation SI une lumière est devant", () => {
    const issue = checkLighting([
      at("anneau lumineux", "avant_droite"),
      at("LED bleue", "arriere"),
    ]);
    expect(issue).toBeNull();
  });

  it("signale quand toutes les lumières sont sur les côtés ou derrière", () => {
    const issue = checkLighting([
      at("softbox", "gauche"),
      at("LED", "arriere_droite"),
    ]);
    expect(issue).not.toBeNull();
    expect(issue?.kind).toBe("no_front_light");
  });

  it("ne dit rien quand aucun matériel n'est une lumière", () => {
    expect(
      checkLighting([at("trépied", "arriere"), at("micro", "gauche")]),
    ).toBeNull();
  });

  it("ne dit rien sur une liste vide", () => {
    expect(checkLighting([])).toBeNull();
  });
});
