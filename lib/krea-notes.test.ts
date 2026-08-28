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

  it("signale le stock prêt mais jamais publié", () => {
    const note = dashboardNote({ ...base, total: 7, published: 0 });
    expect(note?.text).toMatch(/aucun publié/i);
    expect(note?.tone).toBe("push");
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
