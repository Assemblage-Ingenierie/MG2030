import { describe, expect, it } from "vitest";
import {
  OBSERVED_SEQUENCE,
  instantiateTemplate,
  type ContractAnchors,
  type TemplateStep,
} from "../instantiate";

const steps: TemplateStep[] = OBSERVED_SEQUENCE.map((s, i) => ({ ...s, id: `step-${i + 1}` }));

const noAnchors: ContractAnchors = {
  spn_publication_date: null,
  bid_opening_date: null,
  signature_date: null,
  completion_date: null,
};

describe("instanciation d'un gabarit", () => {
  it("enchaine les etapes en fin-debut quand aucun jalon n'est connu", () => {
    const tasks = instantiateTemplate({
      steps,
      anchors: noAnchors,
      wbsPrefix: "W-TV",
      fallbackStart: "2027-01-01",
    });

    expect(tasks).toHaveLength(7);
    expect(tasks[0].previewStart).toBe("2027-01-01");
    // Chaque etape commence ou la precedente finit.
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].previewStart).toBe(tasks[i - 1].previewEnd);
      expect(tasks[i].predecessorWbs).toBe(tasks[i - 1].wbsCode);
    }
  });

  it("ANCRE une etape sur la date contractuelle, qui prime sur l'enchainement", () => {
    // Les vraies dates de W-TV au plan de passation.
    const tasks = instantiateTemplate({
      steps,
      anchors: {
        spn_publication_date: "2027-08-05",
        bid_opening_date: "2027-09-30",
        signature_date: "2027-11-11",
        completion_date: "2029-02-01",
      },
      wbsPrefix: "W-TV",
      fallbackStart: "2027-01-01",
    });

    // La publication est ancree, pas calculee depuis fallbackStart.
    expect(tasks[0].previewStart).toBe("2027-08-05");
    expect(tasks[0].startDateInput).toBe("2027-08-05");
    // Une etape ancree n'a PAS de predecesseur : sa date vient du document.
    expect(tasks[0].predecessorWbs).toBeNull();

    expect(tasks.find((t) => t.stepNo === 4)!.previewStart).toBe("2027-09-30");
    expect(tasks.find((t) => t.stepNo === 6)!.previewStart).toBe("2027-11-11");
    expect(tasks.find((t) => t.stepNo === 7)!.previewStart).toBe("2029-02-01");
  });

  it("marque les etapes qui declenchent un avis de non-objection", () => {
    const tasks = instantiateTemplate({
      steps,
      anchors: noAnchors,
      wbsPrefix: "C-TA",
      fallbackStart: "2026-11-15",
    });
    const withNon = tasks.filter((t) => t.createsNoObjection);
    // Deux NoN dans la sequence observee : apres la revue, et a la negociation.
    expect(withNon.map((t) => t.stepNo)).toEqual([3, 6]);
  });

  it("prefixe les codes WBS par le marche", () => {
    const tasks = instantiateTemplate({
      steps,
      anchors: noAnchors,
      wbsPrefix: "DB-SC",
      fallbackStart: "2026-09-01",
    });
    expect(tasks[0].wbsCode).toBe("DB-SC.1");
    expect(tasks[6].wbsCode).toBe("DB-SC.7");
  });

  it("respecte l'ordre des etapes meme si le gabarit est desordonne", () => {
    const shuffled = [steps[3], steps[0], steps[6], steps[1]];
    const tasks = instantiateTemplate({
      steps: shuffled,
      anchors: noAnchors,
      wbsPrefix: "X",
      fallbackStart: "2026-01-01",
    });
    expect(tasks.map((t) => t.stepNo)).toEqual([1, 2, 4, 7]);
  });

  it("accepte un gabarit vide", () => {
    expect(
      instantiateTemplate({
        steps: [],
        anchors: noAnchors,
        wbsPrefix: "X",
        fallbackStart: "2026-01-01",
      }),
    ).toEqual([]);
  });

  it("reproduit la duree de la chaine du plan de passation", () => {
    // Sequence observee sans ancre : 21 + 14 + 10 + 56 + 14 + 28 = 143 jours
    // avant l'execution.
    const tasks = instantiateTemplate({
      steps,
      anchors: noAnchors,
      wbsPrefix: "W-TV",
      fallbackStart: "2027-08-05",
    });
    expect(tasks[6].previewStart).toBe("2027-12-26");
  });
});
