import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  applyFilters,
  groupBySubject,
  sortActions,
  type RoadmapSort,
} from "../filter";
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
  it("les ecarte", () => {
    const rows = [action({ status: "done" }), action({ status: "pending" })];
    expect(applyFilters(rows, DEFAULT_FILTERS).actions).toHaveLength(1);
  });

  it("ANNONCE combien elle en a masque", () => {
    const rows = [action({ status: "done" }), action({ status: "done" }), action()];
    expect(applyFilters(rows, DEFAULT_FILTERS).hiddenCompleted).toBe(2);
  });

  it("ne compte QUE celles que le masquage ecarte, pas celles deja filtrees", () => {
    const rows = [
      action({ status: "done", priority: "urgent" }),
      action({ status: "done", priority: "low" }),
      action({ status: "pending", priority: "urgent" }),
    ];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, priorities: ["urgent"] });
    expect(out.hiddenCompleted).toBe(1);
    expect(out.actions).toHaveLength(1);
  });

  it("DEMANDER « terminees » dans le filtre les montre", () => {
    // Sans cette regle, cocher « Completed » rendait une liste vide : le filtre
    // les retenait, puis le masquage par defaut les retirait toutes.
    const rows = [action({ status: "done" }), action({ status: "pending" })];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, statuses: ["done"] });
    expect(out.actions).toHaveLength(1);
    expect(out.actions[0].status).toBe("done");
    expect(out.hiddenCompleted).toBe(0);
  });
});

describe("filtres multi-selection", () => {
  it("une liste vide ne filtre RIEN", () => {
    const rows = [action({ priority: "urgent" }), action({ priority: "low" })];
    expect(applyFilters(rows, DEFAULT_FILTERS).actions).toHaveLength(2);
  });

  it("plusieurs priorites s'additionnent (OU)", () => {
    const rows = [
      action({ priority: "urgent" }),
      action({ priority: "high" }),
      action({ priority: "low" }),
    ];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, priorities: ["urgent", "high"] });
    expect(out.actions).toHaveLength(2);
  });

  it("plusieurs statuts s'additionnent", () => {
    const rows = [
      action({ status: "blocked" }),
      action({ status: "in_progress" }),
      action({ status: "not_started" }),
    ];
    const out = applyFilters(rows, {
      ...DEFAULT_FILTERS,
      statuses: ["blocked", "in_progress"],
    });
    expect(out.actions).toHaveLength(2);
  });

  it("plusieurs assignataires s'additionnent, comptes ou entites", () => {
    const rows = [
      action({ assignees: [{ label: "G8", appUserId: null }] }),
      action({ assignees: [{ label: "AFD", appUserId: null }] }),
      action({ assignees: [{ label: "Kushtrim", appUserId: "u1" }] }),
    ];
    const out = applyFilters(rows, { ...DEFAULT_FILTERS, assignees: ["G8", "AFD"] });
    expect(out.actions).toHaveLength(2);
  });

  it("retient une action des qu'UN de ses assignataires correspond", () => {
    const rows = [
      action({
        assignees: [
          { label: "Kushtrim", appUserId: "u1" },
          { label: "AFD", appUserId: null },
        ],
      }),
    ];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, assignees: ["AFD"] }).actions).toHaveLength(1);
  });

  it("une action SANS priorite est ecartee des qu'on filtre sur une priorite", () => {
    const rows = [action({ priority: null })];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, priorities: ["low"] }).actions).toHaveLength(0);
  });

  it("separe les actions datees de celles qui ne le sont pas", () => {
    const rows = [action({ timeline: resolveTimeline("week", "2026-10-12") }), action()];
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, date: "dated" }).actions).toHaveLength(1);
    expect(applyFilters(rows, { ...DEFAULT_FILTERS, date: "undated" }).actions).toHaveLength(1);
  });

  it("une fenetre ne retient jamais une action SANS date", () => {
    const out = applyFilters([action()], {
      ...DEFAULT_FILTERS,
      from: "2020-01-01",
      to: "2030-01-01",
    });
    expect(out.actions).toHaveLength(0);
  });

  it("les filtres de colonnes differentes se cumulent (ET)", () => {
    const rows = [
      action({ priority: "urgent", status: "pending" }),
      action({ priority: "urgent", status: "not_started" }),
    ];
    const out = applyFilters(rows, {
      ...DEFAULT_FILTERS,
      priorities: ["urgent"],
      statuses: ["pending"],
    });
    expect(out.actions).toHaveLength(1);
  });
});

