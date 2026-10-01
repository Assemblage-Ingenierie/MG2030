import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, applyFilters, groupBySubject, sortActions } from "../filter";
import { NO_TIMELINE, resolveTimeline } from "../timeline";
import type { RoadmapActionRow, RoadmapPriority, RoadmapStatus } from "../types";

let seq = 0;
function action(over: Partial<RoadmapActionRow> = {}): RoadmapActionRow {
  seq += 1;
  return {
    id: `a${seq}`,
    subjectId: "s1",
    subjectName: "Project Steering",
    title: `action ${seq}`,
    status: "pending" as RoadmapStatus,
    priority: "medium" as RoadmapPriority,
    timeline: NO_TIMELINE,
    comments: null,
    sortOrder: seq * 10,
    assignees: [],
    ...over,
  };
}

describe("les actions terminees sont masquees par defaut", () => {
  it("les ecarte sans rien dire d'autre", () => {
    const rows = [action({ status: "done" }), action({ status: "pending" })];
    const out = applyFilters(rows, DEFAULT_FILTERS);
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0].status).toBe("pending");
  });

  it("ANNONCE combien elle en a masque", () => {
    // Masquer sans le dire ferait croire a une perte de donnees.
    const rows = [action({ status: "done" }), action({ status: "done" }), action()];
    expect(applyFilters(rows, DEFAULT_FILTERS).hiddenCompleted).toBe(2);
  });

  it("les montre toutes quand on le demande, et n'annonce plus rien", () => {
    const rows = [action({ status: "done" }), action()];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, showCompleted: true });
    expect(out.actions).toHaveLength(2);
    expect(out.hiddenCompleted).toBe(0);
  });

  it("ne compte QUE celles que le masquage ecarte, pas celles deja filtrees", () => {
    // Deux terminees, mais une seule survit au filtre de priorite : annoncer
    // « 2 masquees » serait un chiffre faux.
    const rows = [
      action({ status: "done", priority: "urgent" }),
      action({ status: "done", priority: "low" }),
      action({ status: "pending", priority: "urgent" }),
    ];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, priority: "urgent" });
    expect(out.hiddenCompleted).toBe(1);
    expect(out.actions).toHaveLength(1);
  });
});

describe("filtres", () => {
  it("filtre par priorite", () => {
    const rows = [action({ priority: "urgent" }), action({ priority: "low" })];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, priority: "urgent" }).actions).toHaveLength(1);
  });

  it("filtre par statut", () => {
    const rows = [action({ status: "in_progress" }), action({ status: "pending" })];
    expect(
      applyFilters(rows, { ...DEFAULT_FILTERS, status: "in_progress" }).actions,
    ).toHaveLength(1);
  });

  it("filtre par assignataire sur le LIBELLE, compte ou non", () => {
    // « G8 » n'a aucun compte : un filtre bati sur l'annuaire ne le trouverait
    // jamais. C'est tout l'interet du libelle libre.
    const rows = [
      action({ assignees: [{ label: "G8", appUserId: null }] }),
      action({ assignees: [{ label: "Kushtrim", appUserId: "u1" }] }),
    ];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, assignee: "G8" });
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0].assignees[0].label).toBe("G8");
  });

  it("separe les actions datees de celles qui ne le sont pas", () => {
    const rows = [action({ timeline: resolveTimeline("week", "2026-10-12") }), action()];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, date: "dated" }).actions).toHaveLength(1);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, date: "undated" }).actions).toHaveLength(1);
  });

  it("une fenetre ne retient jamais une action SANS date", () => {
    const rows = [action()];
    const out = applyFilters(rows, {
      ...DEFAULT_FILTERS,
      from: "2020-01-01",
      to: "2030-01-01",
    });
    expect(out.actions).toHaveLength(0);
  });

  it("les filtres se cumulent", () => {
    const rows = [
      action({ priority: "urgent", status: "pending" }),
      action({ priority: "urgent", status: "not_started" }),
    ];
    const out = applyFilters(rows, {
      ...DEFAULT_FILTERS,
      priority: "urgent",
      status: "pending",
    });
    expect(out.actions).toHaveLength(1);
  });
});

describe("regroupement par sujet", () => {
  it("conserve l'ordre d'arrivee des sujets", () => {
    const rows = [
      action({ subjectId: "s1", subjectName: "Project Steering" }),
      action({ subjectId: "s2", subjectName: "Student Center" }),
      action({ subjectId: "s1", subjectName: "Project Steering" }),
    ];
    const groups = groupBySubject(rows);
    expect(groups.map((g) => g.subjectName)).toEqual(["Project Steering", "Student Center"]);
    expect(groups[0].actions).toHaveLength(2);
  });

  it("fait DISPARAITRE un sujet qui n'a plus d'action visible", () => {
    // Un intertitre vide ferait croire a un chargement incomplet.
    const rows = [action({ subjectId: "s2", subjectName: "Student Center", status: "done" })];
    const visible = applyFilters(rows, DEFAULT_FILTERS).actions;
    expect(groupBySubject(visible)).toEqual([]);
  });
});

describe("tri", () => {
  it("la DATE prime sur la priorite", () => {
    // Une action moyenne due cette semaine demande une decision plus tot qu'une
    // urgente sans date.
    const urgentUndated = action({ priority: "urgent", timeline: NO_TIMELINE });
    const mediumDated = action({
      priority: "medium",
      timeline: resolveTimeline("week", "2026-10-12"),
    });
    const sorted = sortActions([urgentUndated, mediumDated]);
    expect(sorted[0]).toBe(mediumDated);
  });

  it("a date egale, l'urgence passe devant", () => {
    const tl = resolveTimeline("day", "2026-10-01");
    const low = action({ priority: "low", timeline: tl });
    const urgent = action({ priority: "urgent", timeline: tl });
    expect(sortActions([low, urgent])[0]).toBe(urgent);
  });

  it("une action sans priorite passe apres celles qui en ont une", () => {
    const tl = resolveTimeline("day", "2026-10-01");
    const none = action({ priority: null, timeline: tl });
    const low = action({ priority: "low", timeline: tl });
    expect(sortActions([none, low])[0]).toBe(low);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const rows = [action({ priority: "low" }), action({ priority: "urgent" })];
    const copy = [...rows];
    sortActions(rows);
    expect(rows).toEqual(copy);
  });
});
