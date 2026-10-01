import { describe, expect, it } from "vitest";
import {
  NO_TIMELINE,
  inclusiveEndOf,
  overlaps,
  resolveTimeline,
  timelineLabel,
  timelineSortKey,
} from "../timeline";

describe("resolution d'une precision en intervalle", () => {
  it("un JOUR couvre exactement un jour", () => {
    expect(resolveTimeline("day", "2026-10-01")).toEqual({
      kind: "day",
      start: "2026-10-01",
      end: "2026-10-02",
    });
  });

  it("une SEMAINE est recalee sur son lundi", () => {
    // Le 14 octobre 2026 est un mercredi : la semaine visee est celle du 12.
    expect(resolveTimeline("week", "2026-10-14")).toEqual({
      kind: "week",
      start: "2026-10-12",
      end: "2026-10-19",
    });
  });

  it("une semaine donnee par son lundi ne bouge pas", () => {
    expect(resolveTimeline("week", "2026-10-12").start).toBe("2026-10-12");
  });

  it("un MOIS part du 1er et finit au 1er suivant", () => {
    expect(resolveTimeline("month", "2026-10-23")).toEqual({
      kind: "month",
      start: "2026-10-01",
      end: "2026-11-01",
    });
  });

  it("un mois de decembre bascule bien d'annee", () => {
    expect(resolveTimeline("month", "2026-12-05").end).toBe("2027-01-01");
  });

  it("un TRIMESTRE couvre trois mois", () => {
    expect(resolveTimeline("quarter", "2027-02-14")).toEqual({
      kind: "quarter",
      start: "2027-01-01",
      end: "2027-04-01",
    });
  });

  it("le dernier trimestre bascule d'annee", () => {
    expect(resolveTimeline("quarter", "2026-11-30").end).toBe("2027-01-01");
  });

  it("une PLAGE du 1er au 3 couvre trois jours, pas deux", () => {
    // La saisie est inclusive, le stockage exclusif : sans le +1, le dernier
    // jour saisi serait exclu de sa propre plage.
    const t = resolveTimeline("range", "2026-10-01", "2026-10-03");
    expect(t).toEqual({ kind: "range", start: "2026-10-01", end: "2026-10-04" });
    expect(inclusiveEndOf(t)).toBe("2026-10-03");
  });

  it("une plage d'un seul jour reste valide", () => {
    expect(resolveTimeline("range", "2026-10-01", "2026-10-01").end).toBe("2026-10-02");
  });

  it("REFUSE une plage dont la fin precede le debut, sans corriger en silence", () => {
    expect(resolveTimeline("range", "2026-10-10", "2026-10-01")).toEqual(NO_TIMELINE);
  });

  it("refuse une plage sans fin", () => {
    expect(resolveTimeline("range", "2026-10-01")).toEqual(NO_TIMELINE);
  });

  it("l'absence de precision ou d'ancre rend l'absence de date", () => {
    expect(resolveTimeline(null, "2026-10-01")).toEqual(NO_TIMELINE);
    expect(resolveTimeline("week", null)).toEqual(NO_TIMELINE);
  });
});

describe("ecriture : la precision commande, jamais l'intervalle", () => {
  it("une semaine ne s'ecrit JAMAIS comme un jour", () => {
    // Le defaut que tout ce module existe pour empecher.
    const label = timelineLabel(resolveTimeline("week", "2026-10-12"), "en");
    expect(label.key).toBe("week");
    expect(label.values.date).toBe("12/10/2026");
  });

  it("un jour s'ecrit en jj/mm/aaaa", () => {
    const label = timelineLabel(resolveTimeline("day", "2026-10-01"), "en");
    expect(label).toEqual({ key: "day", values: { date: "01/10/2026" } });
  });

  it("un trimestre rend son rang et son annee", () => {
    const label = timelineLabel(resolveTimeline("quarter", "2027-01-01"), "en");
    expect(label).toEqual({ key: "quarter", values: { quarter: "1", year: "2027" } });
  });

  it("le quatrieme trimestre porte bien le rang 4", () => {
    const label = timelineLabel(resolveTimeline("quarter", "2026-11-05"), "en");
    expect(label.values).toEqual({ quarter: "4", year: "2026" });
  });

  it("un mois rend un nom de mois, pas un numero", () => {
    const label = timelineLabel(resolveTimeline("month", "2026-10-15"), "en");
    expect(label.key).toBe("month");
    expect(label.values.month).toMatch(/October/);
  });

  it("une plage rend ses deux bornes INCLUSIVES", () => {
    const label = timelineLabel(resolveTimeline("range", "2026-10-01", "2026-10-03"), "en");
    expect(label).toEqual({ key: "range", values: { from: "01/10/2026", to: "03/10/2026" } });
  });

  it("l'absence de date a sa propre cle, et ne se maquille pas en date", () => {
    expect(timelineLabel(NO_TIMELINE, "en")).toEqual({ key: "none", values: {} });
  });
});

describe("tri", () => {
  it("place les actions SANS DATE apres les autres", () => {
    const dated = timelineSortKey(resolveTimeline("day", "2029-12-31"));
    const undated = timelineSortKey(NO_TIMELINE);
    expect(dated[0]).toBeLessThan(undated[0]);
  });

  it("a debut egal, la periode la plus COURTE passe devant", () => {
    const day = timelineSortKey(resolveTimeline("day", "2027-01-01"));
    const quarter = timelineSortKey(resolveTimeline("quarter", "2027-01-01"));
    expect(day[1]).toBe(quarter[1]);
    expect(day[2]).toBeLessThan(quarter[2]);
  });
});

describe("recoupement avec une fenetre", () => {
  const week = resolveTimeline("week", "2026-10-12"); // 12 -> 19 exclu

  it("recoupe une fenetre qui la chevauche", () => {
    expect(overlaps(week, "2026-10-15", "2026-10-20")).toBe(true);
  });

  it("ne recoupe pas une fenetre qui commence a sa borne de fin", () => {
    // La fin est exclusive : le 19 n'appartient deja plus a la semaine.
    expect(overlaps(week, "2026-10-19", "2026-10-26")).toBe(false);
  });

  it("ne recoupe pas une fenetre qui finit a son debut", () => {
    expect(overlaps(week, "2026-10-05", "2026-10-12")).toBe(false);
  });

  it("une action sans date ne recoupe JAMAIS une fenetre", () => {
    // Sinon un filtre par periode ferait apparaitre des actions dont personne
    // n'a dit qu'elles tombaient la.
    expect(overlaps(NO_TIMELINE, "2020-01-01", "2030-01-01")).toBe(false);
  });
});
