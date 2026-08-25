// ============================================================
// lib/schedule/engine.ts — recalcul en cascade des dates.
//
// C'est LA valeur ajoutée par rapport à Excel (brief §7) : le glissement d'une
// tâche amont se propage à l'aval, convergences comprises.
//
// RÈGLES, toutes vérifiées sur le seed réel (voir __tests__/seed-fidelity) :
//
//   group_header  → aucune date. C'est un intertitre, pas un récapitulatif.
//                   Confirmé par TV.3, sans dates alors que ses enfants
//                   couvrent 18 mois.
//   summary       → start = MIN(enfants), end = MAX(enfants).
//   milestone     → start = end, durée nulle.
//   task          → start = MAX(ancre, contraintes, fins des prédécesseurs + décalage)
//                   end   = start + durationDays
//
// Le MAX est le cas nominal, pas une exception : deux tâches du seed ont deux
// prédécesseurs (TV.2.4 et SC.2.5, formules `MAX` dans le fichier source).
// ============================================================

import { addDays, maxDate, minDate } from "./dates";
import { topologicalOrder } from "./topo";
import {
  UnsupportedDependencyError,
  type IsoDate,
  type ScheduleInput,
  type ScheduleResult,
  type TaskInput,
  type TaskWindow,
} from "./types";

/** Contraintes qui repoussent le DÉBUT au plus tôt. */
const START_FLOOR: ReadonlySet<string> = new Set([
  "start_no_earlier_than",
  "must_start_on",
]);

export function computeSchedule(input: ScheduleInput): ScheduleResult {
  const { tasks, dependencies, constraints, projectStart } = input;

  const byId = new Map<string, TaskInput>(tasks.map((t) => [t.id, t]));
  const label = (id: string) => byId.get(id)?.wbsCode ?? id;

  // Refus explicite plutôt qu'un décalage silencieux : un SS traité comme un FS
  // resterait invisible jusqu'à la première dérive réelle du planning.
  for (const dep of dependencies) {
    if (dep.type !== "FS") throw new UnsupportedDependencyError(dep.type);
  }

  // Index : prédécesseurs entrants, contraintes, enfants.
  const incoming = new Map<string, typeof dependencies>();
  for (const dep of dependencies) {
    if (!byId.has(dep.predecessorId) || !byId.has(dep.successorId)) continue;
    const list = incoming.get(dep.successorId);
    if (list) list.push(dep);
    else incoming.set(dep.successorId, [dep]);
  }

  const floors = new Map<string, IsoDate>();
  for (const c of constraints) {
    if (!START_FLOOR.has(c.kind)) continue;
    floors.set(c.taskId, maxDate(floors.get(c.taskId) ?? null, c.date)!);
  }

  const children = new Map<string, TaskInput[]>();
  for (const t of tasks) {
    if (!t.parentId) continue;
    const list = children.get(t.parentId);
    if (list) list.push(t);
    else children.set(t.parentId, [t]);
  }

  const order = topologicalOrder(
    tasks.map((t) => t.id),
    dependencies,
    label,
  );

  const windows = new Map<string, TaskWindow>();

  // ── Passe 1 : les feuilles, en ordre topologique ────────────────────────
  for (const id of order) {
    const task = byId.get(id)!;

    if (task.type === "group_header") {
      windows.set(id, blank(task, "none"));
      continue;
    }

    // Les récapitulatifs sont agrégés en passe 2 : leurs enfants ne sont pas
    // nécessairement calculés à ce stade de l'ordre topologique.
    if (task.type === "summary") continue;

    let start: IsoDate | null = null;
    let driver: TaskWindow["driver"] = "none";
    let drivingPredecessor: string | null = null;

    // Prédécesseurs : le plus TARDIF gagne. C'est la convergence.
    for (const dep of incoming.get(id) ?? []) {
      const predecessor = windows.get(dep.predecessorId);
      if (!predecessor?.end) continue;
      const candidate = addDays(predecessor.end, dep.lagDays);
      if (maxDate(start, candidate) === candidate && candidate !== start) {
        start = candidate;
        driver = "predecessor";
        drivingPredecessor = predecessor.wbsCode;
      } else if (start === null) {
        start = candidate;
        driver = "predecessor";
        drivingPredecessor = predecessor.wbsCode;
      }
    }

    // Contrainte « pas avant » : elle repousse, jamais elle n'avance.
    const floor = floors.get(id);
    if (floor && maxDate(start, floor) === floor && floor !== start) {
      start = floor;
      driver = "constraint";
      drivingPredecessor = null;
    } else if (floor && start === null) {
      start = floor;
      driver = "constraint";
    }

    // ── Ancre saisie ────────────────────────────────────────────────────
    //
    // ⚠ ELLE NE PRIME QUE SUR UNE TÂCHE SANS PRÉDÉCESSEUR.
    //
    // Elle primait sur tout, y compris les précédences. Conséquence observée
    // en production : trois tâches liées portaient une ancre qui contredisait
    // leur prédécesseur — « AFD's NoN » commençait 23 jours AVANT la fin de la
    // validation qu'elle attend. La flèche était dessinée, la dépendance
    // existait en base, et le calcul l'ignorait sans le dire. Pire, la cascade
    // MOURAIT là : tout l'aval repartait d'une date fausse.
    //
    // Une dépendance fin-début est une affirmation sur le déroulement du
    // projet ; une date saisie ne peut pas la contredire en silence. Pour
    // figer une date MALGRÉ un lien, on pose une contrainte « pas avant »,
    // traitée juste au-dessus : elle repousse sans jamais avancer, donc elle
    // se combine avec la précédence au lieu de l'effacer.
    if (task.startDateInput && !incoming.has(id)) {
      start = task.startDateInput;
      driver = "input";
      drivingPredecessor = null;
    }

    if (start === null) {
      start = projectStart;
      driver = "project-start";
    }

    const duration = task.type === "milestone" ? 0 : (task.durationDays ?? 0);
    windows.set(id, {
      id,
      wbsCode: task.wbsCode,
      type: task.type,
      start,
      end: addDays(start, duration),
      durationDays: task.type === "milestone" ? null : task.durationDays,
      driver,
      drivingPredecessor,
    });
  }

  // ── Passe 2 : les récapitulatifs, du plus profond au plus haut ──────────
  // Un récapitulatif peut contenir un récapitulatif : on remonte par
  // profondeur décroissante pour que les enfants soient toujours résolus.
  const summaries = tasks
    .filter((t) => t.type === "summary")
    .map((t) => ({ task: t, depth: depthOf(t, byId) }))
    .sort((a, b) => b.depth - a.depth);

  for (const { task } of summaries) {
    let start: IsoDate | null = null;
    let end: IsoDate | null = null;

    for (const child of children.get(task.id) ?? []) {
      const w = windows.get(child.id);
      if (!w) continue;
      start = minDate(start, w.start);
      end = maxDate(end, w.end);
    }

    windows.set(task.id, {
      id: task.id,
      wbsCode: task.wbsCode,
      type: "summary",
      start,
      end,
      durationDays: null,
      driver: start === null ? "none" : "children",
      drivingPredecessor: null,
    });
  }

  return { windows, order };
}

