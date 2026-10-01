import { describe, expect, it } from "vitest";
import { daysInMonth, isIsoDate, monthGrid, moveByKey, shiftMonth } from "../calendar";

describe("grille d'un mois", () => {
  it("rend toujours 42 cases", () => {
    // Hauteur constante : sinon le bouton « mois suivant » se deplace sous le
    // curseur d'un mois a l'autre, et on clique deux fois sans le vouloir.
    for (const iso of ["2026-02-01", "2026-08-15", "2027-03-31"]) {
      expect(monthGrid(iso)).toHaveLength(42);
    }
  });

  it("COMMENCE UN LUNDI, quel que soit le mois", () => {
    // Octobre 2026 ouvre un jeudi : la grille doit donc remonter au 28/09.
    expect(monthGrid("2026-10-07")[0].iso).toBe("2026-09-28");
    expect(monthGrid("2026-02-10")[0].iso).toBe("2026-01-26");
  });

  it("marque les jours de debord", () => {
    const grid = monthGrid("2026-10-07");
    expect(grid[0]).toEqual({ iso: "2026-09-28", day: 28, inMonth: false });
    expect(grid.filter((d) => d.inMonth)).toHaveLength(31);
  });

  it("couvre le mois entier meme quand il commence un lundi", () => {
    // Juin 2026 commence un lundi : sans les six semaines, la derniere
    // semaine de debord manquerait.
    const grid = monthGrid("2026-06-01");
    expect(grid[0].iso).toBe("2026-06-01");
    expect(grid[41].iso).toBe("2026-07-12");
  });
});

describe("changement de mois", () => {
  it("avance d'un mois", () => {
    expect(shiftMonth("2026-10-07", 1)).toBe("2026-11-07");
  });

  it("PLAFONNE au dernier jour du mois vise", () => {
    // Le 31 janvier + 1 mois n'est pas le 3 mars : sans plafond, la grille
    // saute un mois entier sous les doigts.
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftMonth("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("franchit l'annee dans les deux sens", () => {
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-15");
    expect(shiftMonth("2026-01-15", -1)).toBe("2025-12-15");
  });
});

describe("longueur des mois", () => {
  it("connait fevrier, bissextile ou non", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
  });

  it("connait decembre", () => {
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});

describe("deplacement au clavier", () => {
  it("jour et semaine", () => {
    expect(moveByKey("2026-10-07", "ArrowRight")).toBe("2026-10-08");
    expect(moveByKey("2026-10-07", "ArrowUp")).toBe("2026-09-30");
  });

  it("Origine va au LUNDI de la semaine, Fin au dimanche", () => {
    expect(moveByKey("2026-10-07", "Home")).toBe("2026-10-05");
    expect(moveByKey("2026-10-07", "End")).toBe("2026-10-11");
  });

  it("Page precedente et suivante changent de mois", () => {
    expect(moveByKey("2026-10-07", "PageUp")).toBe("2026-09-07");
    expect(moveByKey("2026-10-07", "PageDown")).toBe("2026-11-07");
  });

  it("rend null sur une touche qui ne navigue pas", () => {
    expect(moveByKey("2026-10-07", "a")).toBeNull();
  });
});

describe("validation d'une date saisie", () => {
  it("accepte une date reelle", () => {
    expect(isIsoDate("2026-10-07")).toBe(true);
  });

  it("REFUSE le 30 fevrier", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("refuse un mois hors bornes et un format approchant", () => {
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-1-1")).toBe(false);
    expect(isIsoDate("07/10/2026")).toBe(false);
  });
});
