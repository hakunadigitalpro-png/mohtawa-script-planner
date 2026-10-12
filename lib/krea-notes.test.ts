import { describe, expect, it } from "vitest";
import { analyticsNote, dashboardNote } from "./krea-notes";

describe("dashboardNote", () => {
  const base = { total: 5, published: 2, thisMonth: 5, goal: 12 };

  it("ne parle pas d'objectif à qui n'a rien créé", () => {
    const note = dashboardNote({ ...base, total: 0, published: 0, thisMonth: 0 });
    expect(note?.tone).toBe("info");
    expect(note?.text).not.toMatch(/objectif/i);
  });

  it("fête les caps ronds", () => {
    for (const total of [10, 25, 50, 100]) {
      const note = dashboardNote({ ...base, total });
      expect(note?.tone).toBe("win");
      expect(note?.text).toContain(String(total));
    }
  });

  it("ne fête pas un nombre qui n'est pas un cap", () => {
    expect(dashboardNote({ ...base, total: 11 })?.tone).not.toBe("win");
  });

  it("signale le stock créé mais jamais en ligne, sans le dire « prêt »", () => {
    const note = dashboardNote({ ...base, total: 7, published: 0 });
    expect(note?.text).toMatch(/aucun en ligne/i);
    expect(note?.text).not.toMatch(/prêt/i);
    expect(note?.tone).toBe("push");
  });

  it("nomme le retard, avec le geste de sortie et un lien", () => {
    const note = dashboardNote({ ...base, late: 2 });
    expect(note?.tone).toBe("push");
    expect(note?.text).toMatch(/2 contenus ont dépassé leur date/);
    expect(note?.text).toMatch(/nouvelle date/);
    expect(note?.action?.href).toBe("/dashboard?late=1");
    expect(note?.action?.label).toBe("Les voir");
  });

  it("accorde le retard au singulier", () => {
    const note = dashboardNote({ ...base, late: 1 });
    expect(note?.text).toMatch(/^1 contenu a dépassé sa date/);
    expect(note?.action?.label).toBe("Le voir");
  });

  it("fête le cap avant de parler de retard, mais parle du retard avant la relance générique", () => {
    expect(dashboardNote({ ...base, total: 10, late: 1 })?.tone).toBe("win");
    const note = dashboardNote({ ...base, total: 7, published: 0, late: 1 });
    expect(note?.text).toMatch(/dépassé sa date/);
  });

  it("ne parle pas de retard quand il n'y en a pas", () => {
    expect(dashboardNote({ ...base, late: 0 })?.text).not.toMatch(/dépassé/);
    expect(dashboardNote({ ...base })?.action).toBeUndefined();
  });

  it("confirme quand l'objectif du mois est atteint", () => {
    const note = dashboardNote({ ...base, thisMonth: 12, goal: 12 });
    expect(note?.tone).toBe("win");
    expect(note?.text).toMatch(/objectif/i);
  });

  it("dit combien il en manque, sans jamais annoncer un reste négatif", () => {
    const note = dashboardNote({ ...base, thisMonth: 9, goal: 12 });
    expect(note?.text).toContain("3");
    expect(note?.tone).toBe("push");
  });

  it("relance quand le mois est vide", () => {
    const note = dashboardNote({ ...base, thisMonth: 0 });
    expect(note?.tone).toBe("push");
  });

  it("accorde « un » au singulier quand il n'en manque qu'un", () => {
    const note = dashboardNote({ ...base, thisMonth: 11, goal: 12 });
    expect(note?.text).toMatch(/préparer un maintenant/);
  });
});

describe("analyticsNote", () => {
  it("n'invente pas de conseil sans publication", () => {
    const note = analyticsNote({ topTheme: null, measured: 0, published: 0 });
    expect(note?.tone).toBe("info");
  });

  it("réclame les chiffres avant de conseiller", () => {
    const note = analyticsNote({ topTheme: null, measured: 0, published: 4 });
    expect(note?.text).toMatch(/aucun résultat saisi/i);
  });

  it("attend d'avoir de quoi comparer", () => {
    const note = analyticsNote({
      topTheme: { name: "Coulisses", views: 900 },
      measured: 2,
      published: 4,
    });
    expect(note?.text).toMatch(/comparer/i);
  });

  it("désigne le thème gagnant et propose de le refaire", () => {
    const note = analyticsNote({
      topTheme: { name: "Coulisses", views: 900 },
      measured: 5,
      published: 6,
    });
    expect(note?.text).toContain("Coulisses");
    expect(note?.tone).toBe("win");
  });
});
