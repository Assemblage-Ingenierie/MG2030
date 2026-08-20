import { describe, expect, it } from "vitest";
import { filterKeepingAncestors } from "@/lib/schedule/tree";

/** Reproduit la forme réelle du plan MG2030 : TV.2 récapitulatif, TV.3 intertitre. */
const PLAN = [
  { id: "tv1", parentId: null, wbs: "TV.1", contract: null },
  { id: "tv2", parentId: null, wbs: "TV.2", contract: "C-TV-DD" },
  { id: "tv21", parentId: "tv2", wbs: "TV.2.1", contract: "C-TV-DD" },
  { id: "tv27", parentId: "tv2", wbs: "TV.2.7", contract: "C-TV-DD" },
  { id: "tv3", parentId: null, wbs: "TV.3", contract: null },
  { id: "tv31", parentId: "tv3", wbs: "TV.3.1", contract: "W-TV" },
  { id: "tv311", parentId: "tv31", wbs: "TV.3.1.1", contract: "W-TV" },
  { id: "sc1", parentId: null, wbs: "SC.1", contract: null },
];

const codes = (rows: { wbs: string }[]) => rows.map((r) => r.wbs);

describe("filterKeepingAncestors", () => {
  it("remonte l'intertitre TV.3, qui ne porte aucun marché", () => {
    const kept = filterKeepingAncestors(PLAN, (t) => t.contract === "W-TV");
    // TV.3 est retenu bien qu'il ne satisfasse PAS le prédicat : sans lui,
    // TV.3.1.1 s'afficherait indenté sous rien.
    expect(codes(kept)).toEqual(["TV.3", "TV.3.1", "TV.3.1.1"]);
  });

  it("remonte deux niveaux d'un coup", () => {
    const kept = filterKeepingAncestors(PLAN, (t) => t.wbs === "TV.3.1.1");
    expect(codes(kept)).toEqual(["TV.3", "TV.3.1", "TV.3.1.1"]);
  });

  it("préserve l'ordre d'origine, pas l'ordre de découverte", () => {
    const kept = filterKeepingAncestors(PLAN, (t) => t.wbs === "SC.1" || t.wbs === "TV.2.7");
    expect(codes(kept)).toEqual(["TV.2", "TV.2.7", "SC.1"]);
  });

  it("ne duplique pas un ascendant partagé par deux enfants retenus", () => {
    const kept = filterKeepingAncestors(PLAN, (t) => t.parentId === "tv2");
    expect(codes(kept)).toEqual(["TV.2", "TV.2.1", "TV.2.7"]);
  });

  it("ne retient rien quand rien ne correspond", () => {
    expect(filterKeepingAncestors(PLAN, () => false)).toEqual([]);
  });

  it("rend tout quand tout correspond", () => {
    expect(filterKeepingAncestors(PLAN, () => true)).toHaveLength(PLAN.length);
  });

  it("ne boucle pas sur un cycle parent/enfant introduit en base", () => {
    const cyclic = [
      { id: "a", parentId: "b", wbs: "A" },
      { id: "b", parentId: "a", wbs: "B" },
    ];
    // Le contrat est de RENDRE, pas de boucher : la garde tronque la remontée.
    expect(codes(filterKeepingAncestors(cyclic, (t) => t.wbs === "A"))).toEqual(["A", "B"]);
  });

  it("ignore un parent absent de la liste sans lever", () => {
    const orphan = [{ id: "x", parentId: "disparu", wbs: "X" }];
    expect(codes(filterKeepingAncestors(orphan, () => true))).toEqual(["X"]);
  });
});