function blank(task: TaskInput, driver: TaskWindow["driver"]): TaskWindow {
  return {
    id: task.id,
    wbsCode: task.wbsCode,
    type: task.type,
    start: null,
    end: null,
    durationDays: null,
    driver,
    drivingPredecessor: null,
  };
}

/** Profondeur hiérarchique. Bornée pour ne pas boucler sur une donnée corrompue. */
function depthOf(task: TaskInput, byId: Map<string, TaskInput>): number {
  let depth = 0;
  let current = task;
  while (current.parentId && depth < 100) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
    depth++;
  }
  return depth;
}

/**
 * Sous-graphe aval d'une tâche, elle comprise.
 *
 * Sert au recalcul INCRÉMENTAL : modifier une durée ne doit pas relancer le
 * calcul sur l'ensemble du planning. Avec quelques centaines de tâches
 * l'économie est théorique, mais elle rend aussi le geste explicable —
 * « ces N tâches ont bougé » plutôt que « le planning a été recalculé ».
 */
export function downstreamOf(
  taskId: string,
  dependencies: { predecessorId: string; successorId: string }[],
): Set<string> {
  const successors = new Map<string, string[]>();
  for (const dep of dependencies) {
    const list = successors.get(dep.predecessorId);
    if (list) list.push(dep.successorId);
    else successors.set(dep.predecessorId, [dep.successorId]);
  }

  const reached = new Set<string>([taskId]);
  const queue = [taskId];
  while (queue.length > 0) {
    for (const next of successors.get(queue.shift()!) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}
