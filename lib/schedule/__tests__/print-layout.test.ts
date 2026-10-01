import { describe, expect, it } from "vitest";
import { ROW_H } from "@/lib/gantt/layout";
import { fitPxPerDay, fitScale, isPaper, paginate, printGeometry } from "../print-layout";

describe("geometrie du papier", () => {
  it("le A3 offre plus de largeur ET plus de lignes que le A4", () => {
    const a4 = printGeometry("a4");
    const a3 = printGeometry("a3");
    expect(a3.chartWidth).toBeGreaterThan(a4.chartWidth);
    expect(a3.rowsPerSheet).toBeGreaterThan(a4.rowsPerSheet);
  });

  it("laisse toujours de la place au diagramme", () => {
    for (const paper of ["a4", "a3"] as const) {
      const g = printGeometry(paper);
      expect(g.chartWidth).toBeGreaterThan(400);
      expect(g.nameWidth + g.chartWidth).toBeLessThanOrEqual(g.pageWidth);
    }
  });

  it("les lignes d'une feuille tiennent dans sa hauteur", () => {
    for (const paper of ["a4", "a3"] as const) {
      const g = printGeometry(paper);
      expect(g.rowsPerSheet * ROW_H).toBeLessThan(g.pageHeight);
    }
  });

  it("ecarte un format inconnu", () => {
    expect(isPaper("a4")).toBe(true);
    expect(isPaper("letter")).toBe(false);
  });
});

describe("pagination", () => {
  it("decoupe en feuilles pleines puis un reste", () => {
    expect(paginate(50, 20)).toEqual([
      { from: 0, count: 20 },
      { from: 20, count: 20 },
      { from: 40, count: 10 },
    ]);
  });

  it("une seule feuille quand tout tient", () => {
    expect(paginate(5, 20)).toEqual([{ from: 0, count: 5 }]);
  });

  it("aucune feuille pour un plan vide", () => {
    expect(paginate(0, 20)).toEqual([]);
  });

  it("NE BOUCLE PAS si la feuille ne tient aucune ligne", () => {
    // `printGeometry` plancherait a 1, mais la fonction doit se defendre seule :
    // une boucle infinie ici bloquerait le rendu du serveur.
    expect(paginate(3, 0).length).toBe(0);
  });

  it("tombe juste quand le compte est un multiple exact", () => {
    expect(paginate(40, 20)).toEqual([
      { from: 0, count: 20 },
      { from: 20, count: 20 },
    ]);
  });
});

describe("densite qui tient dans la feuille", () => {
  it("resserre un plan trop large", () => {
    // 3000 px a 4 px/jour, pour 1000 px de feuille : un tiers de la densite.
    expect(fitPxPerDay(3000, 4, 1000)).toBeCloseTo(4 / 3);
  });

  it("NE DILATE PAS un plan court", () => {
    // Trois taches sur deux semaines etalees sur quarante centimetres se
    // lisent moins bien, pas mieux.
    expect(fitPxPerDay(300, 4, 1000)).toBe(4);
  });

  it("laisse la densite inchangee sur une largeur nulle", () => {
    expect(fitPxPerDay(0, 4, 1000)).toBe(4);
  });
});

describe("echelle imprimable", () => {
  it("garde l'echelle demandee quand elle tient", () => {
    // Un mois a 1 px/jour fait 30 px : au-dessus du seuil.
    expect(fitScale("month", 1)).toBe("month");
  });

  it("ELARGIT quand les libelles ne tiendraient pas", () => {
    // 0,69 px/jour : un mois fait 21 px, l'axe s'imprimerait muet.
    expect(fitScale("month", 0.69)).toBe("quarter");
  });

  it("ne RAFFINE jamais : qui demande des trimestres les garde", () => {
    expect(fitScale("quarter", 4)).toBe("quarter");
  });

  it("retombe sur le trimestre quand meme lui est trop serre", () => {
    expect(fitScale("day", 0.05)).toBe("quarter");
  });

  it("passe du jour a la semaine avant le mois", () => {
    expect(fitScale("day", 4)).toBe("week");
  });
});
