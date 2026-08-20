"use server";

// ============================================================
// app/(app)/procurement/actions.ts — gabarits de passation et instanciation.
//
// « Créer un contrat instancie le gabarit et génère les tâches associées »
// (brief §7). Le calcul est PUR (lib/procurement/instantiate.ts) : ce fichier
// ne fait que lire, appeler, écrire.
//
// D'où la PRÉVISUALISATION : `previewInstantiation` rend exactement ce que
// `applyTemplate` écrira. Une génération d'une douzaine de tâches qu'on
// découvre après coup est pénible à défaire ; la voir avant coûte un clic.
//
// RLS SEULE AUTORITÉ : aucune vérification de rôle ici.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  instantiateTemplate,
  OBSERVED_CONSULTANT_SEQUENCE,
  OBSERVED_WORKS_SEQUENCE,
  type ContractAnchors,
  type GeneratedTask,
  type TemplateStep,
} from "@/lib/procurement/instantiate";

export type ProcurementWrite =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

// ── Gabarits ────────────────────────────────────────────────────────────────

export interface TemplateInput {
  code: string;
  name: string;
  procedure: string;
  contractType: string | null;
  selectionMethod: string | null;
  description: string | null;
  isActive: boolean;
}

function templateRow(input: TemplateInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    procedure: input.procedure,
    contract_type: input.contractType,
    selection_method: input.selectionMethod,
    description: input.description?.trim() || null,
    is_active: input.isActive,
  };
}

