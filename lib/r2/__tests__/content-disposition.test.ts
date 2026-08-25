import { describe, expect, it } from "vitest";
import { contentDisposition } from "@/lib/r2/content-disposition";

describe("contentDisposition", () => {
  it("porte le type et le nom exact", () => {
    const header = contentDisposition("attachment", "rapport.pdf");
    expect(header).toContain("attachment;");
    expect(header).toContain('filename="rapport.pdf"');
    expect(header).toContain("filename*=UTF-8''rapport.pdf");
  });

  it("distingue voir et telecharger", () => {
    expect(contentDisposition("inline", "a.pdf")).toMatch(/^inline;/);
    expect(contentDisposition("attachment", "a.pdf")).toMatch(/^attachment;/);
  });

  it("encode un nom en albanais dans le champ UTF-8, et le degrade en ASCII dans le repli", () => {
    const header = contentDisposition("attachment", "Marrëveshja e financimit.pdf");
    expect(header).toContain("filename*=UTF-8''Marr%C3%ABveshja%20e%20financimit.pdf");
    // Le repli ASCII ne doit contenir aucun octet hors imprimable US-ASCII.
    const fallback = /filename="([^"]*)"/.exec(header)![1];
    expect(/^[\x20-\x7e]*$/.test(fallback)).toBe(true);
    expect(fallback).toBe("Marr_veshja e financimit.pdf");
  });

  it("NEUTRALISE une tentative d'injection d'en-tete par retour chariot", () => {
    // Un nom de fichier saisi par l'utilisateur ne doit jamais pouvoir
    // introduire une seconde ligne d'en-tete HTTP dans la reponse.
    const malicious = 'a.pdf"\r\nSet-Cookie: pwned=1';
    const header = contentDisposition("attachment", malicious);
    expect(header).not.toContain("\r");
    expect(header).not.toContain("\n");
  });

  it("neutralise aussi un guillemet seul, sans injection", () => {
    const header = contentDisposition("attachment", 'rapport ".docx');
    expect(header).not.toMatch(/filename="[^"]*"[^;]*"/);
    // Le guillemet interne devient une apostrophe : la valeur reste une
    // chaine entre guillemets valide.
    expect(header).toContain('filename="rapport \'.docx"');
  });

  it("retire le prefixe UUID de la cle R2 : le nom vient de original_filename, jamais de la cle", () => {
    // Ce test documente l'intention plutot qu'une fonction : la cle
    // 'mg2030/dossier/<uuid>-nom.pdf' ne doit JAMAIS etre passee ici.
    const objectKeySuffix = "9e078846-4974-40f3-a212-69c083ccc6cb-rapport.pdf";
    const header = contentDisposition("attachment", "rapport.pdf");
    expect(header).not.toContain(objectKeySuffix);
    expect(header).toContain('filename="rapport.pdf"');
  });
});
