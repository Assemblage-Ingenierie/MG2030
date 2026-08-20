import { describe, expect, it } from "vitest";
import {
  ANCHOR_MODE,
  OBSERVED_CONSULTANT_SEQUENCE,
  OBSERVED_WORKS_SEQUENCE,
  instantiateTemplate,
  type ContractAnchors,
  type TemplateStep,
} from "../instantiate";

const withIds = (seq: Omit<TemplateStep, "id">[]): TemplateStep[] =>
  seq.map((s, i) => ({ ...s, id: `step-${i + 1}` }));

const consultant = withIds(OBSERVED_CONSULTANT_SEQUENCE);
const works = withIds(OBSERVED_WORKS_SEQUENCE);

const noAnchors: ContractAnchors = {
  spn_publication_date: null,
  bid_opening_date: null,
  signature_date: null,
  completion_date: null,
};

describe("instanciation d'un gabarit", () => {
  it("enchaine les etapes en fin-debut quand aucun jalon n'est connu", () => {
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: noAnchors,
      wbsPrefix: "W-TV",
      fallbackStart: "2027-01-01",
    });

    expect(tasks).toHaveLength(7);
    expect(tasks[0].previewStart).toBe("2027-01-01");
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].previewStart).toBe(tasks[i - 1].previewEnd);
      expect(tasks[i].predecessorWbs).toBe(tasks[i - 1].wbsCode);
    }
    // Sans ancre, aucun ecart possible : rien n'entre en concurrence.
    expect(tasks.every((t) => t.conflictDays === 0 && t.slackDays === 0)).toBe(true);
  });

  it("prefixe les codes WBS par le marche", () => {
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: noAnchors,
      wbsPrefix: "DB-SC",
      fallbackStart: "2026-09-01",
    });
    expect(tasks[0].wbsCode).toBe("DB-SC.1");
    expect(tasks[6].wbsCode).toBe("DB-SC.7");
  });

  it("respecte l'ordre des etapes meme si le gabarit est desordonne", () => {
    const shuffled = [consultant[3], consultant[0], consultant[6], consultant[1]];
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

  it("reproduit la chaine reelle de C-TV-DD, duree pour duree", () => {
    // Le planning : EOI 01/09 -> negociation finie le 08/01/2027.
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: noAnchors,
      wbsPrefix: "C-TV-DD",
      fallbackStart: "2026-09-01",
    });
    expect(tasks[0].previewEnd).toBe("2026-09-22"); // TV.2.1, 21 j
    expect(tasks[1].previewEnd).toBe("2026-10-06"); // TV.2.2, 14 j
    expect(tasks[2].previewEnd).toBe("2026-10-16"); // TV.2.3, 10 j
    expect(tasks[3].previewEnd).toBe("2026-11-27"); // TV.2.4, 42 j
    expect(tasks[4].previewEnd).toBe("2026-12-11"); // TV.2.5, 14 j
    expect(tasks[5].previewEnd).toBe("2027-01-08"); // TV.2.6, 28 j
  });

  it("reproduit la chaine reelle de TV.3.1 pour les travaux", () => {
    const tasks = instantiateTemplate({
      steps: works,
      anchors: noAnchors,
      wbsPrefix: "W-TV",
      fallbackStart: "2027-08-06",
    });
    expect(tasks[0].previewEnd).toBe("2027-10-01"); // 56 j
    expect(tasks[1].previewEnd).toBe("2027-10-15"); // 14 j
    expect(tasks[2].previewEnd).toBe("2027-11-12"); // 28 j
  });
});

