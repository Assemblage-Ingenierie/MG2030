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
import { recomputeAndPersist } from "@/app/(app)/schedule/actions";
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

/**
 * Libère le numéro `stepNo` dans le gabarit en décalant d'un cran l'étape qui
 * l'occupe et toutes les suivantes. Saisir « 3 » pour une nouvelle étape
 * l'INSÈRE en troisième position, au lieu d'échouer sur la contrainte
 * d'unicité (template_id, step_no).
 *
 * Décalage une ligne à la fois, du plus grand numéro au plus petit : la
 * contrainte n'est pas différable, un décalage en bloc se heurterait à
 * lui-même. Les gabarits comptent une dizaine d'étapes.
 */
async function makeRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  stepNo: number,
  excludeId: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mg2030_procurement_template_step")
    .select("id, step_no")
    .eq("template_id", templateId)
    .gte("step_no", stepNo)
    .order("step_no", { ascending: false });
  if (error) return error.message;

  const others = (data ?? []).filter((s) => s.id !== excludeId);
  if (!others.some((s) => s.step_no === stepNo)) return null;

  for (const s of others) {
    const { error: shift } = await supabase
      .from("mg2030_procurement_template_step")
      .update({ step_no: (s.step_no as number) + 1 })
      .eq("id", s.id);
    if (shift) return shift.message;
  }
  return null;
}

/** Nombre d'étapes du gabarit, ou le message d'erreur de la lecture. */
async function countSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
): Promise<number | string> {
  const { count, error } = await supabase
    .from("mg2030_procurement_template_step")
    .select("id", { count: "exact", head: true })
    .eq("template_id", templateId);
  return error ? error.message : (count ?? 0);
}

