// ============================================================
// Le planning RÉEL du projet, transcrit depuis seed/tasks.csv,
// seed/task_dependencies.csv et seed/task_constraints.csv.
//
// C'est la matière du test de fidélité : le moteur doit reproduire les 21 dates
// de fin du fichier Excel d'origine, à l'identique. Un test sur des données
// inventées prouverait que le moteur est cohérent avec lui-même ; celui-ci
// prouve que la PIU ne verra pas ses dates bouger en changeant d'outil.
//
// ⚠ `TV.2.1` et `SC.2.2` portent 20 jours, pas les 21 du CSV : correction
// GAPS 12, décidée le 19/08/2026. Sans elle, `end = start + durationDays`
// n'était vrai que sur 19 des 21 tâches datées, et le recalcul décalait toute
// la chaîne des training venues d'un jour.
// ============================================================

import type { ConstraintInput, DependencyInput, TaskInput } from "../types";

type Row = [
  wbs: string,
  type: TaskInput["type"],
  parent: string | null,
  days: number | null,
  expectedStart: string | null,
  expectedEnd: string | null,
];

/** Le sixième champ est l'ATTENDU, pas une entrée du moteur. */
const ROWS: Row[] = [
  ["TV.1",     "task",         null,     98,  "2026-07-01", "2026-10-07"],
  ["TV.2",     "summary",      null,     null, "2026-09-01", "2027-08-05"],
  ["TV.2.1",   "task",         "TV.2",   20,  "2026-09-01", "2026-09-21"],
  ["TV.2.2",   "task",         "TV.2",   14,  "2026-09-21", "2026-10-05"],
  ["TV.2.3",   "task",         "TV.2",   10,  "2026-10-05", "2026-10-15"],
  ["TV.2.4",   "task",         "TV.2",   42,  "2026-10-15", "2026-11-26"],
  ["TV.2.5",   "task",         "TV.2",   14,  "2026-11-26", "2026-12-10"],
  ["TV.2.6",   "task",         "TV.2",   28,  "2026-12-10", "2027-01-07"],
  ["TV.2.7",   "task",         "TV.2",   210, "2027-01-07", "2027-08-05"],
  ["TV.3",     "group_header", null,     null, null,        null],
  ["TV.3.1",   "summary",      "TV.3",   null, "2027-08-05", "2027-11-11"],
  ["TV.3.1.1", "task",         "TV.3.1", 56,  "2027-08-05", "2027-09-30"],
  ["TV.3.1.2", "task",         "TV.3.1", 14,  "2027-09-30", "2027-10-14"],
  ["TV.3.1.3", "task",         "TV.3.1", 28,  "2027-10-14", "2027-11-11"],
  ["TV.3.2",   "task",         "TV.3",   448, "2027-11-11", "2029-02-01"],
  ["SC.1",     "task",         null,     98,  "2026-07-01", "2026-10-07"],
  ["SC.2",     "summary",      null,     null, "2026-09-01", "2029-05-29"],
  ["SC.2.1",   "task",         "SC.2",   15,  "2026-10-07", "2026-10-22"],
  ["SC.2.2",   "task",         "SC.2",   20,  "2026-09-01", "2026-09-21"],
  ["SC.2.3",   "task",         "SC.2",   15,  "2026-09-21", "2026-10-06"],
  ["SC.2.4",   "task",         "SC.2",   10,  "2026-10-06", "2026-10-16"],
  ["SC.2.5",   "task",         "SC.2",   84,  "2026-10-22", "2027-01-14"],
  ["SC.2.6",   "task",         "SC.2",   14,  "2027-01-14", "2027-01-28"],
  ["SC.2.7",   "task",         "SC.2",   30,  "2027-01-28", "2027-02-27"],
  ["SC.2.8",   "task",         "SC.2",   822, "2027-02-27", "2029-05-29"],
  ["MS.1",     "milestone",    null,     null, "2029-09-01", "2029-09-01"],
  ["MS.2",     "milestone",    null,     null, "2030-01-01", "2030-01-01"],
];

/** Les jalons n'ont pas de prédécesseur : leur date est saisie en dur. */
const MILESTONE_ANCHORS: Record<string, string> = {
  "MS.1": "2029-09-01",
  "MS.2": "2030-01-01",
};

export const SEED_TASKS: TaskInput[] = ROWS.map(([wbs, type, parent, days], i) => ({
  id: wbs,
  wbsCode: wbs,
  type,
  parentId: parent,
  durationDays: days,
  startDateInput: MILESTONE_ANCHORS[wbs] ?? null,
  sortOrder: i,
}));

export const EXPECTED: Record<string, { start: string | null; end: string | null }> =
  Object.fromEntries(ROWS.map(([wbs, , , , start, end]) => [wbs, { start, end }]));

/** Les 19 précédences, toutes fin-début à décalage nul. */
const EDGES: [predecessor: string, successor: string][] = [
  ["TV.2.1", "TV.2.2"],
  ["TV.2.2", "TV.2.3"],
  ["TV.1", "TV.2.4"],      // convergence : MAX(I15, I26)
  ["TV.2.3", "TV.2.4"],    //     idem
  ["TV.2.4", "TV.2.5"],
  ["TV.2.5", "TV.2.6"],
  ["TV.2.6", "TV.2.7"],
  ["TV.2.7", "TV.3.1.1"],
  ["TV.3.1.1", "TV.3.1.2"],
  ["TV.3.1.2", "TV.3.1.3"],
  ["TV.3.1.3", "TV.3.2"],
  ["SC.1", "SC.2.1"],
  ["SC.2.2", "SC.2.3"],
  ["SC.2.3", "SC.2.4"],
  ["SC.1", "SC.2.5"],      // convergence : MAX(I15, I23)
  ["SC.2.1", "SC.2.5"],    //     idem
  ["SC.2.5", "SC.2.6"],
  ["SC.2.6", "SC.2.7"],
  ["SC.2.7", "SC.2.8"],
];

export const SEED_DEPENDENCIES: DependencyInput[] = EDGES.map(([p, s]) => ({
  predecessorId: p,
  successorId: s,
  type: "FS",
  lagDays: 0,
}));

/** Les 4 dates saisies en dur du fichier Excel, sans prédécesseur. */
export const SEED_CONSTRAINTS: ConstraintInput[] = [
  { taskId: "TV.1", kind: "start_no_earlier_than", date: "2026-07-01" },
  { taskId: "TV.2.1", kind: "start_no_earlier_than", date: "2026-09-01" },
  { taskId: "SC.1", kind: "start_no_earlier_than", date: "2026-07-01" },
  { taskId: "SC.2.2", kind: "start_no_earlier_than", date: "2026-09-01" },
];

export const PROJECT_START = "2026-07-01";
