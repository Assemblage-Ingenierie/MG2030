// ============================================================
// lib/schedule/board-model.ts — le plan de charge comme MODÈLE PUR.
//
// ⚠ C'est la pièce qui supprime le lag, et l'idée tient en une phrase :
// LE MOTEUR TOURNE DANS LE NAVIGATEUR.
//
// Avant, chaque frappe validée partait au serveur, écrivait, recalculait,
// réécrivait, puis Next re-rendait la page entière. L'utilisateur attendait un
// aller-retour réseau pour voir une date bouger. Or le moteur est PUR — aucune
// base, aucun React, aucune bibliothèque de dates. Rien n'empêche de le faire
// tourner sur le poste : on applique l'opération au modèle, on recalcule tout
// le planning localement (27 tâches, une fraction de milliseconde), on affiche,
// et l'écriture serveur suit en arrière-plan.
//
// Conséquence heureuse : chaque opération devient une valeur. On peut donc
// empiler les états et offrir l'annulation, ce qu'une architecture
// « aller-retour par frappe » ne permettait pas.
//
// Module pur et testé : il ne connaît ni Supabase, ni React, ni le DOM.
// ============================================================

import { computeSchedule } from "./engine";
import { addDays } from "./dates";
import type {
  ConstraintInput,
  DependencyInput,
  IsoDate,
  TaskInput,
  TaskType,
} from "./types";

/** Une ligne du plan, telle que la grille et le diagramme la lisent. */
export interface ModelTask {
  id: string;
  wbsCode: string;
  activity: string;
  type: TaskType;
  parentId: string | null;
  durationDays: number | null;
  /** Ancre saisie à la main : la date est figée, elle ne suit plus les précédences. */
  startAnchor: IsoDate | null;
  constraintDate: IsoDate | null;
  progressPct: number | null;
  ownerId: string | null;
  ownerName: string | null;
  contractId: string | null;
  contractCode: string | null;
  siteId: string | null;
  siteCode: string | null;
  subproject: "athletes_village" | "training_venues" | null;
  sortOrder: number;

  // ── Champs CALCULÉS, réécrits par `recompute` ────────────────────────────
  start: IsoDate | null;
  end: IsoDate | null;
  depth: number;
  driver: string | null;
  drivingPredecessor: string | null;
  /** Vrai si la date calculée diffère de celle stockée en base. */
  drifted: boolean;
}

export interface BoardModel {
  /** Ordonnées : l'ordre du tableau EST l'ordre d'affichage. */
  tasks: ModelTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  projectStart: IsoDate;
  /** Cycle détecté : le planning n'est pas calculable, on le dit. */
  cycle: string[] | null;
}

// ── Recalcul ────────────────────────────────────────────────────────────────

/**
 * Recalcule tout le planning et réécrit les champs dérivés.
 *
 * On recalcule TOUT plutôt que la seule descendance touchée. À 27 tâches — et
 * même à 2000, mesuré dans les tests du moteur — c'est instantané, et un
 * recalcul partiel demanderait de savoir exactement ce qui dépend de quoi :
 * une occasion de bug pour un gain nul.
 */
export function recompute(model: BoardModel): BoardModel {
  const tasks = ordered(model.tasks);

  const inputs: TaskInput[] = tasks.map((t, i) => ({
    id: t.id,
    wbsCode: t.wbsCode,
    type: t.type,
    parentId: t.parentId,
    durationDays: t.durationDays,
    startDateInput: t.startAnchor,
    sortOrder: i,
  }));

  const dependencies: DependencyInput[] = model.dependencies.map((d) => ({
    predecessorId: d.predecessorId,
    successorId: d.successorId,
    type: "FS",
    lagDays: 0,
  }));

  const constraints: ConstraintInput[] = tasks
    .filter((t) => t.constraintDate !== null)
    .map((t) => ({
      taskId: t.id,
      kind: "start_no_earlier_than" as const,
      date: t.constraintDate!,
    }));

  const depthOf = buildDepth(tasks);

  let windows: Map<string, { start: IsoDate | null; end: IsoDate | null; driver: string; drivingPredecessor: string | null }> | null =
    null;
  let cycle: string[] | null = null;

  try {
    windows = computeSchedule({
      tasks: inputs,
      dependencies,
      constraints,
      projectStart: model.projectStart,
    }).windows;
  } catch (error) {
    // Un cycle rend le planning incalculable. On garde les dates précédentes et
    // on signale — une grille vidée se lirait comme une panne.
    cycle = (error as { cycle?: string[] }).cycle ?? [];
  }

  return {
    ...model,
    cycle,
    tasks: tasks.map((task, i) => {
      const w = windows?.get(task.id);
      return {
        ...task,
        sortOrder: i,
        depth: depthOf.get(task.id) ?? 0,
        start: w ? w.start : task.start,
        end: w ? w.end : task.end,
        driver: w ? w.driver : task.driver,
        drivingPredecessor: w ? w.drivingPredecessor : task.drivingPredecessor,
        drifted: task.drifted,
      };
    }),
  };
}

