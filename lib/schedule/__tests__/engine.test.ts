// ============================================================
// Comportements du moteur : cascade, priorités, cycles, cas limites.
//
// La fidélité au planning réel est traitée séparément, dans
// seed-fidelity.test.ts. Ici on éprouve les règles, y compris celles que le
// seed n'exerce pas.
// ============================================================

import { describe, expect, it } from "vitest";
import { computeSchedule, downstreamOf } from "../engine";
import { ScheduleCycleError, UnsupportedDependencyError, type TaskInput } from "../types";
import {
  PROJECT_START,
  SEED_CONSTRAINTS,
  SEED_DEPENDENCIES,
  SEED_TASKS,
} from "./seed-fixture";

const task = (over: Partial<TaskInput> & { id: string }): TaskInput => ({
  wbsCode: over.id,
  type: "task",
  parentId: null,
  durationDays: 10,
  startDateInput: null,
  sortOrder: 0,
  ...over,
});

describe("recalcul en cascade", () => {
  it("propage un glissement a toute la chaine aval", () => {
    const avant = computeSchedule({
      tasks: SEED_TASKS,
      dependencies: SEED_DEPENDENCIES,
      constraints: SEED_CONSTRAINTS,
      projectStart: PROJECT_START,
    });

    // On decale de 10 jours la contrainte de depart de TV.2.1.
    const apres = computeSchedule({
      tasks: SEED_TASKS,
      dependencies: SEED_DEPENDENCIES,
      constraints: SEED_CONSTRAINTS.map((c) =>
        c.taskId === "TV.2.1" ? { ...c, date: "2026-09-11" } : c,
      ),
      projectStart: PROJECT_START,
    });

    expect(apres.windows.get("TV.2.1")!.start).toBe("2026-09-11");
    // La fin des travaux glisse d'autant : 01/02/2029 -> 11/02/2029.
    expect(avant.windows.get("TV.3.2")!.end).toBe("2029-02-01");
    expect(apres.windows.get("TV.3.2")!.end).toBe("2029-02-11");
  });

  it("N'AVANCE PAS une tache tenue par un AUTRE predecesseur", () => {
    // C'est le test qui distingue une vraie convergence d'une chaine lineaire.
    // TV.2.4 depend de TV.1 (fin 07/10) et TV.2.3 (fin 15/10). En reculant la
    // chaine TV.2.x de 8 jours, TV.2.3 finit le 07/10 : TV.2.4 devrait alors
    // etre tenue par TV.1, et ne PAS bouger davantage.
    const decale = computeSchedule({
      tasks: SEED_TASKS,
      dependencies: SEED_DEPENDENCIES,
      constraints: SEED_CONSTRAINTS.map((c) =>
        c.taskId === "TV.2.1" ? { ...c, date: "2026-08-24" } : c,
      ),
      projectStart: PROJECT_START,
    });

    expect(decale.windows.get("TV.2.3")!.end).toBe("2026-10-07");
    // Les deux predecesseurs finissent le meme jour : TV.2.4 demarre le 07/10,
    // et non le 15/10 d'origine.
    expect(decale.windows.get("TV.2.4")!.start).toBe("2026-10-07");

    // En reculant davantage, TV.1 devient seule determinante et TV.2.4 se fige.
    const plusTot = computeSchedule({
      tasks: SEED_TASKS,
      dependencies: SEED_DEPENDENCIES,
      constraints: SEED_CONSTRAINTS.map((c) =>
        c.taskId === "TV.2.1" ? { ...c, date: "2026-08-01" } : c,
      ),
      projectStart: PROJECT_START,
    });
    expect(plusTot.windows.get("TV.2.4")!.start).toBe("2026-10-07");
    expect(plusTot.windows.get("TV.2.4")!.drivingPredecessor).toBe("TV.1");
  });

  it("limite le sous-graphe aval au strict necessaire", () => {
    const aval = downstreamOf("TV.2.6", SEED_DEPENDENCIES);
    expect(aval).toContain("TV.2.6");
    expect(aval).toContain("TV.3.2");
    // Rien de la chaine Student Center ne depend de la chaine training venues.
    expect(aval.has("SC.2.8")).toBe(false);
    expect(aval.has("TV.2.1")).toBe(false);
  });
});

