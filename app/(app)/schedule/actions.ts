"use server";

// ============================================================
// Écriture du planning et RECALCUL EN CASCADE.
//
// Principe (docs/SCHEMA.md §5.3) : on n'écrit que les ENTRÉES du moteur
// (durée, ancre, précédences, contraintes), puis on recalcule et on persiste
// les dates. Les dates ne sont jamais saisies directement : ce sont des
// résultats.
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
  /** Détail lisible d'une erreur métier (cycle, code déjà pris…). */
  detail?: string;
}

/**
 * Recalcule le scénario et persiste les dates qui ont bougé.
 *
 * ⚠ UNE SEULE requête d'écriture, via `mg2030_apply_task_dates`.
 * La version précédente bouclait un `UPDATE` par tâche modifiée, en `await`
 * séquentiel : une cascade sur 12 tâches produisait 12 allers-retours vers
 * Paris, soit près d'une seconde de latence pure pour une frappe. Dans l'écran
 * dont le brief §2 dit qu'il décide du sort du projet, c'était rédhibitoire.
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
    if (e instanceof ScheduleCycleError) return { ok: false, error: "cycle", detail: e.message };
    throw e;
  }

  // On ne transmet que les lignes dont les dates ont réellement bougé : la
  // fonction SQL refiltre de toute façon, mais autant ne pas envoyer 27 lignes
  // quand 3 changent.
  const payload = tasks
    .map((task) => ({ task, w: windows.get(task.id) }))
    .filter(({ task, w }) => w && (w.start !== task.storedStart || w.end !== task.storedEnd))
    .map(({ task, w }) => ({ id: task.id, start: w!.start, end: w!.end }));

  if (payload.length > 0) {
    const { data, error } = await supabase.rpc("mg2030_apply_task_dates", {
      p_dates: payload,
    });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/schedule");
    return { ok: true, changed: (data as number) ?? payload.length };
  }

  revalidatePath("/schedule");
  return { ok: true, changed: 0 };
}

// ── Édition de cellule ──────────────────────────────────────────────────────

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

export async function setTaskActivity(taskId: string, activity: string): Promise<WriteResult> {
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

// ── Affectation ─────────────────────────────────────────────────────────────

/**
 * Responsable et valideur.
 *
 * Le fichier Excel source n'en contenait AUCUN (docs/GAPS.md point 8) : c'est
 * ici que la PIU les renseigne. Tant qu'une tâche n'a pas de responsable, les
 * notifications de retard n'ont aucun destinataire et ne partent pas.
 */
export async function setTaskAssignment(
  taskId: string,
  field: "owner" | "validator",
  userId: string | null,
): Promise<WriteResult> {
  const supabase = await createClient();
  const column = field === "owner" ? "owner_id" : "validator_id";
  const { error } = await supabase
    .from("mg2030_task")
    .update({ [column]: userId })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/schedule");
  return { ok: true };
}

/**
 * Rattache une tâche à un site précis.
 *
 * Nul au chargement sur les 27 tâches, et c'est CORRECT : le planning source
 * est au niveau sous-projet — « Training venues works » couvre les 13 halls à
 * la fois. Renseigner un site ici n'a de sens que si la PIU décompose la
 * tâche hall par hall. La colonne existe donc pour cet affinement, pas pour
 * être remplie d'office.
 */
export async function setTaskSite(
  taskId: string,
  siteId: string | null,
): Promise<WriteResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ site_id: siteId })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/schedule");
  return { ok: true };
}

// ── Précédences ─────────────────────────────────────────────────────────────

/**
 * Remplace l'ensemble des prédécesseurs d'une tâche, désignés par code WBS.
 *
 * Saisie par CODES et non par sélection à la souris : c'est ce que fait un
 * planificateur sous Excel ou MS Project, et le brief §2 fait de la vitesse de
 * saisie le critère décisif. Une liste vide détache la tâche.
 *
 * Le cycle est refusé par un trigger en base ET détecté par le moteur ; on
 * remonte le message qui NOMME les tâches en cause.
 */
