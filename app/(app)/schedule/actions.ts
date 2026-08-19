"use server";

// ============================================================
// Écriture du planning et RECALCUL EN CASCADE.
//
// Principe (docs/SCHEMA.md §5.3) : on n'écrit que les ENTRÉES du moteur
// (durée, ancre, précédences, contraintes), puis on recalcule et on persiste
// les dates de tout le scénario. Les dates ne sont jamais saisies
// directement : ce sont des résultats.
//
// La RLS reste l'autorité. Ces actions n'ajoutent aucun contrôle d'accès : si
// l'appelant n'a pas `task.write`, la base refuse et rien n'est écrit.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeSchedule } from "@/lib/schedule/engine";
import { ScheduleCycleError } from "@/lib/schedule/types";
import { loadSchedule } from "@/lib/queries/schedule";

export interface WriteResult {
  ok: boolean;
  /** Nombre de tâches dont les dates ont changé. */
  changed?: number;
  error?: string;
}

/**
 * Recalcule le scénario et persiste les dates qui ont bougé.
 *
 * On n'écrit QUE les lignes modifiées. Une écriture inutile produirait une
 * ligne de `mg2030_change_log` par champ, et noierait l'historique réel sous
 * des non-changements.
 */
async function recomputeAndPersist(scenarioCode: string): Promise<WriteResult> {
  const supabase = await createClient();
  const { tasks, dependencies, constraints } = await loadSchedule(scenarioCode);

  const projectStart =
    constraints.map((c) => c.date).sort()[0] ??
    tasks
      .map((t) => t.storedStart)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ??
    new Date().toISOString().slice(0, 10);

  let windows;
  try {
    windows = computeSchedule({
      tasks: tasks.map((t) => ({
        id: t.id,
        wbsCode: t.wbsCode,
        type: t.type,
        parentId: t.parentId,
        durationDays: t.durationDays,
        startDateInput: t.startDateInput,
        sortOrder: t.sortOrder,
      })),
      dependencies,
      constraints,
      projectStart,
    }).windows;
  } catch (e) {
    // Un cycle rend le planning incalculable : on remonte le message, qui
    // NOMME les tâches en cause, plutôt qu'une erreur générique.
    if (e instanceof ScheduleCycleError) return { ok: false, error: e.message };
    throw e;
  }

  let changed = 0;
  for (const task of tasks) {
    const w = windows.get(task.id);
    if (!w) continue;
    if (w.start === task.storedStart && w.end === task.storedEnd) continue;

    const { error } = await supabase
      .from("mg2030_task")
      .update({ start_date: w.start, end_date: w.end })
      .eq("id", task.id);
    if (error) return { ok: false, error: error.message };
    changed++;
  }

  revalidatePath("/schedule");
  revalidatePath("/gantt");
  return { ok: true, changed };
}

export async function setTaskDuration(
  taskId: string,
  scenarioCode: string,
  durationDays: number | null,
): Promise<WriteResult> {
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 0)) {
    return { ok: false, error: "invalidDuration" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ duration_days: durationDays })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  return recomputeAndPersist(scenarioCode);
}

export async function setTaskActivity(
  taskId: string,
  activity: string,
): Promise<WriteResult> {
  const trimmed = activity.trim();
  if (trimmed === "") return { ok: false, error: "emptyActivity" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ activity: trimmed })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/schedule");
  return { ok: true };
}

export async function setTaskProgress(
  taskId: string,
  progressPct: number | null,
): Promise<WriteResult> {
  if (progressPct !== null && (progressPct < 0 || progressPct > 100)) {
    return { ok: false, error: "invalidProgress" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ progress_pct: progressPct })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/schedule");
  return { ok: true };
}

/**
 * Ancre de début saisie à la main.
 *
 * Une valeur vide rend la tâche à ses précédences : c'est le geste inverse du
 * figeage, et il doit rester possible — sans quoi une date posée un jour ne
 * pourrait plus jamais être relâchée.
 */
export async function setTaskStartAnchor(
  taskId: string,
  scenarioCode: string,
  isoDate: string | null,
): Promise<WriteResult> {
  if (isoDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return { ok: false, error: "invalidDate" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ start_date_input: isoDate })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  return recomputeAndPersist(scenarioCode);
}

/** Recalcul manuel, sans modification préalable. Sert à résorber une dérive. */
export async function recomputeScenario(scenarioCode: string): Promise<WriteResult> {
  return recomputeAndPersist(scenarioCode);
}
