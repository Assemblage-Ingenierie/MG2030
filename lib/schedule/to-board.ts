// ============================================================
// lib/schedule/to-board.ts — du PAYLOAD de la base au MODÈLE du tableau.
//
// Ce passage était écrit à l'identique dans la page du plan de charge, et la
// page d'impression en avait besoin mot pour mot. Deux copies d'une conversion
// de quarante lignes, c'est deux endroits où ajouter un champ — et un seul
// qu'on pense à mettre à jour.
//
// Pur : aucune requête, aucun `server-only`. Il se teste, et il tourne aussi
// bien sur le serveur que dans le navigateur.
// ============================================================

import { recompute, type BoardModel, type ModelTask } from "./board-model";
import type { SchedulePayload } from "@/lib/queries/schedule";

export interface ContractRef {
  id: string;
  contractCode: string;
}

/**
 * Construit le modèle et le RECALCULE une fois.
 *
 * Le recalcul a lieu ici, côté serveur, pour que le premier rendu soit déjà
 * juste : sans lui, l'écran afficherait brièvement les dates stockées, qui
 * peuvent dater d'avant la dernière modification de durée.
 */
export function toBoardModel(
  payload: Pick<SchedulePayload, "tasks" | "dependencies" | "constraints">,
  contracts: ContractRef[],
): BoardModel {
  const constraintByTask = new Map(payload.constraints.map((c) => [c.taskId, c.date]));
  const contractIdByCode = new Map(contracts.map((c) => [c.contractCode, c.id]));

  const tasks: ModelTask[] = payload.tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    activity: task.activity,
    type: task.type,
    parentId: task.parentId,
    durationDays: task.durationDays,
    startAnchor: task.startDateInput,
    constraintDate: constraintByTask.get(task.id) ?? null,
    progressPct: task.progressPct,
    ownerId: task.ownerId,
    ownerName: task.ownerName,
    ownerOrgCode: task.ownerOrgCode,
    contractId: task.contractCode ? (contractIdByCode.get(task.contractCode) ?? null) : null,
    contractCode: task.contractCode,
    siteId: task.siteId,
    siteCode: task.siteCode,
    subproject: task.subproject,
    sortOrder: task.sortOrder,
    start: task.computed?.start ?? task.storedStart,
    end: task.computed?.end ?? task.storedEnd,
    depth: task.depth,
    driver: task.computed?.driver ?? null,
    drivingPredecessor: task.computed?.drivingPredecessor ?? null,
    drifted: task.drifted,
  }));

  // Début de projet : la plus ancienne contrainte, à défaut la plus ancienne
  // date stockée. JAMAIS une date en dur — un plan qui démarre à une constante
  // mentirait dès le premier décalage.
  const projectStart =
    payload.constraints.map((c) => c.date).sort()[0] ??
    tasks
      .map((task) => task.start)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ??
    new Date().toISOString().slice(0, 10);

  return recompute({
    tasks,
    dependencies: payload.dependencies.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
    })),
    projectStart,
    cycle: null,
  });
}