describe("ancres contractuelles", () => {
  it("cale un avis de publication sur son DEBUT", () => {
    expect(ANCHOR_MODE.spn_publication_date).toBe("start");
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: { ...noAnchors, spn_publication_date: "2027-08-05" },
      wbsPrefix: "W-TV",
      fallbackStart: "2027-01-01",
    });
    expect(tasks[0].previewStart).toBe("2027-08-05");
    expect(tasks[0].startDateInput).toBe("2027-08-05");
    // Une etape ancree n'a PAS de predecesseur : sa date vient du document.
    expect(tasks[0].predecessorWbs).toBeNull();
  });

  it("cale signature et achevement sur leur FIN, pas leur debut", () => {
    // Le defaut corrige : la negociation commencait le jour de la signature,
    // donc apres que le marche etait deja signe.
    expect(ANCHOR_MODE.signature_date).toBe("end");
    expect(ANCHOR_MODE.completion_date).toBe("end");
    expect(ANCHOR_MODE.bid_opening_date).toBe("end");

    const tasks = instantiateTemplate({
      steps: works,
      anchors: { ...noAnchors, signature_date: "2027-11-11" },
      wbsPrefix: "W-TV",
      fallbackStart: "2027-08-06",
    });
    const negotiation = tasks.find((t) => t.stepNo === 3)!;
    // 28 jours AVANT la signature, et non a partir d'elle.
    expect(negotiation.previewStart).toBe("2027-10-14");
    expect(negotiation.previewEnd).toBe("2027-11-11");
  });

  it("cale la preparation des offres pour qu'elle FINISSE a l'ouverture des plis", () => {
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: { ...noAnchors, bid_opening_date: "2026-11-13" },
      wbsPrefix: "C-TV-DD",
      fallbackStart: "2026-09-01",
    });
    const preparation = tasks.find((t) => t.stepNo === 4)!;
    expect(preparation.previewEnd).toBe("2026-11-13");
    expect(preparation.previewStart).toBe("2026-10-02"); // 42 j avant
  });

  it("SIGNALE le chevauchement quand l'ancre precede la fin de l'etape amont", () => {
    // Cas reel : C-TV-DD. Le plan de passation place l'ouverture des plis au
    // 13/11, le planning fait finir la preparation le 27/11 (GAPS 13). L'ancre
    // fait foi, mais l'ecart doit se voir.
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: {
        spn_publication_date: "2026-09-01",
        bid_opening_date: "2026-11-13",
        signature_date: null,
        completion_date: null,
      },
      wbsPrefix: "C-TV-DD",
      fallbackStart: "2026-09-01",
    });
    const preparation = tasks.find((t) => t.stepNo === 4)!;
    // L'etape 3 finit le 16/10 ; l'ancre fait commencer l'etape 4 le 02/10.
    expect(preparation.previewStart).toBe("2026-10-02");
    expect(preparation.conflictDays).toBe(14);
    expect(preparation.slackDays).toBe(0);
  });

  it("SIGNALE le battement quand l'ancre laisse du temps mort", () => {
    const tasks = instantiateTemplate({
      steps: works,
      anchors: { ...noAnchors, signature_date: "2028-06-01" },
      wbsPrefix: "W-TV",
      fallbackStart: "2027-08-06",
    });
    const negotiation = tasks.find((t) => t.stepNo === 3)!;
    expect(negotiation.conflictDays).toBe(0);
    expect(negotiation.slackDays).toBeGreaterThan(0);
  });

  it("n'invente pas d'ecart sur la PREMIERE etape", () => {
    // Rien ne precede : comparer a `fallbackStart` produirait un faux conflit.
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: { ...noAnchors, spn_publication_date: "2026-01-01" },
      wbsPrefix: "X",
      fallbackStart: "2027-06-30",
    });
    expect(tasks[0].conflictDays).toBe(0);
    expect(tasks[0].slackDays).toBe(0);
  });

  it("marque les etapes qui declenchent un avis de non-objection", () => {
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: noAnchors,
      wbsPrefix: "C-TA",
      fallbackStart: "2026-11-15",
    });
    // Deux NoN dans la sequence consultant : apres la revue, et a la negociation.
    expect(tasks.filter((t) => t.createsNoObjection).map((t) => t.stepNo)).toEqual([3, 6]);
    // Un seul dans la sequence travaux : l'appel est ouvert.
    const w = instantiateTemplate({
      steps: works,
      anchors: noAnchors,
      wbsPrefix: "W-SC",
      fallbackStart: "2027-03-27",
    });
    expect(w.filter((t) => t.createsNoObjection).map((t) => t.stepNo)).toEqual([3]);
  });

  it("garde un jalon d'achevement a duree nulle", () => {
    const tasks = instantiateTemplate({
      steps: consultant,
      anchors: { ...noAnchors, completion_date: "2030-06-15" },
      wbsPrefix: "C-TA",
      fallbackStart: "2026-11-15",
    });
    const completion = tasks.find((t) => t.stepNo === 7)!;
    expect(completion.durationDays).toBe(0);
    expect(completion.previewStart).toBe("2030-06-15");
    expect(completion.previewEnd).toBe("2030-06-15");
  });
});
