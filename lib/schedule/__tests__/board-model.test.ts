import { describe, expect, it } from "vitest";
import {
  descendantCount,
  expectedEnd,
  isCollapsible,
  isDrivenByPredecessor,
  moveTask,
  moveTaskTo,
  ordered,
  predecessorRows,
  recompute,
  removeTask,
  rowNumbers,
  setField,
  setPredecessorRows,
  visibleTasks,
  type BoardModel,
  type ModelTask,
} from "@/lib/schedule/board-model";
import type { TaskType } from "@/lib/schedule/types";

/** Fabrique une tâche : seuls les champs qui comptent pour le test sont passés. */
function task(
  id: string,
  over: Partial<ModelTask> & { type?: TaskType } = {},
): ModelTask {
  return {
    id,
    wbsCode: id,
    activity: id,
    type: "task",
    parentId: null,
    durationDays: 10,
    startAnchor: null,
    constraintDate: null,
    progressPct: null,
    ownerId: null,
    ownerName: null,
    contractId: null,
    contractCode: null,
    siteId: null,
    siteCode: null,
    subproject: null,
    sortOrder: 0,
    start: null,
    end: null,
    depth: 0,
    driver: null,
    drivingPredecessor: null,
    drifted: false,
    ...over,
  };
}

/** Reproduit la forme réelle du plan : TV.2 récapitulatif, TV.3 intertitre. */
function seedModel(): BoardModel {
  return recompute({
    projectStart: "2026-09-01",
    cycle: null,
    dependencies: [],
    tasks: [
      task("a", { sortOrder: 0, constraintDate: "2026-09-01" }),
      task("sum", { type: "summary", sortOrder: 10, durationDays: null }),
      task("s1", { parentId: "sum", sortOrder: 0 }),
      task("s2", { parentId: "sum", sortOrder: 10 }),
      task("hdr", { type: "group_header", sortOrder: 20, durationDays: null }),
      task("h1", { parentId: "hdr", sortOrder: 0 }),
    ],
  });
}

describe("ordre et profondeur", () => {
  it("place chaque parent juste avant ses descendants", () => {
    const m = seedModel();
    expect(m.tasks.map((t) => t.id)).toEqual(["a", "sum", "s1", "s2", "hdr", "h1"]);
    expect(m.tasks.map((t) => t.depth)).toEqual([0, 0, 1, 1, 0, 1]);
  });

  it("ne fait pas disparaitre une tache dont le parent a ete supprime", () => {
    const orphan = [task("x", { parentId: "disparu" }), task("y")];
    expect(ordered(orphan).map((t) => t.id)).toEqual(["y", "x"]);
  });
});

describe("numerotation de ligne", () => {
  it("numerote de 1 a n dans l'ordre d'affichage", () => {
    const rows = rowNumbers(seedModel().tasks);
    expect(rows.get("a")).toBe(1);
    expect(rows.get("s1")).toBe(3);
    expect(rows.get("h1")).toBe(6);
  });

  it("SE RENUMEROTE apres un deplacement, les liens suivant les identifiants", () => {
    let m = seedModel();
    const linked = setPredecessorRows(m, "s2", [3]); // s2 depend de s1 (ligne 3)
    expect(linked.ok).toBe(true);
    m = (linked as { ok: true; model: BoardModel }).model;

    // On echange s1 et s2 : s1 devient ligne 4, s2 ligne 3.
    const moved = moveTask(m, "s2", -1)!;
    const rows = rowNumbers(moved.tasks);
    expect(rows.get("s2")).toBe(3);
    expect(rows.get("s1")).toBe(4);
    // Le lien est INCHANGE dans sa nature — il pointe toujours vers s1, qui
    // s'appelle maintenant ligne 4.
    expect(predecessorRows(moved, "s2", rows)).toEqual([4]);
  });
});

