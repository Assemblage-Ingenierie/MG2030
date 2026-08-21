import { describe, expect, it } from "vitest";
import { routeLink, ROW_H, type Bar } from "@/lib/gantt/layout";

function bar(over: Partial<Bar>): Bar {
  return {
    taskId: "t",
    wbsCode: "T",
    label: "T",
    type: "task",
    x: 0,
    y: 0,
    width: 100,
    height: 14,
    progressWidth: 0,
    depth: 0,
    status: "normal",
    isLate: false,
    diamond: false,
    rowIndex: 0,
    ...over,
  };
}

describe("tracé des flèches de précédence", () => {
  it("FIN-DEBUT SANS BATTEMENT : descend tout droit dans le dessus de la barre", () => {
    // Le cas normal : la fin du predecesseur et le debut du successeur sont au
    // meme x. C'est celui que l'ancien trace faisait contourner.
    const from = bar({ x: 0, width: 100, y: 7 });
    const to = bar({ x: 100, width: 80, y: 7 + ROW_H });
    const route = routeLink(from, to);

    expect(route.end).toBe("top");
    // Aucun point ne part a DROITE du debut du successeur : plus de detour.
    const maxX = Math.max(...route.points.map(([x]) => x));
    expect(maxX).toBeLessThanOrEqual(to.x + 3);
    // La pointe arrive sur le dessus de la barre, pas dans son flanc.
    const last = route.points[route.points.length - 1];
    expect(last[1]).toBe(to.y);
  });

  it("AVEC BATTEMENT : deux segments, entree par le flanc gauche", () => {
    const from = bar({ x: 0, width: 100, y: 7 });
    const to = bar({ x: 160, width: 80, y: 7 + ROW_H });
    const route = routeLink(from, to);

    expect(route.end).toBe("side");
    expect(route.points).toHaveLength(3);
    // Le coude est a la FIN du predecesseur, pas juste avant le successeur :
    // la verticale se lit comme « ici ca finit, ca enchaine ».
    expect(route.points[0]).toEqual([100, 14]);
    expect(route.points[1]).toEqual([100, 14 + ROW_H]);
    expect(route.points[2]).toEqual([160, 14 + ROW_H]);
  });

  it("CHEVAUCHEMENT : contourne par la gouttiere, seul cas ou le detour se justifie", () => {
    // Successeur commencant AVANT la fin du predecesseur : aller tout droit
    // traverserait les deux barres.
    const from = bar({ x: 0, width: 200, y: 7 });
    const to = bar({ x: 50, width: 80, y: 7 + ROW_H });
    const route = routeLink(from, to);

    expect(route.end).toBe("side");
    expect(route.points.length).toBeGreaterThan(3);
    // Le retour passe SOUS les deux barres.
    const detourY = Math.max(...route.points.map(([, y]) => y));
    expect(detourY).toBeGreaterThan(to.y + to.height);
  });

  it("un battement d'un pixel ne fabrique pas un segment plus court que sa pointe", () => {
    const from = bar({ x: 0, width: 100, y: 7 });
    const to = bar({ x: 101, width: 80, y: 7 + ROW_H });
    // 1 px de battement : on entre par le dessus, pas par un flanc invisible.
    expect(routeLink(from, to).end).toBe("top");
  });

  it("le seuil est franc a 10 pixels", () => {
    const from = bar({ x: 0, width: 100, y: 7 });
    expect(routeLink(from, bar({ x: 109, y: 7 + ROW_H })).end).toBe("top");
    expect(routeLink(from, bar({ x: 110, y: 7 + ROW_H })).end).toBe("side");
  });

  it("relie deux lignes non adjacentes sans changer de forme", () => {
    const from = bar({ x: 0, width: 100, y: 7 });
    const to = bar({ x: 160, width: 80, y: 7 + ROW_H * 5 });
    const route = routeLink(from, to);
    expect(route.points).toHaveLength(3);
    expect(route.points[1]).toEqual([100, 14 + ROW_H * 5]);
  });
});

// ── État des barres vis-à-vis d'aujourd'hui ─────────────────────────────────

import { buildLayout, type GanttTask } from "@/lib/gantt/layout";

const TODAY = "2026-08-20";

function statusOf(over: Partial<GanttTask>): string {
  const layout = buildLayout({
    tasks: [
      {
        id: "t",
        wbsCode: "T",
        activity: "T",
        type: "task",
        start: "2026-01-01",
        end: "2026-06-01",
        progressPct: null,
        depth: 0,
        contractCode: null,
        ...over,
      },
    ],
    dependencies: [],
    scale: "month",
    today: TODAY,
  });
  return layout.bars[0].status;
}

describe("retard constaté contre avancement non renseigné", () => {
  it("NON RENSEIGNE : fin passee, avancement inconnu — on n'en sait rien", () => {
    // Le cas de TOUT le plan aujourd'hui : aucune tache ne porte d'avancement.
    // L'ancienne regle les declarait toutes en retard.
    expect(statusOf({ progressPct: null })).toBe("unreported");
  });

  it("RETARD : fin passee, du travail fait, pas fini — un retard constate", () => {
    expect(statusOf({ progressPct: 40 })).toBe("late");
  });

  it("RETARD aussi a zero pour cent : quelqu'un a repondu « rien de fait »", () => {
    // Zero n'est pas l'absence de reponse : c'est une reponse.
    expect(statusOf({ progressPct: 0 })).toBe("late");
  });

  it("TERMINE : cent pour cent, meme apres la date", () => {
    expect(statusOf({ progressPct: 100 })).toBe("done");
  });

  it("NORMAL : fin a venir", () => {
    expect(statusOf({ end: "2027-01-01", progressPct: null })).toBe("normal");
  });

  it("ne juge ni les recapitulatifs ni les jalons", () => {
    expect(statusOf({ type: "summary" })).toBe("normal");
    expect(statusOf({ type: "milestone", start: "2026-06-01" })).toBe("normal");
  });

  it("isLate ne vaut QUE pour un retard constate", () => {
    const layout = buildLayout({
      tasks: [
        { id: "a", wbsCode: "A", activity: "A", type: "task", start: "2026-01-01", end: "2026-06-01", progressPct: null, depth: 0, contractCode: null },
        { id: "b", wbsCode: "B", activity: "B", type: "task", start: "2026-01-01", end: "2026-06-01", progressPct: 40, depth: 0, contractCode: null },
      ],
      dependencies: [],
      scale: "month",
      today: TODAY,
    });
    expect(layout.bars.map((b) => b.isLate)).toEqual([false, true]);
  });
});
