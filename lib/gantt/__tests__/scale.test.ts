import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildTicks,
  isoWeek,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  suggestScale,
} from "../scale";
import { buildLayout, type GanttTask } from "../layout";

describe("bornes de periode", () => {
  it("aligne sur le lundi", () => {
    // 2026-09-01 est un mardi.
    expect(startOfWeek("2026-09-01")).toBe("2026-08-31");
    expect(startOfWeek("2026-08-31")).toBe("2026-08-31");
    // 2026-09-06 est un dimanche : il appartient a la semaine du 31/08.
    expect(startOfWeek("2026-09-06")).toBe("2026-08-31");
  });

  it("aligne sur le mois et le trimestre", () => {
    expect(startOfMonth("2026-09-17")).toBe("2026-09-01");
    expect(startOfQuarter("2026-09-17")).toBe("2026-07-01");
    expect(startOfQuarter("2026-01-01")).toBe("2026-01-01");
    expect(startOfQuarter("2026-12-31")).toBe("2026-10-01");
  });

  it("ajoute des mois en franchissant l'annee", () => {
    expect(addMonths("2026-11-01", 3)).toBe("2027-02-01");
    expect(addMonths("2026-01-01", -1)).toBe("2025-12-01");
    expect(addMonths("2026-10-01", 12)).toBe("2027-10-01");
  });

  it("calcule la semaine ISO", () => {
    // 2026-01-01 est un jeudi : semaine 1.
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2026-07-01")).toBe(27);
  });
});

describe("graduations", () => {
  it("couvre la plage sans trou ni chevauchement", () => {
    const { ticks, totalDays } = buildTicks("month", "2026-07-01", "2027-08-05");
    // Chaque graduation commence ou la precedente finit.
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].offsetDays).toBe(ticks[i - 1].offsetDays + ticks[i - 1].spanDays);
    }
    expect(ticks[0].offsetDays).toBe(0);
    const last = ticks[ticks.length - 1];
    expect(totalDays).toBe(last.offsetDays + last.spanDays);
    // Juillet 2026 -> aout 2027 : 14 mois.
    expect(ticks.length).toBe(14);
  });

  it("aligne l'origine sur le debut de periode, pas sur la premiere date", () => {
    // Une frise mensuelle demarrant un 17 decalerait toutes les colonnes.
    const { origin } = buildTicks("month", "2026-09-17", "2026-12-31");
    expect(origin).toBe("2026-09-01");
  });

  it("marque les graduations fortes", () => {
    const { ticks } = buildTicks("month", "2026-11-01", "2027-03-01");
    const janvier = ticks.find((t) => t.date === "2027-01-01");
    expect(janvier?.major).toBe(true);
    expect(ticks.find((t) => t.date === "2026-11-01")?.major).toBe(false);
  });

  it("choisit une echelle adaptee a la duree", () => {
    expect(suggestScale(30)).toBe("day");
    expect(suggestScale(200)).toBe("week");
    expect(suggestScale(900)).toBe("month");
    expect(suggestScale(3000)).toBe("quarter");
  });
});

// ── Mise en page ────────────────────────────────────────────────────────────

const task = (over: Partial<GanttTask> & { id: string }): GanttTask => ({
  wbsCode: over.id,
  activity: over.id,
  type: "task",
  start: "2026-07-01",
  end: "2026-07-31",
  progressPct: null,
  depth: 0,
  contractCode: null,
  ...over,
});