describe("priorites de calcul du debut", () => {
  it("l'ancre saisie prime sur le predecesseur", () => {
    const { windows } = computeSchedule({
      tasks: [
        task({ id: "A", durationDays: 10, startDateInput: "2026-01-01" }),
        task({ id: "B", durationDays: 5, startDateInput: "2026-06-01" }),
      ],
      dependencies: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 }],
      constraints: [],
      projectStart: "2026-01-01",
    });
    // A finit le 11/01, mais B est ancree au 01/06 : l'ancre gagne.
    expect(windows.get("B")!.start).toBe("2026-06-01");
    expect(windows.get("B")!.driver).toBe("input");
  });

  it("la contrainte « pas avant » repousse mais n'avance jamais", () => {
    const tasks = [
      task({ id: "A", durationDays: 10, startDateInput: "2026-01-01" }),
      task({ id: "B", durationDays: 5 }),
    ];
    const deps = [{ predecessorId: "A", successorId: "B", type: "FS" as const, lagDays: 0 }];

    // Contrainte ANTERIEURE a la fin du predecesseur : sans effet.
    const tot = computeSchedule({
      tasks,
      dependencies: deps,
      constraints: [{ taskId: "B", kind: "start_no_earlier_than", date: "2025-01-01" }],
      projectStart: "2026-01-01",
    });
    expect(tot.windows.get("B")!.start).toBe("2026-01-11");

    // Contrainte POSTERIEURE : elle repousse.
    const tard = computeSchedule({
      tasks,
      dependencies: deps,
      constraints: [{ taskId: "B", kind: "start_no_earlier_than", date: "2026-03-01" }],
      projectStart: "2026-01-01",
    });
    expect(tard.windows.get("B")!.start).toBe("2026-03-01");
    expect(tard.windows.get("B")!.driver).toBe("constraint");
  });

  it("retombe sur le debut de projet quand rien ne determine la tache", () => {
    const { windows } = computeSchedule({
      tasks: [task({ id: "orpheline", durationDays: 7 })],
      dependencies: [],
      constraints: [],
      projectStart: "2026-07-01",
    });
    expect(windows.get("orpheline")!.start).toBe("2026-07-01");
    expect(windows.get("orpheline")!.driver).toBe("project-start");
  });

  it("applique un decalage positif comme negatif", () => {
    const build = (lag: number) =>
      computeSchedule({
        tasks: [
          task({ id: "A", durationDays: 10, startDateInput: "2026-01-01" }),
          task({ id: "B", durationDays: 5 }),
        ],
        dependencies: [{ predecessorId: "A", successorId: "B", type: "FS", lagDays: lag }],
        constraints: [],
        projectStart: "2026-01-01",
      }).windows.get("B")!.start;

    expect(build(0)).toBe("2026-01-11");
    expect(build(5)).toBe("2026-01-16");
    expect(build(-3)).toBe("2026-01-08"); // chevauchement volontaire
  });
});

describe("refus", () => {
  it("nomme les taches d'un cycle", () => {
    const run = () =>
      computeSchedule({
        tasks: [task({ id: "A" }), task({ id: "B" }), task({ id: "C" })],
        dependencies: [
          { predecessorId: "A", successorId: "B", type: "FS", lagDays: 0 },
          { predecessorId: "B", successorId: "C", type: "FS", lagDays: 0 },
          { predecessorId: "C", successorId: "A", type: "FS", lagDays: 0 },
        ],
        constraints: [],
        projectStart: "2026-01-01",
      });

    expect(run).toThrow(ScheduleCycleError);
    try {
      run();
    } catch (e) {
      const err = e as ScheduleCycleError;
      // Le message doit NOMMER les taches : « cycle detecte » sans chemin
      // obligerait a chercher a la main dans le graphe.
      expect(err.cycle).toContain("A");
      expect(err.message).toMatch(/A/);
    }
  });

  it("refuse un type de precedence non implemente plutot que de l'ignorer", () => {
    expect(() =>
      computeSchedule({
        tasks: [task({ id: "A" }), task({ id: "B" })],
        dependencies: [{ predecessorId: "A", successorId: "B", type: "SS", lagDays: 0 }],
        constraints: [],
        projectStart: "2026-01-01",
      }),
    ).toThrow(UnsupportedDependencyError);
  });

  it("ignore une precedence dont une extremite est hors du jeu", () => {
    // Cas d'une vue filtree : le predecesseur est hors perimetre RLS. La tache
    // retombe sur son ancre, elle n'echoue pas.
    const { windows } = computeSchedule({
      tasks: [task({ id: "B", durationDays: 5 })],
      dependencies: [{ predecessorId: "ABSENTE", successorId: "B", type: "FS", lagDays: 0 }],
      constraints: [],
      projectStart: "2026-02-01",
    });
    expect(windows.get("B")!.start).toBe("2026-02-01");
  });
});

describe("cas limites", () => {
  it("accepte un planning vide", () => {
    const { windows, order } = computeSchedule({
      tasks: [],
      dependencies: [],
      constraints: [],
      projectStart: "2026-01-01",
    });
    expect(windows.size).toBe(0);
    expect(order).toEqual([]);
  });

  it("laisse un recapitulatif sans enfant sans dates", () => {
    const { windows } = computeSchedule({
      tasks: [task({ id: "vide", type: "summary", durationDays: null })],
      dependencies: [],
      constraints: [],
      projectStart: "2026-01-01",
    });
    expect(windows.get("vide")!.start).toBeNull();
    expect(windows.get("vide")!.driver).toBe("none");
  });

  it("traite une duree nulle sans produire de date invalide", () => {
    const { windows } = computeSchedule({
      tasks: [task({ id: "A", durationDays: 0, startDateInput: "2026-05-05" })],
      dependencies: [],
      constraints: [],
      projectStart: "2026-01-01",
    });
    expect(windows.get("A")!.start).toBe("2026-05-05");
    expect(windows.get("A")!.end).toBe("2026-05-05");
  });

  it("tient sur une chaine longue sans deborder de la pile", () => {
    const n = 2000;
    const tasks = Array.from({ length: n }, (_, i) => task({ id: `T${i}`, durationDays: 1 }));
    const deps = Array.from({ length: n - 1 }, (_, i) => ({
      predecessorId: `T${i}`,
      successorId: `T${i + 1}`,
      type: "FS" as const,
      lagDays: 0,
    }));
    const { windows } = computeSchedule({
      tasks,
      dependencies: deps,
      constraints: [],
      projectStart: "2026-01-01",
    });
    // 2000 taches d'un jour, enchainees depuis le 01/01/2026 : la derniere
    // FINIT a debut + 2000 jours (chaque tache finit la ou la suivante commence).
    expect(windows.get(`T${n - 1}`)!.end).toBe("2031-06-24");
    expect(windows.get("T0")!.start).toBe("2026-01-01");
  });
});
