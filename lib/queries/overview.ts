import "server-only";

// ============================================================
// lib/queries/overview.ts — les chiffres de la page d'accueil.
//
// Le tableau de bord consolidé est HORS PÉRIMÈTRE de la version 1 (brief §9).
// Cette lecture ne le simule pas : elle donne les quelques nombres qu'on vient
// chercher en ouvrant la plateforme, chacun cliquable vers son écran.
//
// TOUT EST COMPTÉ EN BASE, en `head: true` — aucune ligne ne remonte. Le brief
// §2 en fait un critère : « si la saisie est plus lente que sous Excel, la PIU
// retournera à Excel », et cela vaut aussi pour l'écran qu'on ouvre le plus.
//
// RLS SEULE AUTORITÉ : un compte à périmètre restreint verra des nombres plus
// petits, sans qu'aucun filtre soit écrit ici.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { daysBetween } from "@/lib/schedule/dates";

export interface Overview {
  sites: number;
  buildings: number;
  contracts: number;
  lots: number;
  /** Tâches du scénario retenu. */
  tasks: number;
  tasksWithoutOwner: number;
  deliverables: number;
  deliverablesLate: number;
  noObjectionsAwaiting: number;
  documents: number;
  /** Cadre calendaire du scénario retenu. */
  scenarioName: string | null;
  bufferStartDate: string | null;
  deadlineDate: string | null;
  /** Jours restants jusqu'à l'échéance des Jeux. Négatif si elle est passée. */
  daysToDeadline: number | null;
  /** Jours restants avant d'entamer la marge terminale. */
  daysToBuffer: number | null;
}

export async function loadOverview(): Promise<Overview> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const HEAD = { count: "exact" as const, head: true };

  // Scénario de référence : l'actif qui porte un cadre calendaire, à défaut le
  // premier qui en porte un. Même règle que le plan de charge, pour que les
  // deux écrans parlent du même planning.
  const { data: scenarios } = await supabase
    .from("mg2030_schedule_scenario")
    .select("id, name, is_active, buffer_start_date, deadline_date")
    .order("code");

  const rows = (scenarios ?? []) as unknown as Record<string, unknown>[];
  const scenario =
    rows.find((s) => s.is_active === true && s.buffer_start_date !== null) ??
    rows.find((s) => s.buffer_start_date !== null) ??
    rows[0] ??
    null;
  const scenarioId = (scenario?.id as string) ?? null;

  const [
    sites,
    buildings,
    contracts,
    lots,
    tasks,
    unowned,
    deliverables,
    late,
    awaiting,
    documents,
  ] = await Promise.all([
    supabase.from("mg2030_site").select("*", HEAD).is("archived_at", null),
    supabase.from("mg2030_building").select("*", HEAD).is("archived_at", null),
    supabase.from("mg2030_contract").select("*", HEAD).is("archived_at", null),
    supabase.from("mg2030_lot").select("*", HEAD).is("archived_at", null),

    supabase
      .from("mg2030_task")
      .select("*", HEAD)
      .is("archived_at", null)
      .eq("scenario_id", scenarioId ?? "00000000-0000-0000-0000-000000000000"),

    // Seules les vraies tâches : un récapitulatif ou un intertitre n'a pas
    // vocation à porter un responsable.
    supabase
      .from("mg2030_task")
      .select("*", HEAD)
      .is("archived_at", null)
      .eq("scenario_id", scenarioId ?? "00000000-0000-0000-0000-000000000000")
      .eq("task_type", "task")
      .is("owner_id", null),

    supabase.from("mg2030_deliverable").select("*", HEAD),

    // En retard : échéance passée et rien de remis. Même définition que l'écran
    // des livrables — deux définitions divergeraient tôt ou tard.
    supabase
      .from("mg2030_deliverable")
      .select("*", HEAD)
      .is("actual_submission_date", null)
      .not("contractual_date", "is", null)
      .lt("contractual_date", today),

    supabase.from("mg2030_no_objection").select("*", HEAD).in("status", ["draft", "sent"]),

    supabase.from("mg2030_document").select("*", HEAD).is("archived_at", null),
  ]);

  const bufferStartDate = (scenario?.buffer_start_date as string) ?? null;
  const deadlineDate = (scenario?.deadline_date as string) ?? null;

  return {
    sites: sites.count ?? 0,
    buildings: buildings.count ?? 0,
    contracts: contracts.count ?? 0,
    lots: lots.count ?? 0,
    tasks: tasks.count ?? 0,
    tasksWithoutOwner: unowned.count ?? 0,
    deliverables: deliverables.count ?? 0,
    deliverablesLate: late.count ?? 0,
    noObjectionsAwaiting: awaiting.count ?? 0,
    documents: documents.count ?? 0,
    scenarioName: (scenario?.name as string) ?? null,
    bufferStartDate,
    deadlineDate,
    daysToDeadline: deadlineDate === null ? null : daysBetween(today, deadlineDate),
    daysToBuffer: bufferStartDate === null ? null : daysBetween(today, bufferStartDate),
  };
}