describe("mise en page du Gantt", () => {
  it("place les barres proportionnellement a leur duree", () => {
    const layout = buildLayout({
      tasks: [
        task({ id: "A", start: "2026-07-01", end: "2026-07-31" }),
        task({ id: "B", start: "2026-08-01", end: "2026-08-15" }),
      ],
      dependencies: [],
      scale: "day",
    });

    const [a, b] = layout.bars;
    // 30 jours contre 14 : le rapport des largeurs doit etre exact.
    expect(b.width / a.width).toBeCloseTo(14 / 30, 5);
    expect(a.x).toBe(0);
  });

  it("ne dessine AUCUNE barre pour un intertitre", () => {
    const layout = buildLayout({
      tasks: [
        task({ id: "entete", type: "group_header", start: null, end: null }),
        task({ id: "enfant" }),
      ],
      dependencies: [],
      scale: "week",
    });

    // L'intertitre occupe une ligne...
    expect(layout.rows).toHaveLength(2);
    // ... mais ne produit pas de barre.
    expect(layout.bars).toHaveLength(1);
    expect(layout.bars[0].taskId).toBe("enfant");
  });

  it("rend un jalon en losange, sans largeur", () => {
    const layout = buildLayout({
      tasks: [task({ id: "MS", type: "milestone", start: "2029-09-01", end: "2029-09-01" })],
      dependencies: [],
      scale: "month",
    });
    expect(layout.bars[0].diamond).toBe(true);
    expect(layout.bars[0].width).toBe(0);
  });

  it("trace une fleche en DEUX SEGMENTS quand le successeur suit", () => {
    const layout = buildLayout({
      tasks: [
        task({ id: "A", start: "2026-07-01", end: "2026-07-15" }),
        task({ id: "B", start: "2026-08-01", end: "2026-08-15" }),
      ],
      dependencies: [{ predecessorId: "A", successorId: "B" }],
      scale: "day",
    });

    expect(layout.links).toHaveLength(1);
    const pts = layout.links[0].points;
    // Trois points, donc deux segments : le coude est a la FIN de A, et non
    // juste avant B. L'ancien trace en comptait quatre et partait a droite
    // avant de revenir a gauche — il faisait le tour (voir lib/gantt/layout.ts).
    expect(pts).toHaveLength(3);
    expect(layout.links[0].end).toBe("side");
    expect(pts[0][0]).toBeCloseTo(layout.bars[0].x + layout.bars[0].width, 5);
    expect(pts[1][0]).toBeCloseTo(layout.bars[0].x + layout.bars[0].width, 5);
    expect(pts[2][0]).toBeCloseTo(layout.bars[1].x, 5);
  });

  it("contourne par-dessous quand le successeur chevauche", () => {
    const layout = buildLayout({
      tasks: [
        task({ id: "A", start: "2026-07-01", end: "2026-08-31" }),
        task({ id: "B", start: "2026-07-10", end: "2026-07-20" }),
      ],
      dependencies: [{ predecessorId: "A", successorId: "B" }],
      scale: "day",
    });
    // Six points : le trace en Z, pour ne pas traverser les barres.
    expect(layout.links[0].points).toHaveLength(6);
  });

  it("marque une tache en retard, jamais un recapitulatif", () => {
    const layout = buildLayout({
      tasks: [
        task({ id: "enRetard", start: "2026-01-01", end: "2026-02-01", progressPct: 40 }),
        task({ id: "finie", start: "2026-01-01", end: "2026-02-01", progressPct: 100 }),
        task({ id: "recap", type: "summary", start: "2026-01-01", end: "2026-02-01" }),
      ],
      dependencies: [],
      scale: "month",
      today: "2026-06-01",
    });

    expect(layout.bars.find((b) => b.taskId === "enRetard")!.isLate).toBe(true);
    expect(layout.bars.find((b) => b.taskId === "finie")!.isLate).toBe(false);
    // Un recapitulatif n'est pas « en retard » : ses enfants le sont.
    expect(layout.bars.find((b) => b.taskId === "recap")!.isLate).toBe(false);
  });

  it("positionne les reperes de marge et d'echeance", () => {
    const layout = buildLayout({
      tasks: [task({ id: "A", start: "2026-07-01", end: "2029-05-29" })],
      dependencies: [],
      scale: "quarter",
      bufferStart: "2029-09-01",
      deadline: "2030-01-01",
    });
    expect(layout.bufferX).not.toBeNull();
    expect(layout.deadlineX).not.toBeNull();
    // L'echeance est posterieure au debut de la marge.
    expect(layout.deadlineX!).toBeGreaterThan(layout.bufferX!);
  });

  it("accepte un planning sans aucune tache datee", () => {
    const layout = buildLayout({
      tasks: [task({ id: "vide", start: null, end: null })],
      dependencies: [],
      scale: "month",
    });
    expect(layout.bars).toHaveLength(0);
    expect(layout.rows).toHaveLength(1);
  });
});