describe("precedences par numero de ligne", () => {
  it("pose un lien fin-debut et enchaine les dates", () => {
    const m = seedModel();
    const r = setPredecessorRows(m, "s2", [3]);
    expect(r.ok).toBe(true);
    const next = (r as { ok: true; model: BoardModel }).model;
    const s1 = next.tasks.find((t) => t.id === "s1")!;
    const s2 = next.tasks.find((t) => t.id === "s2")!;
    // FIN-DEBUT : le successeur commence ou le predecesseur finit.
    expect(s2.start).toBe(s1.end);
  });

  it("refuse un numero hors bornes en le NOMMANT", () => {
    const r = setPredecessorRows(seedModel(), "s2", [99]);
    expect(r).toMatchObject({ ok: false, error: "unknownPredecessor", detail: "99" });
  });

  it("refuse qu'une tache se precede elle-meme", () => {
    const r = setPredecessorRows(seedModel(), "s2", [4]);
    expect(r).toMatchObject({ ok: false, error: "selfPredecessor" });
  });

  it("refuse un cycle et le decrit en numeros de ligne", () => {
    let m = seedModel();
    m = (setPredecessorRows(m, "s2", [3]) as { ok: true; model: BoardModel }).model;
    const r = setPredecessorRows(m, "s1", [4]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe("cycle");
      expect(r.detail).toMatch(/#/);
    }
  });

  it("une liste vide detache la tache", () => {
    let m = seedModel();
    m = (setPredecessorRows(m, "s2", [3]) as { ok: true; model: BoardModel }).model;
    expect(isDrivenByPredecessor(m, "s2")).toBe(true);
    m = (setPredecessorRows(m, "s2", []) as { ok: true; model: BoardModel }).model;
    expect(isDrivenByPredecessor(m, "s2")).toBe(false);
  });
});

describe("fin-debut : la fin suit toujours le debut", () => {
  it("deplacer le debut deplace la fin d'autant", () => {
    const m = setField(seedModel(), "a", { startAnchor: "2026-10-01" });
    const a = m.tasks.find((t) => t.id === "a")!;
    expect(a.start).toBe("2026-10-01");
    expect(a.end).toBe("2026-10-11"); // 10 jours
    expect(expectedEnd(a)).toBe(a.end);
  });

  it("changer la duree deplace la fin, jamais le debut", () => {
    const m = setField(seedModel(), "a", { durationDays: 20 });
    const a = m.tasks.find((t) => t.id === "a")!;
    expect(a.start).toBe("2026-09-01");
    expect(a.end).toBe("2026-09-21");
  });

  it("PROPAGE en cascade sur toute la chaine", () => {
    let m = seedModel();
    m = (setPredecessorRows(m, "s1", [1]) as { ok: true; model: BoardModel }).model;
    m = (setPredecessorRows(m, "s2", [3]) as { ok: true; model: BoardModel }).model;

    const before = m.tasks.find((t) => t.id === "s2")!.start!;
    // On allonge la premiere tache de 5 jours : tout l'aval doit reculer d'autant.
    m = setField(m, "a", { durationDays: 15 });
    const after = m.tasks.find((t) => t.id === "s2")!.start!;
    expect(new Date(after).getTime() - new Date(before).getTime()).toBe(5 * 86400000);
  });

  it("le recapitulatif encadre ses enfants", () => {
    let m = seedModel();
    m = (setPredecessorRows(m, "s2", [3]) as { ok: true; model: BoardModel }).model;
    const sum = m.tasks.find((t) => t.id === "sum")!;
    const s1 = m.tasks.find((t) => t.id === "s1")!;
    const s2 = m.tasks.find((t) => t.id === "s2")!;
    expect(sum.start).toBe(s1.start);
    expect(sum.end).toBe(s2.end);
  });

  it("l'intertitre ne porte AUCUNE date", () => {
    const hdr = seedModel().tasks.find((t) => t.id === "hdr")!;
    expect(hdr.start).toBeNull();
    expect(hdr.end).toBeNull();
  });
});

describe("deplacement", () => {
  it("echange deux freres", () => {
    const m = moveTask(seedModel(), "s2", -1)!;
    expect(m.tasks.map((t) => t.id)).toEqual(["a", "sum", "s2", "s1", "hdr", "h1"]);
  });

  it("refuse de sortir de la fratrie", () => {
    expect(moveTask(seedModel(), "s1", -1)).toBeNull();
    expect(moveTask(seedModel(), "s2", 1)).toBeNull();
  });

  it("emporte les descendants", () => {
    const m = moveTask(seedModel(), "sum", 1)!;
    // sum passe apres hdr, et s1/s2 la suivent.
    expect(m.tasks.map((t) => t.id)).toEqual(["a", "hdr", "h1", "sum", "s1", "s2"]);
  });

  it("depose une tache a la place d'une autre", () => {
    const m = moveTaskTo(seedModel(), "s2", "s1")!;
    expect(m.tasks.map((t) => t.id)).toEqual(["a", "sum", "s2", "s1", "hdr", "h1"]);
  });

  it("refuse un depot hors fratrie plutot que de reparenter en silence", () => {
    expect(moveTaskTo(seedModel(), "s1", "a")).toBeNull();
  });
});

describe("suppression", () => {
  it("emporte les descendants et les liens qui y menaient", () => {
    let m = seedModel();
    m = (setPredecessorRows(m, "s1", [1]) as { ok: true; model: BoardModel }).model;
    m = removeTask(m, "sum");
    expect(m.tasks.map((t) => t.id)).toEqual(["a", "hdr", "h1"]);
    expect(m.dependencies).toEqual([]);
  });
});

describe("repliement", () => {
  it("masque la descendance d'un recapitulatif replie", () => {
    const m = seedModel();
    const visible = visibleTasks(m.tasks, new Set(["sum"]));
    expect(visible.map((t) => t.id)).toEqual(["a", "sum", "hdr", "h1"]);
  });

  it("masque aussi sous un intertitre : meme relation de parente", () => {
    const m = seedModel();
    expect(visibleTasks(m.tasks, new Set(["hdr"])).map((t) => t.id)).toEqual([
      "a",
      "sum",
      "s1",
      "s2",
      "hdr",
    ]);
  });

  it("masque EN CASCADE sans qu'il faille replier chaque niveau", () => {
    const deep = recompute({
      projectStart: "2026-01-01",
      cycle: null,
      dependencies: [],
      tasks: [
        task("p", { type: "summary", durationDays: null }),
        task("c", { type: "summary", parentId: "p", durationDays: null }),
        task("g", { parentId: "c" }),
      ],
    });
    expect(visibleTasks(deep.tasks, new Set(["p"])).map((t) => t.id)).toEqual(["p"]);
  });

  it("ne propose le repliement que d'une ligne qui masque quelque chose", () => {
    const m = seedModel();
    const byId = (id: string) => m.tasks.find((t) => t.id === id)!;
    expect(isCollapsible(m.tasks, byId("sum"))).toBe(true);
    expect(isCollapsible(m.tasks, byId("hdr"))).toBe(true);
    expect(isCollapsible(m.tasks, byId("a"))).toBe(false);
    expect(isCollapsible(m.tasks, byId("s1"))).toBe(false);
  });

  it("compte les descendants masques", () => {
    expect(descendantCount(seedModel().tasks, "sum")).toBe(2);
    expect(descendantCount(seedModel().tasks, "a")).toBe(0);
  });
});