export async function addStep(templateId: string, input: StepInput): Promise<ProcurementWrite> {
  const invalid = validateStep(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  // Une nouvelle étape prend au plus la place qui suit la dernière : un
  // numéro plus grand laisserait un trou dans la séquence.
  const count = await countSteps(supabase, templateId);
  if (typeof count === "string") return { ok: false, error: "writeFailed", detail: count };
  if (input.stepNo > count + 1) return { ok: false, error: "stepNoTooHigh" };

  const room = await makeRoom(supabase, templateId, input.stepNo, null);
  if (room) return { ok: false, error: "writeFailed", detail: room };

  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .insert({ template_id: templateId, ...stepRow(input) });
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  const compacted = await compactSteps(supabase, templateId);
  if (compacted) return { ok: false, error: "writeFailed", detail: compacted };

  revalidatePath("/procurement");
  return { ok: true };
}

export async function updateStep(id: string, input: StepInput): Promise<ProcurementWrite> {
  const invalid = validateStep(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { data: current, error: read } = await supabase
    .from("mg2030_procurement_template_step")
    .select("template_id, step_no")
    .eq("id", id)
    .maybeSingle();
  if (read || !current) return { ok: false, error: "writeFailed", detail: read?.message };

  // Renuméroter vers un numéro déjà pris : l'étape est d'abord garée sur un
  // numéro négatif, qu'aucune étape réelle ne porte, pour ne pas gêner le
  // décalage des autres ; elle prend ensuite sa nouvelle place.
  if (current.step_no !== input.stepNo) {
    const count = await countSteps(supabase, current.template_id as string);
    if (typeof count === "string") return { ok: false, error: "writeFailed", detail: count };
    if (input.stepNo > count) return { ok: false, error: "stepNoTooHigh" };

    const { error: park } = await supabase
      .from("mg2030_procurement_template_step")
      .update({ step_no: -(current.step_no as number) })
      .eq("id", id);
    if (park) return { ok: false, error: "writeFailed", detail: park.message };
    const room = await makeRoom(supabase, current.template_id as string, input.stepNo, id);
    if (room) return { ok: false, error: "writeFailed", detail: room };
  }

  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .update(stepRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  const compacted = await compactSteps(supabase, current.template_id as string);
  if (compacted) return { ok: false, error: "writeFailed", detail: compacted };

  revalidatePath("/procurement");
  return { ok: true };
}

export async function deleteStep(id: string): Promise<ProcurementWrite> {
  const supabase = await createClient();
  const { data: current, error: read } = await supabase
    .from("mg2030_procurement_template_step")
    .select("template_id")
    .eq("id", id)
    .maybeSingle();
  if (read || !current) return { ok: false, error: "writeFailed", detail: read?.message };

  const { error } = await supabase
    .from("mg2030_procurement_template_step")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  // Supprimer l'étape 5 sur 10 : les suivantes remontent d'un cran, pour que
  // la séquence reste 1 à 9 sans trou.
  const compacted = await compactSteps(supabase, current.template_id as string);
  if (compacted) return { ok: false, error: "writeFailed", detail: compacted };

  revalidatePath("/procurement");
  return { ok: true };
}

/**
 * Attribue les numéros 1 à n dans l'ordre donné.
 *
 * Deux passes : toutes les étapes sont d'abord garées sur des numéros
 * négatifs, puis reçoivent leur place. En une seule passe, la contrainte
 * d'unicité (template_id, step_no), non différable, refuserait la première
 * étape déplacée sur un numéro encore occupé.
 */
async function renumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderedIds: string[],
): Promise<string | null> {
  for (const [pass, numberOf] of [
    ["park", (i: number) => -(i + 1)],
    ["place", (i: number) => i + 1],
  ] as const) {
    for (const [i, id] of orderedIds.entries()) {
      const { error } = await supabase
        .from("mg2030_procurement_template_step")
        .update({ step_no: numberOf(i) })
        .eq("id", id);
      if (error) return `${pass}: ${error.message}`;
    }
  }
  return null;
}

/**
 * Referme les trous de la numérotation d'un gabarit, en gardant l'ordre.
 *
 * Appelé après CHAQUE écriture d'étape : la séquence reste 1, 2, 3… n quoi
 * qu'on fasse. Ne touche à rien si elle l'est déjà — le cas courant.
 */
async function compactSteps(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("mg2030_procurement_template_step")
    .select("id, step_no")
    .eq("template_id", templateId)
    .order("step_no");
  if (error) return error.message;

  const steps = data ?? [];
  if (steps.every((s, i) => s.step_no === i + 1)) return null;
  return renumber(
    supabase,
    steps.map((s) => s.id as string),
  );
}

/**
 * Réordonne les étapes d'un gabarit : `orderedIds` donne le nouvel ordre, et
 * les numéros sont réattribués de 1 à n (voir `renumber`).
 */
export async function reorderSteps(
  templateId: string,
  orderedIds: string[],
): Promise<ProcurementWrite> {
  const supabase = await createClient();
  const { data, error: read } = await supabase
    .from("mg2030_procurement_template_step")
    .select("id")
    .eq("template_id", templateId);
  if (read) return { ok: false, error: "writeFailed", detail: read.message };

  // L'ordre reçu doit couvrir EXACTEMENT les étapes du gabarit : une liste
  // périmée (étape ajoutée ou supprimée entre-temps) laisserait des doublons.
  const existing = new Set((data ?? []).map((s) => s.id as string));
  if (orderedIds.length !== existing.size || orderedIds.some((id) => !existing.has(id))) {
    return { ok: false, error: "staleOrder" };
  }

  const failed = await renumber(supabase, orderedIds);
  if (failed) return { ok: false, error: "writeFailed", detail: failed };

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
  // Une tâche archivée (supprimée du plan) ne compte pas : l'application lui
  // reprendra son code, et l'étape sera bien recréée.
  const { data: existing } = await supabase
    .from("mg2030_task")
    .select("wbs_code, mg2030_schedule_scenario!inner ( code )")
    .eq("mg2030_schedule_scenario.code", scenarioCode)
    .is("archived_at", null)
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
    .select("id, wbs_code, archived_at")
    .eq("scenario_id", scenario.id)
    .in("wbs_code", expanded.tasks.map((task) => task.wbsCode));

  // ⚠ UNE TÂCHE SUPPRIMÉE GARDE SON CODE. La suppression archive la ligne
  // (archived_at) sans l'effacer, et l'unicité (plan_id, wbs_code) vaut aussi
  // pour elle. Régénérer après avoir supprimé les tâches d'une première
  // génération SAUTAIT donc toutes les étapes déjà numérotées : seules les
  // dernières, nouvelles, apparaissaient — en fin de plan, sans lien.
  //
  // Seules les tâches ACTIVES comptent comme « déjà là ». Une tâche archivée
  // qui détient un code voulu le cède : elle est renommée, pas effacée — la
  // trace reste, sous un code qui ne gêne plus.
  const active = (existing ?? []).filter((r) => r.archived_at === null);
  const archivedHolders = (existing ?? []).filter((r) => r.archived_at !== null);
  for (const holder of archivedHolders) {
    const { error: renameError } = await supabase
      .from("mg2030_task")
      .update({ wbs_code: `${holder.wbs_code}~archived-${(holder.id as string).slice(0, 8)}` })
      .eq("id", holder.id);
    if (renameError) return { ok: false, error: "writeFailed", detail: renameError.message };
  }

  const taken = new Set(active.map((r) => r.wbs_code as string));
  const toCreate = expanded.tasks.filter((task) => !taken.has(task.wbsCode));
  if (toCreate.length === 0) {
    return { ok: true, created: 0, skipped: expanded.tasks.length };
  }

  // Ordre de tri : le marché généré se lit EN BLOC, dans l'ordre des étapes,
  // après les autres tâches du plan. Les étapes déjà présentes (réapplication
  // partielle) rejoignent le bloc au lieu de rester devant les nouvelles.
  const { data: last } = await supabase
    .from("mg2030_task")
    .select("sort_order")
    .eq("scenario_id", scenario.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (last?.sort_order ?? 0) + 10;
  const rank = new Map(expanded.tasks.map((task, i) => [task.wbsCode, base + i]));

  const { data: inserted, error: insertError } = await supabase
    .from("mg2030_task")
    .insert(
      toCreate.map((task) => ({
        wbs_code: task.wbsCode,
        plan_id: planId,
        scenario_id: scenario.id,
        task_type: "task",
        activity: task.activity,
        duration_days: task.durationDays,
        start_date_input: task.startDateInput,
        contract_id: contractId,
        generated_from_step_id: task.stepId,
        sort_order: rank.get(task.wbsCode)!,
      })),
    )
    .select("id, wbs_code");

  if (insertError) return { ok: false, error: "writeFailed", detail: insertError.message };

  for (const row of active) {
    const { error: sortError } = await supabase
      .from("mg2030_task")
      .update({ sort_order: rank.get(row.wbs_code as string)! })
      .eq("id", row.id);
    if (sortError) return { ok: false, error: "writeFailed", detail: sortError.message };
  }

  const createdIds = new Set((inserted ?? []).map((r) => r.id as string));
  const idByWbs = new Map([
    ...active.map((r) => [r.wbs_code as string, r.id as string] as const),
    ...(inserted ?? []).map((r) => [r.wbs_code as string, r.id as string] as const),
  ]);

  // Précédences fin-début, sur TOUTE la séquence : un lien dont l'une des deux
  // extrémités vient d'être créée est posé, que l'autre soit neuve ou déjà là.
  // Auparavant, seuls les liens entre deux tâches neuves l'étaient — une
  // réapplication partielle laissait la séquence coupée en deux.
  const links = expanded.tasks
    .filter((task) => task.predecessorWbs !== null)
    .map((task) => ({
      predecessor_id: idByWbs.get(task.predecessorWbs!),
      successor_id: idByWbs.get(task.wbsCode),
      dependency_type: "FS",
      lag_days: 0,
    }))
    .filter(
      (link) =>
        link.predecessor_id &&
        link.successor_id &&
        (createdIds.has(link.predecessor_id) || createdIds.has(link.successor_id)),
    );

  if (links.length > 0) {
    const { error: linkError } = await supabase.from("mg2030_task_dependency").insert(links);
    if (linkError) return { ok: false, error: "writeFailed", detail: linkError.message };
  }

  // Dates calculées tout de suite, en base : sans ce recalcul, les tâches
  // neuves restaient sans dates persistées jusqu'à la prochaine édition.
  const recomputed = await recomputeAndPersist(scenarioCode, false);
  if (!recomputed.ok) {
    return { ok: false, error: "writeFailed", detail: recomputed.detail ?? recomputed.error };
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