export async function createTemplate(input: TemplateInput): Promise<ProcurementWrite> {
  if (input.code.trim() === "" || input.name.trim() === "") {
    return { ok: false, error: "emptyIdentity" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_procurement_template")
    .insert(templateRow(input));
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

export async function updateTemplate(
  id: string,
  input: TemplateInput,
): Promise<ProcurementWrite> {
  if (input.code.trim() === "" || input.name.trim() === "") {
    return { ok: false, error: "emptyIdentity" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_procurement_template")
    .update(templateRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

/**
 * Supprime un gabarit et ses étapes (cascade).
 *
 * Les tâches déjà engendrées SURVIVENT : `generated_from_step_id` est en
 * `on delete set null`. C'est voulu — supprimer un gabarit ne doit pas
 * effacer un planning en cours d'exécution.
 */
export async function deleteTemplate(id: string): Promise<ProcurementWrite> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_procurement_template").delete().eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

/**
 * Crée les deux gabarits correspondant aux séquences OBSERVÉES au planning.
 *
 * ⚠ Ce ne sont pas des données projet : aucun gabarit n'existe dans les
 * sources (GAPS 10). Les durées sont RELEVÉES sur les chaînes réelles —
 * C-TV-DD pour la sélection de consultant, TV.3.1 pour l'appel d'offres
 * travaux — et non estimées. Les gabarits sont créés INACTIFS, et leur
 * description le dit : ils ne doivent pas être pris pour une donnée validée.
 *
 * Deux gabarits et non un, parce que les deux procédures diffèrent
 * réellement : l'appel d'offres travaux est ouvert, sans manifestation
 * d'intérêt ni avis AFD préalable.
 */
export async function seedObservedTemplates(): Promise<ProcurementWrite> {
  const supabase = await createClient();

  const definitions = [
    {
      code: "OBS-CONSULT",
      name: "Observed sequence — consultant selection",
      procedure: "REOI",
      description:
        "Durations read off the real C-TV-DD chain (TV.2.1 to TV.2.6): 21 / 14 / 10 / " +
        "42 / 14 / 28 days. NOT project data (GAPS 10) — review before activating.",
      steps: OBSERVED_CONSULTANT_SEQUENCE,
    },
    {
      code: "OBS-WORKS",
      name: "Observed sequence — works or goods tender",
      procedure: "IB",
      description:
        "Durations read off the real TV.3.1 chain: 56 / 14 / 28 days. Open tender, so " +
        "no expression of interest and no prior AFD no-objection. NOT project data " +
        "(GAPS 10) — review before activating.",
      steps: OBSERVED_WORKS_SEQUENCE,
    },
  ];

  for (const definition of definitions) {
    const { data: template, error: templateError } = await supabase
      .from("mg2030_procurement_template")
      .insert({
        code: definition.code,
        name: definition.name,
        procedure: definition.procedure,
        description: definition.description,
        is_active: false,
      })
      .select("id")
      .single();

    // Le code est unique : si le gabarit existe déjà, on passe au suivant au
    // lieu d'échouer — le bouton reste sans danger s'il est cliqué deux fois.
    if (templateError) {
      if (templateError.code === "23505") continue;
      return { ok: false, error: "writeFailed", detail: templateError.message };
    }

    const { error: stepError } = await supabase.from("mg2030_procurement_template_step").insert(
      definition.steps.map((step) => ({
        template_id: template.id,
        step_no: step.stepNo,
        name: step.name,
        default_duration_days: step.defaultDurationDays,
        is_afd_no_objection: step.isAfdNoObjection,
        contract_date_anchor: step.contractDateAnchor,
      })),
    );
    if (stepError) return { ok: false, error: "writeFailed", detail: stepError.message };
  }

  revalidatePath("/procurement");
  return { ok: true };
}

// ── Étapes ──────────────────────────────────────────────────────────────────

export interface StepInput {
  stepNo: number;
  name: string;
  defaultDurationDays: number;
  isAfdNoObjection: boolean;
  contractDateAnchor: string | null;
}

function stepRow(input: StepInput) {
  return {
    step_no: input.stepNo,
    name: input.name.trim(),
    default_duration_days: input.defaultDurationDays,
    is_afd_no_objection: input.isAfdNoObjection,
    contract_date_anchor: input.contractDateAnchor,
  };
}

function validateStep(input: StepInput): string | null {
  if (input.name.trim() === "") return "emptyStepName";
  if (!Number.isInteger(input.stepNo) || input.stepNo < 1) return "invalidStepNo";
  if (!Number.isInteger(input.defaultDurationDays) || input.defaultDurationDays < 0) {
    return "invalidDuration";
  }
  return null;
}

export async function addStep(templateId: string, input: StepInput): Promise<ProcurementWrite> {
  const invalid = validateStep(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .insert({ template_id: templateId, ...stepRow(input) });
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

export async function updateStep(id: string, input: StepInput): Promise<ProcurementWrite> {
  const invalid = validateStep(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .update(stepRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

export async function deleteStep(id: string): Promise<ProcurementWrite> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/procurement");
  return { ok: true };
}

// ── Instanciation ───────────────────────────────────────────────────────────

/**
 * Charge gabarit et marché, puis développe la séquence SANS RIEN ÉCRIRE.
 *
 * Le repli sur aujourd'hui quand aucun jalon contractuel n'est renseigné est
 * assumé et signalé à l'écran : générer depuis une date arbitraire muette
 * produirait un planning faux d'apparence crédible.
 */
async function expand(
  templateId: string,
  contractId: string,
): Promise<
  | { ok: true; tasks: GeneratedTask[]; wbsPrefix: string; anchored: boolean }
  | { ok: false; error: string; detail?: string }
> {
  const supabase = await createClient();

  const [{ data: steps, error: stepError }, { data: contract, error: contractError }] =
    await Promise.all([
      supabase
        .from("mg2030_procurement_template_step")
        .select("id, step_no, name, default_duration_days, is_afd_no_objection, contract_date_anchor, owner_role_id, validator_role_id")
        .eq("template_id", templateId)
        .order("step_no"),
      supabase
        .from("mg2030_contract")
        .select("contract_code, spn_publication_date, bid_opening_date, signature_date, completion_date")
        .eq("id", contractId)
        .single(),
    ]);

  if (stepError) return { ok: false, error: "writeFailed", detail: stepError.message };
  if (contractError) return { ok: false, error: "writeFailed", detail: contractError.message };
  if (!steps || steps.length === 0) return { ok: false, error: "templateHasNoStep" };

  const anchors: ContractAnchors = {
    spn_publication_date: contract.spn_publication_date ?? null,
    bid_opening_date: contract.bid_opening_date ?? null,
    signature_date: contract.signature_date ?? null,
    completion_date: contract.completion_date ?? null,
  };

  const templateSteps: TemplateStep[] = steps.map((s) => ({
    id: s.id as string,
    stepNo: s.step_no as number,
    name: s.name as string,
    defaultDurationDays: s.default_duration_days as number,
    isAfdNoObjection: s.is_afd_no_objection as boolean,
    contractDateAnchor: (s.contract_date_anchor as TemplateStep["contractDateAnchor"]) ?? null,
    ownerRoleId: (s.owner_role_id as string) ?? null,
    validatorRoleId: (s.validator_role_id as string) ?? null,
  }));

  const anchored = Object.values(anchors).some((d) => d !== null);
  const fallbackStart =
    anchors.spn_publication_date ??
    anchors.bid_opening_date ??
    anchors.signature_date ??
    new Date().toISOString().slice(0, 10);

  return {
    ok: true,
    wbsPrefix: contract.contract_code as string,
    anchored,
    tasks: instantiateTemplate({
      steps: templateSteps,
      anchors,
      wbsPrefix: contract.contract_code as string,
      fallbackStart,
    }),
  };
}

export interface PreviewRow {
  wbsCode: string;
  activity: string;
  durationDays: number;
  previewStart: string;
  previewEnd: string;
  anchored: boolean;
  createsNoObjection: boolean;
  predecessorWbs: string | null;
  /** Vrai si ce code WBS existe déjà dans le plan : la génération le sauterait. */
  alreadyExists: boolean;
  /** Chevauchement imposé par l'ancre contractuelle. Zéro si aucun. */
  conflictDays: number;
  /** Battement laissé par l'ancre contractuelle. Zéro si aucun. */
  slackDays: number;
}

export interface PreviewResult {
  ok: true;
  rows: PreviewRow[];
  /** Faux si aucun jalon contractuel n'est renseigné : dates issues d'un repli. */
  anchored: boolean;
  existingCount: number;
}

export async function previewInstantiation(
  templateId: string,
  contractId: string,
  scenarioCode: string,
): Promise<PreviewResult | { ok: false; error: string; detail?: string }> {
  const expanded = await expand(templateId, contractId);
  if (!expanded.ok) return expanded;

  const supabase = await createClient();

  // Codes déjà pris dans ce scénario : une seconde génération ne doit pas
  // produire une erreur d'unicité opaque à mi-parcours.
  const { data: existing } = await supabase
    .from("mg2030_task")
    .select("wbs_code, mg2030_schedule_scenario!inner ( code )")
    .eq("mg2030_schedule_scenario.code", scenarioCode)
    .in("wbs_code", expanded.tasks.map((task) => task.wbsCode));

  const taken = new Set((existing ?? []).map((r) => r.wbs_code as string));

  const rows: PreviewRow[] = expanded.tasks.map((task) => ({
    wbsCode: task.wbsCode,
    activity: task.activity,
    durationDays: task.durationDays,
    previewStart: task.previewStart,
    previewEnd: task.previewEnd,
    anchored: task.startDateInput !== null,
    createsNoObjection: task.createsNoObjection,
    predecessorWbs: task.predecessorWbs,
    alreadyExists: taken.has(task.wbsCode),
    conflictDays: task.conflictDays,
    slackDays: task.slackDays,
  }));

  return { ok: true, rows, anchored: expanded.anchored, existingCount: taken.size };
}

/**
 * Écrit les tâches engendrées, leurs précédences et les avis AFD.
 *
 * Les codes WBS déjà pris sont SAUTÉS, pas écrasés : réappliquer un gabarit
 * pour ajouter deux étapes oubliées ne doit pas effacer les dates déjà
 * saisies sur les autres.
 */
export async function applyTemplate(
  templateId: string,
  contractId: string,
  scenarioCode: string,
  planId: string,
): Promise<ProcurementWrite & { created?: number; skipped?: number }> {
  const expanded = await expand(templateId, contractId);
  if (!expanded.ok) return expanded;

  const supabase = await createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("mg2030_schedule_scenario")
    .select("id")
    .eq("code", scenarioCode)
    .single();
  if (scenarioError) return { ok: false, error: "writeFailed", detail: scenarioError.message };

  const { data: existing } = await supabase
    .from("mg2030_task")
    .select("wbs_code")
    .eq("scenario_id", scenario.id)
    .in("wbs_code", expanded.tasks.map((task) => task.wbsCode));
  const taken = new Set((existing ?? []).map((r) => r.wbs_code as string));

  const toCreate = expanded.tasks.filter((task) => !taken.has(task.wbsCode));
  if (toCreate.length === 0) {
    return { ok: true, created: 0, skipped: expanded.tasks.length };
  }

  // Ordre de tri : après les tâches existantes, pour que le marché généré se
  // lise en bloc plutôt que dispersé dans le plan.
  const { data: last } = await supabase
    .from("mg2030_task")
    .select("sort_order")
    .eq("scenario_id", scenario.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (last?.sort_order ?? 0) + 10;

  const { data: inserted, error: insertError } = await supabase
    .from("mg2030_task")
    .insert(
      toCreate.map((task, i) => ({
        wbs_code: task.wbsCode,
        plan_id: planId,
        scenario_id: scenario.id,
        task_type: "task",
        activity: task.activity,
        duration_days: task.durationDays,
        start_date_input: task.startDateInput,
        contract_id: contractId,
        generated_from_step_id: task.stepId,
        sort_order: base + i,
      })),
    )
    .select("id, wbs_code");

  if (insertError) return { ok: false, error: "writeFailed", detail: insertError.message };

  const idByWbs = new Map((inserted ?? []).map((r) => [r.wbs_code as string, r.id as string]));

  // Précédences fin-début. Un prédécesseur hors du lot généré (ex. réapplication
  // partielle) est ignoré : mieux vaut une tâche non chaînée qu'une erreur.
  const links = toCreate
    .filter((task) => task.predecessorWbs !== null)
    .map((task) => ({
      predecessor_id: idByWbs.get(task.predecessorWbs!),
      successor_id: idByWbs.get(task.wbsCode),
      dependency_type: "FS",
      lag_days: 0,
    }))
    .filter((link) => link.predecessor_id && link.successor_id);

  if (links.length > 0) {
    const { error: linkError } = await supabase.from("mg2030_task_dependency").insert(links);
    if (linkError) return { ok: false, error: "writeFailed", detail: linkError.message };
  }

  // Avis AFD : une étape marquée `is_afd_no_objection` crée sa demande en
  // brouillon. Sans cela, l'avis resterait à saisir à la main alors que le
  // gabarit sait déjà qu'il existe.
  const nons = toCreate
    .filter((task) => task.createsNoObjection && idByWbs.has(task.wbsCode))
    .map((task) => ({
      subject: task.activity,
      contract_id: contractId,
      task_id: idByWbs.get(task.wbsCode),
      status: "draft",
    }));

  if (nons.length > 0) {
    const { error: nonError } = await supabase.from("mg2030_no_objection").insert(nons);
    if (nonError) return { ok: false, error: "writeFailed", detail: nonError.message };
  }

  revalidatePath("/procurement");
  revalidatePath("/schedule");
  revalidatePath("/no-objections");
  return { ok: true, created: toCreate.length, skipped: taken.size };
}
