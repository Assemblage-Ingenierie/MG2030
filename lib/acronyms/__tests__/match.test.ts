import { describe, expect, it } from "vitest";
import { hasAcronym, splitAcronyms, type Acronym } from "../match";

/** Un extrait du glossaire réel : ce sont ses cas limites qui comptent. */
const GLOSSARY: Acronym[] = [
  { code: "AFD", meaning: "Agence Francaise de Developpement" },
  { code: "TA", meaning: "Technical Assistance to the MSY" },
  { code: "MSY", meaning: "Ministry of Sports and Youth" },
  { code: "NOC", meaning: "No Objection Certificate issued by AFD" },
  { code: "REoI", meaning: "Request for Expressions of Interest" },
  { code: "MoU", meaning: "Memorandum of understanding" },
  { code: "ESMP", meaning: "Environmental and Social Management Plan" },
  { code: "C-ESMP", meaning: "Contractor Environmental and Social Management Plan" },
  { code: "ESIA", meaning: "Environmental and Social Impact Assessment" },
  { code: "PESIA", meaning: "Preliminary Environmental and Social Impact Assessment" },
  { code: "E&S", meaning: "Environmental and social" },
];

const marked = (text: string) =>
  splitAcronyms(text, GLOSSARY)
    .filter((s) => "meaning" in s)
    .map((s) => s.text);

describe("splitAcronyms", () => {
  it("rend le texte intact quand il ne porte aucun sigle", () => {
    expect(splitAcronyms("Review the drawings", GLOSSARY)).toEqual([
      { text: "Review the drawings" },
    ]);
  });

  it("découpe autour des sigles trouvés", () => {
    expect(splitAcronyms("AFD's NOC", GLOSSARY)).toEqual([
      { text: "AFD", meaning: GLOSSARY[0].meaning },
      { text: "'s " },
      { text: "NOC", meaning: GLOSSARY[3].meaning },
    ]);
  });

  it("recolle le texte à l'identique", () => {
    const source = "TA + MSY report on the C-ESMP, sent to AFD";
    expect(
      splitAcronyms(source, GLOSSARY)
        .map((s) => s.text)
        .join(""),
    ).toBe(source);
  });

  // ── La règle de casse ────────────────────────────────────────────────────
  it("accepte une variante TOUT EN CAPITALES du sigle", () => {
    // Le plan de charge écrit « REOI drafting », le glossaire « REoI ».
    expect(marked("REOI drafting")).toEqual(["REOI"]);
    expect(marked("REoI drafting")).toEqual(["REoI"]);
  });

  it("refuse une casse arbitraire", () => {
    expect(marked("Mou signed")).toEqual([]);
    expect(marked("the total was")).toEqual([]);
    expect(marked("Afd review")).toEqual([]);
  });

  it("ne s'allume pas au milieu d'un mot", () => {
    expect(marked("TASK")).toEqual([]);
    expect(marked("NOTA BENE")).toEqual([]);
    // Accentuée : `\w` ne l'aurait pas vue, et « TAché » aurait allumé « TA ».
    expect(marked("TAché")).toEqual([]);
  });

  // ── Le plus long d'abord ─────────────────────────────────────────────────
  it("préfère le sigle le plus long", () => {
    // Sans cette règle, le tiret serait une borne de mot et `ESMP` gagnerait.
    expect(marked("C-ESMP approved")).toEqual(["C-ESMP"]);
    expect(marked("PESIA then ESIA")).toEqual(["PESIA", "ESIA"]);
  });

  it("gère un sigle à ponctuation interne", () => {
    expect(marked("E&S safeguards")).toEqual(["E&S"]);
  });

  it("consomme le sigle trouvé", () => {
    // `MSY` ne doit pas être réexaminé lettre par lettre après coup.
    const segments = splitAcronyms("MSY", GLOSSARY);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toEqual({ text: "MSY", meaning: GLOSSARY[2].meaning });
  });

  it("supporte un glossaire vide et un texte vide", () => {
    expect(splitAcronyms("AFD", [])).toEqual([{ text: "AFD" }]);
    expect(splitAcronyms("", GLOSSARY)).toEqual([{ text: "" }]);
  });
});

describe("hasAcronym", () => {
  it("répond sans qu'on ait à inspecter le découpage", () => {
    expect(hasAcronym("Signature of the MoU", GLOSSARY)).toBe(true);
    expect(hasAcronym("Signature of the agreement", GLOSSARY)).toBe(false);
  });
});
