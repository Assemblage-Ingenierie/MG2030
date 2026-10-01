import { describe, expect, it } from "vitest";
import { bufferStartFrom } from "../buffer";

describe("bufferStartFrom", () => {
  it("rend le cadre actuel du projet", () => {
    // 1er janvier 2030, quatre mois de marge → 1er septembre 2029. C'est la
    // valeur en base depuis le chargement initial : le calcul doit la
    // retrouver, sinon l'écran de paramètres réécrirait l'histoire au premier
    // enregistrement.
    expect(bufferStartFrom("2030-01-01", 4)).toBe("2029-09-01");
  });

  it("recule d'une année quand les mois débordent", () => {
    expect(bufferStartFrom("2030-03-15", 6)).toBe("2029-09-15");
    expect(bufferStartFrom("2030-01-10", 13)).toBe("2028-12-10");
  });

  it("ne déborde pas sur le mois suivant depuis un 31", () => {
    // 31 mars moins un mois : février n'a pas de 31. On recule au 28, et
    // surtout pas au 3 mars — une marge qui commencerait après l'échéance
    // qu'on vient d'annoncer.
    expect(bufferStartFrom("2027-03-31", 1)).toBe("2027-02-28");
    expect(bufferStartFrom("2028-03-31", 1)).toBe("2028-02-29");
    expect(bufferStartFrom("2030-05-31", 1)).toBe("2030-04-30");
  });

  it("rend l'échéance elle-même pour une marge nulle", () => {
    expect(bufferStartFrom("2030-01-01", 0)).toBe("2030-01-01");
  });

  it("garde une date valide sur de longues marges", () => {
    expect(bufferStartFrom("2030-01-01", 36)).toBe("2027-01-01");
    expect(bufferStartFrom("2030-02-01", 25)).toBe("2028-01-01");
  });

  it("rend l'entrée telle quelle si elle n'est pas une date", () => {
    expect(bufferStartFrom("", 4)).toBe("");
    expect(bufferStartFrom("pas-une-date", 4)).toBe("pas-une-date");
  });
});
