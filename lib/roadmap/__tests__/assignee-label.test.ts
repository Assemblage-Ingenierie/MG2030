import { describe, expect, it } from "vitest";
import { hasAmbiguousFirstNames, shortAssignee } from "../assignee-label";

describe("prenom seul", () => {
  it("coupe a la PREMIERE espace", () => {
    // Comme la separation prenom / nom de la migration 0036 : au-dela de
    // « Prenom Nom », c'est le nom qui se compose.
    expect(shortAssignee("kushtrim krasniqi")).toBe("kushtrim");
    expect(shortAssignee("Maria Da Silva")).toBe("Maria");
  });

  it("NE TOUCHE PAS a une entite", () => {
    // « Ministry of Finance » ne doit pas devenir « Ministry ».
    for (const entity of ["AFD", "TA", "PIU", "G8", "MoF"]) {
      expect(shortAssignee(entity)).toBe(entity);
    }
  });

  it("laisse intact un libelle d'un seul mot", () => {
    expect(shortAssignee("Alban")).toBe("Alban");
  });

  it("supporte le vide et les espaces", () => {
    expect(shortAssignee("   ")).toBe("");
  });
});

describe("homonymie", () => {
  it("detecte deux prenoms identiques", () => {
    // Deux « Arben » reduits a « Arben » ne designent plus rien.
    expect(hasAmbiguousFirstNames(["Arben Krasniqi", "Arben Hoxha"])).toBe(true);
  });

  it("ignore la casse", () => {
    expect(hasAmbiguousFirstNames(["arben Krasniqi", "Arben Hoxha"])).toBe(true);
  });

  it("ne confond pas un doublon avec une homonymie", () => {
    // Le meme libelle deux fois, c'est la meme personne : rien a desambiguer.
    expect(hasAmbiguousFirstNames(["Arben Krasniqi", "Arben Krasniqi"])).toBe(false);
  });

  it("rend faux sur une liste distincte", () => {
    expect(hasAmbiguousFirstNames(["kushtrim krasniqi", "Sami Isufi", "AFD"])).toBe(false);
  });
});