export async function setTaskPredecessors(
  taskId: string,
  scenarioCode: string,
  wbsCodes: string[],
): Promise<WriteResult> {
  const supabase = await createClient();

  const wanted = [...new Set(wbsCodes.map((c) => c.trim()).filter(Boolean))];

  // Résolution des codes. Un code inconnu est une faute de frappe : on le
  // signale nommément plutôt que de l'ignorer en silence.
  const { data: found, error: lookupError } = await supabase
    .from("mg2030_task")
    .select("id, wbs_code")
    .in("wbs_code", wanted.length > 0 ? wanted : ["__none__"]);
  if (lookupError) return { ok: false, error: lookupError.message };

  const byCode = new Map((found ?? []).map((r) => [r.wbs_code as string, r.id as string]));
  const unknown = wanted.filter((c) => !byCode.has(c));
  if (unknown.length > 0) {
    return { ok: false, error: "unknownPredecessor", detail: unknown.join(", ") };
  }
  if (byCode.get(wanted.find((c) => byCode.get(c) === taskId) ?? "") === taskId) {
    return { ok: false, error: "selfPredecessor" };
  }

  const { error: deleteError } = await supabase
    .from("mg2030_task_dependency")
    .delete()
    .eq("successor_id", taskId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (wanted.length > 0) {
    const { error: insertError } = await supabase.from("mg2030_task_dependency").insert(
      wanted.map((code) => ({
        predecessor_id: byCode.get(code)!,
        successor_id: taskId,
        dependency_type: "FS",
        lag_days: 0,
      })),
    );
    if (insertError) {
      // Le trigger de cycle remonte ici. Son message nomme les deux tâches.
      return { ok: false, error: "cycle", detail: insertError.message };
    }
  }

  return recomputeAndPersist(scenarioCode);
}

/** Contrainte « ne peut pas démarrer avant ». Vide = on la retire. */
export async function setTaskConstraint(
  taskId: string,
  scenarioCode: string,
  isoDate: string | null,
): Promise<WriteResult> {
  const supabase = await createClient();

  if (isoDate === null) {
    const { error } = await supabase
      .from("mg2030_task_constraint")
      .delete()
      .eq("task_id", taskId)
      .eq("kind", "start_no_earlier_than");
    if (error) return { ok: false, error: error.message };
    return recomputeAndPersist(scenarioCode);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { ok: false, error: "invalidDate" };

  const { error } = await supabase
    .from("mg2030_task_constraint")
    .upsert(
      { task_id: taskId, kind: "start_no_earlier_than", constraint_date: isoDate },
      { onConflict: "task_id,kind" },
    );
  if (error) return { ok: false, error: error.message };
  return recomputeAndPersist(scenarioCode);
}

// ── Création, suppression, hiérarchie ───────────────────────────────────────

export interface CreateTaskInput {
  scenarioCode: string;
  planId: string;
  wbsCode: string;
  activity: string;
  taskType: "task" | "summary" | "milestone" | "group_header";
  parentId: string | null;
  durationDays: number | null;
  /** Position d'insertion : la nouvelle tâche prend ce rang. */
  sortOrder: number;
  contractId?: string | null;
}

export async function createTask(input: CreateTaskInput): Promise<WriteResult> {
  if (!input.wbsCode.trim()) return { ok: false, error: "emptyWbs" };
  if (!input.activity.trim()) return { ok: false, error: "emptyActivity" };

  const supabase = await createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("mg2030_schedule_scenario")
    .select("id, is_schedulable")
    .eq("code", input.scenarioCode)
    .maybeSingle();
  if (scenarioError) return { ok: false, error: scenarioError.message };
  if (!scenario) return { ok: false, error: "unknownScenario" };
  // On refuse d'ajouter une tâche à un scénario déclaré non planifiable : ce
  // serait précisément inventer les dates que le brief §7 interdit d'inventer.
  if (!scenario.is_schedulable) return { ok: false, error: "scenarioNotSchedulable" };

  // Un intertitre et un jalon ne portent pas de durée (contraintes de base).
  const duration =
    input.taskType === "group_header" || input.taskType === "milestone"
      ? null
      : (input.durationDays ?? 0);

  const { error } = await supabase.from("mg2030_task").insert({
    wbs_code: input.wbsCode.trim(),
    plan_id: input.planId,
    scenario_id: scenario.id,
    parent_id: input.parentId,
    task_type: input.taskType,
    activity: input.activity.trim(),
    duration_days: duration,
    sort_order: input.sortOrder,
    contract_id: input.contractId ?? null,
  });

  if (error) {
    // (plan_id, wbs_code) est unique : un code repris est le cas le plus
    // fréquent, et mérite un message précis.
    if (error.code === "23505") return { ok: false, error: "duplicateWbs", detail: input.wbsCode };
    return { ok: false, error: error.message };
  }

  return recomputeAndPersist(input.scenarioCode);
}

/**
 * Suppression.
 *
 * `on delete cascade` sur `parent_id` emporte les enfants, et sur les
 * précédences emporte les liens. C'est voulu — mais on avertit l'appelant du
 * nombre d'enfants pour qu'il puisse confirmer.
 */
export async function deleteTask(taskId: string, scenarioCode: string): Promise<WriteResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_task").delete().eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  return recomputeAndPersist(scenarioCode);
}

/** Compte les descendants, pour confirmer une suppression en cascade. */
export async function countDescendants(taskId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("mg2030_task").select("id, parent_id");
  const all = (data ?? []) as { id: string; parent_id: string | null }[];

  let total = 0;
  const queue = [taskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const row of all) {
      if (row.parent_id === current) {
        total++;
        queue.push(row.id);
      }
    }
  }
  return total;
}

/** Indentation : la tâche devient enfant de celle qui la précède. */
export async function setTaskParent(
  taskId: string,
  scenarioCode: string,
  parentId: string | null,
): Promise<WriteResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_task")
    .update({ parent_id: parentId })
    .eq("id", taskId);
  if (error) {
    // Le trigger mg2030_task_parent_no_cycle remonte ici.
    return { ok: false, error: "hierarchyCycle", detail: error.message };
  }
  return recomputeAndPersist(scenarioCode);
}

/** Réordonnancement : nouvelle position de rang pour un lot de tâches. */
export async function reorderTasks(
  scenarioCode: string,
  order: { id: string; sortOrder: number }[],
): Promise<WriteResult> {
  const supabase = await createClient();
  for (const row of order) {
    const { error } = await supabase
      .from("mg2030_task")
      .update({ sort_order: row.sortOrder })
      .eq("id", row.id);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/schedule");
  return { ok: true };
}

/** Recalcul manuel, sans modification préalable. Sert à résorber une dérive. */
export async function recomputeScenario(scenarioCode: string): Promise<WriteResult> {
  return recomputeAndPersist(scenarioCode);
}
