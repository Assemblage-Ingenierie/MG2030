import "server-only";

// ============================================================
// lib/queries/schedule.ts — lecture du planning et persistance du recalcul.
//
// Le moteur (lib/schedule) est PUR : c'est ici que se fait le pont avec la
// base. Les dates stockées sont un CACHE du moteur, pas une saisie : les
// seules entrées sont la durée, l'ancre, les précédences et les contraintes
// (docs/SCHEMA.md §5.2).
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { computeSchedule } from "@/lib/schedule/engine";
import type {
  ConstraintInput,
  DependencyInput,
  TaskInput,
  TaskWindow,
} from "@/lib/schedule/types";

export interface ScenarioRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  exclusiveGroup: string | null;
  isActive: boolean;
  isSchedulable: boolean;
  bufferStartDate: string | null;
  bufferMonths: number | null;
  deadlineDate: string | null;
  taskCount: number;
}

export async function listScenarios(): Promise<ScenarioRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_schedule_scenario")
    .select(
      `id, code, name, description, exclusive_group, is_active, is_schedulable,
       buffer_start_date, buffer_months, deadline_date, mg2030_task ( count )`,
    )
    .order("code");

  if (error) throw new Error(`Lecture des scenarios : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & { mg2030_task: { count: number }[] };
    return {
      id: r.id as string,
      code: r.code as string,
      name: r.name as string,
      description: (r.description as string) ?? null,
      exclusiveGroup: (r.exclusive_group as string) ?? null,
      isActive: r.is_active as boolean,
      isSchedulable: r.is_schedulable as boolean,
      bufferStartDate: (r.buffer_start_date as string) ?? null,
      bufferMonths: (r.buffer_months as number) ?? null,
      deadlineDate: (r.deadline_date as string) ?? null,
      taskCount: r.mg2030_task?.[0]?.count ?? 0,
    };
  });
}

export interface TaskRow extends TaskInput {
  groupLabel: string | null;
  activity: string;
  planCode: string;
  scenarioCode: string;
  contractCode: string | null;
  /**
   * Sous-projet : la dimension que le planning source porte réellement. Nul
   * pour les jalons transverses (MS.1, MS.2).
   */
  subproject: "athletes_village" | "training_venues" | null;
  /** Site précis, quand la PIU a affiné hall par hall. Nul au chargement. */
  siteId: string | null;
  siteCode: string | null;
  storedStart: string | null;
  storedEnd: string | null;
  progressPct: number | null;
  ownerId: string | null;
  validatorId: string | null;
  planId: string;
  ownerName: string | null;
  /** Fenêtre recalculée par le moteur. */
  computed: TaskWindow | null;
  /** Vrai si la date stockée diffère de la date calculée. */
  drifted: boolean;
  depth: number;
}

export interface SchedulePayload {
  tasks: TaskRow[];
  dependencies: DependencyInput[];
  constraints: ConstraintInput[];
  scenario: ScenarioRow | null;
  /** Précédences indexées par successeur, pour l'affichage des liens. */
  predecessorsOf: Record<string, string[]>;
}

/**
 * Charge un scénario et recalcule les dates.
 *
 * Le recalcul est fait à CHAQUE lecture, et son résultat comparé aux dates
 * stockées. Avec la correction GAPS 12, les deux coïncident : un écart signale
 * donc soit une modification non persistée, soit une donnée touchée hors
 * application. Le mieux est de le voir, pas de le masquer.
 */
export async function loadSchedule(
  scenarioCode: string,
  /**
   * Scénarios déjà chargés par l'appelant. La page les lit pour son sélecteur ;
   * les relire ici doublait la requête d'agrégat sur les tâches à chaque
   * affichage. `undefined` = on les charge.
   */
  knownScenarios?: ScenarioRow[],
): Promise<SchedulePayload> {
  const supabase = await createClient();

  const scenarios = knownScenarios ?? (await listScenarios());
  const scenario = scenarios.find((s) => s.code === scenarioCode) ?? null;

  const { data: taskData, error: taskError } = await supabase
    .from("mg2030_task")
    .select(
      `id, wbs_code, task_type, parent_id, duration_days, start_date_input,
       start_date, end_date, group_label, activity, sort_order, progress_pct,
       owner_id, validator_id, plan_id, subproject, site_id,
       mg2030_plan!inner ( plan_code ),
       mg2030_schedule_scenario!inner ( code ),
       mg2030_contract ( contract_code ),
       mg2030_site ( site_code, name ),
       owner:mg2030_app_user!mg2030_task_owner_id_fkey ( full_name )`,
    )
    .eq("mg2030_schedule_scenario.code", scenarioCode)
    .is("archived_at", null)
    .order("sort_order");

  if (taskError) throw new Error(`Lecture des taches : ${taskError.message}`);

  const raw = (taskData ?? []) as unknown as Record<string, unknown>[];
  const ids = raw.map((r) => r.id as string);

  const [{ data: depData }, { data: conData }] = await Promise.all([
    supabase
      .from("mg2030_task_dependency")
      .select("predecessor_id, successor_id, dependency_type, lag_days")
      .in("successor_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase
      .from("mg2030_task_constraint")
      .select("task_id, kind, constraint_date")
      .in("task_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const dependencies: DependencyInput[] = (depData ?? []).map((d) => ({
    predecessorId: d.predecessor_id as string,
    successorId: d.successor_id as string,
    type: d.dependency_type as DependencyInput["type"],
    lagDays: d.lag_days as number,
  }));

  const constraints: ConstraintInput[] = (conData ?? []).map((c) => ({
    taskId: c.task_id as string,
    kind: c.kind as ConstraintInput["kind"],
    date: c.constraint_date as string,
  }));

  const inputs: TaskInput[] = raw.map((r) => ({
    id: r.id as string,
    wbsCode: r.wbs_code as string,
    type: r.task_type as TaskInput["type"],
    parentId: (r.parent_id as string) ?? null,
    durationDays: (r.duration_days as number) ?? null,
    startDateInput: (r.start_date_input as string) ?? null,
    sortOrder: r.sort_order as number,
  }));

  // Début de projet : la plus ancienne contrainte, à défaut la plus ancienne
  // date stockée. Jamais une date en dur.
  const projectStart =
    constraints.map((c) => c.date).sort()[0] ??
    raw.map((r) => r.start_date as string).filter(Boolean).sort()[0] ??
    new Date().toISOString().slice(0, 10);

  let windows: Map<string, TaskWindow> | null = null;
  try {
    windows = computeSchedule({ tasks: inputs, dependencies, constraints, projectStart }).windows;
  } catch {
    // Un cycle rend le planning incalculable. On affiche alors les dates
    // stockées, en signalant l'anomalie plutôt qu'en rendant une page vide.
    windows = null;
  }

  const byId = new Map(inputs.map((t) => [t.id, t]));
  const depth = (id: string): number => {
    let d = 0;
    let cur = byId.get(id);
    while (cur?.parentId && d < 50) {
      cur = byId.get(cur.parentId);
      d++;
    }
    return d;
  };

  const tasks: TaskRow[] = raw.map((r, i) => {
    const id = r.id as string;
    const computed = windows?.get(id) ?? null;
    const storedStart = (r.start_date as string) ?? null;
    const storedEnd = (r.end_date as string) ?? null;
    return {
      ...inputs[i],
      groupLabel: (r.group_label as string) ?? null,
      activity: r.activity as string,
      planCode: (r.mg2030_plan as { plan_code: string }).plan_code,
      scenarioCode: (r.mg2030_schedule_scenario as { code: string }).code,
      contractCode: (r.mg2030_contract as { contract_code: string } | null)?.contract_code ?? null,
      subproject: (r.subproject as TaskRow["subproject"]) ?? null,
      siteId: (r.site_id as string) ?? null,
      siteCode: (r.mg2030_site as { site_code: string } | null)?.site_code ?? null,
      storedStart,
      storedEnd,
      progressPct: (r.progress_pct as number) ?? null,
      ownerId: (r.owner_id as string) ?? null,
      validatorId: (r.validator_id as string) ?? null,
      planId: r.plan_id as string,
      ownerName: (r.owner as { full_name: string } | null)?.full_name ?? null,
      computed,
      drifted:
        computed !== null &&
        (computed.start !== storedStart || computed.end !== storedEnd),
      depth: depth(id),
    };
  });

  const predecessorsOf: Record<string, string[]> = {};
  for (const dep of dependencies) {
    (predecessorsOf[dep.successorId] ??= []).push(dep.predecessorId);
  }

  return { tasks, dependencies, constraints, scenario, predecessorsOf };
}