describe("regroupement par sujet", () => {
  const SUBJECTS = [
    { id: "s1", name: "Project Steering" },
    { id: "s2", name: "Student Center" },
    { id: "s3", name: "Training venues" },
    { id: "s4", name: "Training and capacity building" },
  ];

  it("suit l'ordre du REFERENTIEL, pas celui des actions", () => {
    const rows = [
      action({ subjectId: "s2", subjectName: "Student Center" }),
      action({ subjectId: "s1", subjectName: "Project Steering" }),
    ];
    expect(groupBySubject(rows, SUBJECTS).map((g) => g.subjectName)).toEqual([
      "Project Steering",
      "Student Center",
    ]);
  });

  it("ne laisse PAS une date decider du rang d'un sujet", () => {
    const rows = [
      action({
        subjectId: "s4",
        subjectName: "Training and capacity building",
        timeline: resolveTimeline("quarter", "2027-01-01"),
      }),
      action({ subjectId: "s3", subjectName: "Training venues", timeline: NO_TIMELINE }),
    ];
    expect(groupBySubject(sortActions(rows), SUBJECTS).map((g) => g.subjectName)).toEqual([
      "Training venues",
      "Training and capacity building",
    ]);
  });

  it("fait DISPARAITRE un sujet qui n'a plus d'action visible", () => {
    const rows = [action({ subjectId: "s2", subjectName: "Student Center", status: "done" })];
    const visible = applyFilters(rows, DEFAULT_FILTERS).actions;
    expect(groupBySubject(visible, SUBJECTS)).toEqual([]);
  });
});

describe("tri par defaut", () => {
  it("la DATE prime sur la priorite", () => {
    const urgentUndated = action({ priority: "urgent", timeline: NO_TIMELINE });
    const mediumDated = action({
      priority: "medium",
      timeline: resolveTimeline("week", "2026-10-12"),
    });
    expect(sortActions([urgentUndated, mediumDated])[0]).toBe(mediumDated);
  });

  it("a date egale, l'urgence passe devant", () => {
    const tl = resolveTimeline("day", "2026-10-01");
    const low = action({ priority: "low", timeline: tl });
    const urgent = action({ priority: "urgent", timeline: tl });
    expect(sortActions([low, urgent])[0]).toBe(urgent);
  });

  it("ne modifie pas le tableau d'origine", () => {
    const rows = [action({ priority: "low" }), action({ priority: "urgent" })];
    const copy = [...rows];
    sortActions(rows);
    expect(rows).toEqual(copy);
  });
});

describe("tri par colonne", () => {
  const asc = (column: RoadmapSort["column"]): RoadmapSort => ({ column, direction: "asc" });
  const desc = (column: RoadmapSort["column"]): RoadmapSort => ({ column, direction: "desc" });

  it("trie par intitule, dans les deux sens", () => {
    const a = action({ title: "Alpha" });
    const z = action({ title: "Zulu" });
    expect(sortActions([z, a], asc("action"))[0]).toBe(a);
    expect(sortActions([a, z], desc("action"))[0]).toBe(z);
  });

  it("trie par statut selon l'ordre D'AVANCEMENT, pas l'alphabet", () => {
    // « blocked » doit suivre « in_progress », alors que l'alphabet le mettrait
    // en tete.
    const blocked = action({ status: "blocked" });
    const notStarted = action({ status: "not_started" });
    expect(sortActions([blocked, notStarted], asc("status"))[0]).toBe(notStarted);
  });

  it("trie par priorite du plus pressant au moins", () => {
    const low = action({ priority: "low" });
    const urgent = action({ priority: "urgent" });
    expect(sortActions([low, urgent], asc("priority"))[0]).toBe(urgent);
  });

  it("range une valeur ABSENTE apres celles qui existent, dans les deux sens", () => {
    // Inverser le sens ne doit pas remonter les trous en tete de liste.
    const none = action({ priority: null });
    const low = action({ priority: "low" });
    expect(sortActions([none, low], asc("priority"))[0]).toBe(low);
    expect(sortActions([low, none], desc("priority"))[0]).toBe(low);
  });

  it("trie par premier assignataire", () => {
    const afd = action({ assignees: [{ label: "AFD", appUserId: null }] });
    const ta = action({ assignees: [{ label: "TA", appUserId: null }] });
    expect(sortActions([ta, afd], asc("assignee"))[0]).toBe(afd);
  });

  it("a colonne egale, l'ordre par defaut departage", () => {
    // Deux actions de meme statut se rangent encore par echeance.
    const tl = resolveTimeline("day", "2026-10-01");
    const dated = action({ status: "pending", timeline: tl });
    const undated = action({ status: "pending", timeline: NO_TIMELINE });
    expect(sortActions([undated, dated], asc("status"))[0]).toBe(dated);
  });
});