/** Tri hiérarchique : chaque parent immédiatement suivi de ses descendants. */
export function ordered(tasks: ModelTask[]): ModelTask[] {
  const children = new Map<string | null, ModelTask[]>();
  for (const task of tasks) {
    const key = task.parentId;
    const list = children.get(key);
    if (list) list.push(task);
    else children.set(key, [task]);
  }
  for (const list of children.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);

  const out: ModelTask[] = [];
  const walk = (parentId: string | null, guard: number) => {
    if (guard > 50) return;
    for (const task of children.get(parentId) ?? []) {
      out.push(task);
      walk(task.id, guard + 1);
    }
  };
  walk(null, 0);

  // Une tâche dont le parent a disparu ne doit pas s'évaporer de l'écran.
  if (out.length < tasks.length) {
    const seen = new Set(out.map((t) => t.id));
    for (const task of tasks) if (!seen.has(task.id)) out.push(task);
  }
  return out;
}

function buildDepth(tasks: ModelTask[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depth = new Map<string, number>();
  for (const task of tasks) {
    let d = 0;
    let cursor = task.parentId;
    let guard = 0;
    while (cursor && guard++ < 50) {
      d++;
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    depth.set(task.id, d);
  }
  return depth;
}

// ── Numérotation de ligne ───────────────────────────────────────────────────

/**
 * Numéro de ligne, 1 à n, dans l'ordre d'affichage.
 *
 * C'est LA clé que l'utilisateur manipule pour les précédences, comme sous
 * MS Project. Les codes WBS restent la clé fonctionnelle en base — ils
 * viennent du fichier source et servent aux rapports — mais personne ne veut
 * taper « TV.3.1.2 » pour lier deux lignes voisines.
 *
 * La numérotation est DÉRIVÉE de l'ordre : déplacer une ligne renumérote tout,
 * et les liens suivent parce qu'ils sont stockés par identifiant, jamais par
 * numéro.
 */
export function rowNumbers(tasks: ModelTask[]): Map<string, number> {
  return new Map(tasks.map((task, i) => [task.id, i + 1]));
}

/** Précédences d'une tâche, exprimées en numéros de ligne triés. */
export function predecessorRows(
  model: BoardModel,
  taskId: string,
  rows: Map<string, number>,
): number[] {
  return model.dependencies
    .filter((d) => d.successorId === taskId)
    .map((d) => rows.get(d.predecessorId))
    .filter((n): n is number => n !== undefined)
    .sort((a, b) => a - b);
}

// ── Opérations ──────────────────────────────────────────────────────────────

const patch = (
  model: BoardModel,
  taskId: string,
  change: Partial<ModelTask>,
): BoardModel => ({
  ...model,
  tasks: model.tasks.map((t) => (t.id === taskId ? { ...t, ...change } : t)),
});

export function setField(
  model: BoardModel,
  taskId: string,
  change: Partial<ModelTask>,
): BoardModel {
  return recompute(patch(model, taskId, change));
}

/**
 * Remplace les précédences, désignées par NUMÉRO DE LIGNE.
 *
 * Rend une erreur nommée plutôt qu'un modèle silencieusement inchangé : un
 * numéro hors bornes est une faute de frappe, et l'ignorer laisserait croire
 * que le lien a été posé.
 */
export function setPredecessorRows(
  model: BoardModel,
  taskId: string,
  wanted: number[],
): { ok: true; model: BoardModel } | { ok: false; error: string; detail?: string } {
  const tasks = ordered(model.tasks);
  const self = tasks.findIndex((t) => t.id === taskId);
  if (self === -1) return { ok: false, error: "unknownTask" };

  const out: string[] = [];
  const bad: number[] = [];
  for (const n of [...new Set(wanted)]) {
    if (!Number.isInteger(n) || n < 1 || n > tasks.length) {
      bad.push(n);
      continue;
    }
    if (n - 1 === self) return { ok: false, error: "selfPredecessor" };
    out.push(tasks[n - 1].id);
  }
  if (bad.length > 0) {
    return { ok: false, error: "unknownPredecessor", detail: bad.join(", ") };
  }

  const next: BoardModel = {
    ...model,
    dependencies: [
      ...model.dependencies.filter((d) => d.successorId !== taskId),
      ...out.map((predecessorId) => ({ predecessorId, successorId: taskId })),
    ],
  };

  // Le cycle est détecté par le recalcul lui-même : inutile de le rechercher.
  const computed = recompute(next);
  if (computed.cycle !== null) {
    return { ok: false, error: "cycle", detail: cycleLabel(computed, computed.cycle) };
  }
  return { ok: true, model: computed };
}

function cycleLabel(model: BoardModel, cycle: string[]): string {
  const rows = rowNumbers(ordered(model.tasks));
  return cycle.map((id) => `#${rows.get(id) ?? "?"}`).join(" → ");
}

/**
 * Déplace une tâche d'un cran, en restant DANS SA FRATRIE.
 *
 * Changer de parent en montant serait un autre geste — reparenter — et le
 * confondre avec un déplacement ferait sauter des tâches d'un récapitulatif à
 * l'autre par accident. Une tâche déplacée emporte ses descendants.
 */
export function moveTask(
  model: BoardModel,
  taskId: string,
  direction: -1 | 1,
): BoardModel | null {
  const tasks = ordered(model.tasks);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const siblings = tasks.filter((t) => t.parentId === task.parentId);
  const index = siblings.findIndex((t) => t.id === taskId);
  const target = index + direction;
  if (target < 0 || target >= siblings.length) return null;

  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

  // On renumérote la fratrie par pas de 10 : cela laisse de la place pour une
  // insertion ultérieure sans toucher aux voisins.
  const rank = new Map(reordered.map((t, i) => [t.id, i * 10]));
  return recompute({
    ...model,
    tasks: model.tasks.map((t) =>
      rank.has(t.id) ? { ...t, sortOrder: rank.get(t.id)! } : t,
    ),
  });
}

/** Déplace une tâche à la position d'une autre, par glisser-déposer. */
export function moveTaskTo(
  model: BoardModel,
  taskId: string,
  beforeTaskId: string,
): BoardModel | null {
  const tasks = ordered(model.tasks);
  const task = tasks.find((t) => t.id === taskId);
  const anchor = tasks.find((t) => t.id === beforeTaskId);
  if (!task || !anchor || task.id === anchor.id) return null;
  // Hors fratrie : on refuse plutôt que de reparenter à l'insu de l'utilisateur.
  if (task.parentId !== anchor.parentId) return null;

  const siblings = tasks.filter((t) => t.parentId === task.parentId && t.id !== taskId);
  const at = siblings.findIndex((t) => t.id === beforeTaskId);
  siblings.splice(at === -1 ? siblings.length : at, 0, task);

  const rank = new Map(siblings.map((t, i) => [t.id, i * 10]));
  return recompute({
    ...model,
    tasks: model.tasks.map((t) =>
      rank.has(t.id) ? { ...t, sortOrder: rank.get(t.id)! } : t,
    ),
  });
}

/** Retire une tâche ET ses descendants, ainsi que les liens qui y menaient. */
export function removeTask(model: BoardModel, taskId: string): BoardModel {
  const doomed = new Set<string>([taskId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const task of model.tasks) {
      if (task.parentId && doomed.has(task.parentId) && !doomed.has(task.id)) {
        doomed.add(task.id);
        grew = true;
      }
    }
  }
  return recompute({
    ...model,
    tasks: model.tasks.filter((t) => !doomed.has(t.id)),
    dependencies: model.dependencies.filter(
      (d) => !doomed.has(d.predecessorId) && !doomed.has(d.successorId),
    ),
  });
}

/** Insère une tâche déjà créée en base, à la fin de sa fratrie. */
export function insertTask(model: BoardModel, task: ModelTask): BoardModel {
  const siblings = model.tasks.filter((t) => t.parentId === task.parentId);
  const last = siblings.reduce((max, t) => Math.max(max, t.sortOrder), -10);
  return recompute({
    ...model,
    tasks: [...model.tasks, { ...task, sortOrder: last + 10 }],
  });
}

// ── Règles d'édition ────────────────────────────────────────────────────────

/**
 * Une tâche est-elle PILOTÉE par ses précédences ?
 *
 * Si oui, sa date de début n'est pas une donnée mais un résultat : elle vaut la
 * fin du prédécesseur le plus tardif. La laisser modifiable donnait un plan
 * incohérent — on pouvait avancer le début d'une tâche sans que son
 * prédécesseur bouge, et le lien affiché ne correspondait plus à rien.
 *
 * Pour détacher une tâche, on enlève son lien. C'est explicite, et réversible.
 */
export function isDrivenByPredecessor(model: BoardModel, taskId: string): boolean {
  return model.dependencies.some((d) => d.successorId === taskId);
}

/**
 * Fin attendue d'une tâche, à titre de contrôle.
 *
 * `end` est TOUJOURS début + durée, convention de fin exclusive : `end` est le
 * jour où le successeur commence. Cette fonction existe pour que les tests
 * l'affirment, pas pour que le rendu la recalcule.
 */
export function expectedEnd(task: ModelTask): IsoDate | null {
  if (task.start === null || task.durationDays === null) return null;
  return addDays(task.start, task.durationDays);
}

// ── Repliement ──────────────────────────────────────────────────────────────

/**
 * Lignes visibles, une fois les récapitulatifs et intertitres repliés.
 *
 * Un intertitre porte ses enfants par la MÊME relation de parenté qu'un
 * récapitulatif — vérifié en base : TV.3.1 et TV.3.2 ont bien TV.3 pour parent.
 * Le repliement est donc purement hiérarchique, sans cas particulier. Ce qui
 * distingue les deux types n'est pas la structure mais l'AGRÉGATION : un
 * intertitre ne porte aucune date et n'agrège pas ses enfants
 * (docs/SCHEMA.md §5.2).
 *
 * On masque en cascade : replier un récapitulatif masque aussi les enfants de
 * ses enfants, sans qu'il faille les replier un à un.
 */
export function visibleTasks(tasks: ModelTask[], collapsed: Set<string>): ModelTask[] {
  const hidden = new Set<string>();
  const out: ModelTask[] = [];

  // `tasks` est en ordre hiérarchique : un parent précède toujours ses
  // enfants, donc une seule passe suffit.
  for (const task of tasks) {
    if (task.parentId !== null && hidden.has(task.parentId)) {
      hidden.add(task.id);
      continue;
    }
    out.push(task);
    if (collapsed.has(task.id)) hidden.add(task.id);
  }
  return out;
}

/** Une ligne peut-elle se replier ? Seulement si elle masque quelque chose. */
export function isCollapsible(tasks: ModelTask[], task: ModelTask): boolean {
  return tasks.some((t) => t.parentId === task.id);
}

/** Nombre de descendants masqués, pour le dire sur la ligne repliée. */
export function descendantCount(tasks: ModelTask[], taskId: string): number {
  const doomed = new Set<string>([taskId]);
  let n = 0;
  for (const task of tasks) {
    if (task.parentId !== null && doomed.has(task.parentId)) {
      doomed.add(task.id);
      n++;
    }
  }
  return n;
}
