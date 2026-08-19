// ============================================================
// LE test du lot 7.
//
// Alimenté avec les 27 tâches, 19 précédences et 4 contraintes RÉELLES du
// projet, le moteur doit reproduire les dates du fichier Excel d'origine à
// l'identique. C'est ce qui prouve que la reprise de l'historique est sûre :
// la PIU abandonne Excel sans voir une seule de ses dates bouger.
//
// Un test sur des données inventées prouverait seulement que le moteur est
// cohérent avec lui-même.
// ============================================================

import { describe, expect, it } from "vitest";
import { computeSchedule } from "../engine";
import {
  EXPECTED,
  PROJECT_START,
  SEED_CONSTRAINTS,
  SEED_DEPENDENCIES,
  SEED_TASKS,
} from "./seed-fixture";

const run = () =>
  computeSchedule({
    tasks: SEED_TASKS,
    dependencies: SEED_DEPENDENCIES,
    constraints: SEED_CONSTRAINTS,
    projectStart: PROJECT_START,
  });

describe("fidelite au planning reel", () => {
  it("reproduit les dates des 27 taches du seed", () => {
    const { windows } = run();

    const ecarts: string[] = [];
    for (const [wbs, attendu] of Object.entries(EXPECTED)) {
      const obtenu = windows.get(wbs);
      if (!obtenu) {
        ecarts.push(`${wbs} : absente du resultat`);
        continue;
      }
      if (obtenu.start !== attendu.start) {
        ecarts.push(`${wbs} debut : ${obtenu.start} au lieu de ${attendu.start}`);
      }
      if (obtenu.end !== attendu.end) {
        ecarts.push(`${wbs} fin : ${obtenu.end} au lieu de ${attendu.end}`);
      }
    }

    expect(ecarts, `\n${ecarts.join("\n")}\n`).toEqual([]);
  });

  it("concorde au jour pres avec le plan de passation", () => {
    const { windows } = run();

    // Les 5 jalons contractuels recoupes dans seed/README_PLANNING.md, dont
    // l'ecart avec le plan de passation est nul.
    expect(windows.get("TV.3.1.1")!.start).toBe("2027-08-05"); // publication de l'avis
    expect(windows.get("TV.3.1.1")!.end).toBe("2027-09-30"); // ouverture des plis
    expect(windows.get("TV.3.1.3")!.end).toBe("2027-11-11"); // signature
    expect(windows.get("TV.3.2")!.end).toBe("2029-02-01"); // achevement des travaux
    expect(windows.get("SC.2.8")!.end).toBe("2029-05-29"); // achevement du Design & Build
  });

  it("garde les jalons de marge terminale a leur place", () => {
    const { windows } = run();
    // 4 mois de marge avant la fin des travaux, annotation AY6 du fichier source.
    expect(windows.get("MS.1")!.start).toBe("2029-09-01");
    expect(windows.get("MS.2")!.start).toBe("2030-01-01");
    // Un jalon ne dure pas.
    expect(windows.get("MS.1")!.start).toBe(windows.get("MS.1")!.end);
  });
});

describe("convergences", () => {
  it("retient le predecesseur le PLUS TARDIF sur TV.2.4", () => {
    const { windows } = run();
    // TV.1 finit le 07/10, TV.2.3 le 15/10. C'est le second qui commande.
    expect(windows.get("TV.2.4")!.start).toBe("2026-10-15");
    expect(windows.get("TV.2.4")!.driver).toBe("predecessor");
    expect(windows.get("TV.2.4")!.drivingPredecessor).toBe("TV.2.3");
  });

  it("retient le predecesseur le PLUS TARDIF sur SC.2.5", () => {
    const { windows } = run();
    // SC.1 finit le 07/10, SC.2.1 le 22/10.
    expect(windows.get("SC.2.5")!.start).toBe("2026-10-22");
    expect(windows.get("SC.2.5")!.drivingPredecessor).toBe("SC.2.1");
  });
});

describe("types de tache", () => {
  it("agrege un recapitulatif sur MIN/MAX de ses enfants", () => {
    const { windows } = run();
    const tv2 = windows.get("TV.2")!;
    expect(tv2.start).toBe("2026-09-01"); // le plus tot : TV.2.1
    expect(tv2.end).toBe("2027-08-05"); // le plus tard : TV.2.7
    expect(tv2.driver).toBe("children");
  });

  it("laisse un intertitre SANS dates, meme quand ses enfants en ont", () => {
    const { windows } = run();
    const tv3 = windows.get("TV.3")!;
    expect(tv3.start).toBeNull();
    expect(tv3.end).toBeNull();
    // Ses enfants couvrent pourtant 18 mois : c'est bien la distinction
    // group_header / summary qu'aucune bibliotheque Gantt ne connait.
    expect(windows.get("TV.3.1")!.start).toBe("2027-08-05");
    expect(windows.get("TV.3.2")!.end).toBe("2029-02-01");
  });

  it("agrege un recapitulatif imbrique", () => {
    const { windows } = run();
    // TV.3.1 est un recapitulatif ENFANT de l'intertitre TV.3.
    expect(windows.get("TV.3.1")!.start).toBe("2027-08-05");
    expect(windows.get("TV.3.1")!.end).toBe("2027-11-11");
  });
});

describe("convention de duree", () => {
  it("verifie end = start + durationDays sur les 21 taches datees", () => {
    const { windows } = run();
    const ecarts: string[] = [];

    for (const task of SEED_TASKS) {
      if (task.durationDays === null) continue;
      const w = windows.get(task.id)!;
      const jours =
        (Date.UTC(...split(w.end!)) - Date.UTC(...split(w.start!))) / 86_400_000;
      if (jours !== task.durationDays) {
        ecarts.push(`${task.wbsCode} : ${jours} jours au lieu de ${task.durationDays}`);
      }
    }

    expect(ecarts, `\n${ecarts.join("\n")}\n`).toEqual([]);
  });
});

/** `Date.UTC` n'est utilise QUE dans le test, jamais dans le moteur. */
function split(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m - 1, d];
}
