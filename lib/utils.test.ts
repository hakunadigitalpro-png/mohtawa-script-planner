import { describe, it, expect } from "vitest";
import { pick, safeNext, extractJsonBlock } from "./utils";

describe("pick — liste blanche anti mass-assignment", () => {
  it("ne garde que les clés autorisées", () => {
    const out = pick({ a: 1, b: 2, c: 3 } as Record<string, number>, [
      "a",
      "c",
    ]);
    expect(out).toEqual({ a: 1, c: 3 });
  });

  it("ignore les colonnes injectées hors liste (brand_id, share_token…)", () => {
    const malicious = {
      title: "ok",
      brand_id: "autre-marque",
      share_token: "forge",
      user_id: "someone",
    } as Record<string, string>;
    const out = pick(malicious, ["title"]);
    expect(out).toEqual({ title: "ok" });
    expect("brand_id" in out).toBe(false);
    expect("share_token" in out).toBe(false);
  });

  it("ignore undefined mais conserve null", () => {
    const out = pick(
      { a: undefined, b: null } as Record<string, unknown>,
      ["a", "b"],
    );
    expect(out).toEqual({ b: null });
  });
});

describe("safeNext — garde anti open-redirect", () => {
  it("laisse passer un chemin interne valide", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/content/123")).toBe("/content/123");
  });

  it("bloque les URLs externes et protocol-relatives", () => {
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("http://evil.com")).toBe("/dashboard");
  });

  it("retombe sur /dashboard pour un non-chemin ou non-string", () => {
    expect(safeNext(undefined)).toBe("/dashboard");
    expect(safeNext(123)).toBe("/dashboard");
    expect(safeNext("dashboard")).toBe("/dashboard");
    expect(safeNext(null)).toBe("/dashboard");
  });
});

describe("extractJsonBlock — parsing tolérant des réponses IA", () => {
  it("extrait le JSON d'un bloc ```json … ```", () => {
    const raw = 'Voici ta réponse :\n```json\n{"a":1,"b":"x"}\n```\nvoilà !';
    expect(JSON.parse(extractJsonBlock(raw))).toEqual({ a: 1, b: "x" });
  });

  it("extrait du premier { au dernier } quand il y a du texte autour", () => {
    const raw = 'blabla {"a":1,"b":[1,2]} fin de message';
    expect(JSON.parse(extractJsonBlock(raw))).toEqual({ a: 1, b: [1, 2] });
  });

  it("gère un JSON déjà propre", () => {
    expect(JSON.parse(extractJsonBlock('{"x":true}'))).toEqual({ x: true });
  });

  it("gère un fence ``` sans le mot json", () => {
    const raw = "```\n{\"ok\":1}\n```";
    expect(JSON.parse(extractJsonBlock(raw))).toEqual({ ok: 1 });
  });
});
