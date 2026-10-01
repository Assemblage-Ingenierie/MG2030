"use server";

// ============================================================
// app/(app)/roadmap/actions.ts — écriture des actions de roadmap.
//
// RLS SEULE AUTORITÉ : aucune vérification de rôle ici. Un compte sans
// `roadmap.write`, ou rattaché à une organisation en lecture seule, reçoit un
// refus de la base, pas d'ici.
//
// ⚠ LA TIMELINE EST RÉSOLUE PAR LE MODULE PUR, JAMAIS À LA MAIN.
// Le formulaire envoie une PRÉCISION et une date d'ancrage ; `resolveTimeline`
// en tire l'intervalle. Recalculer ici « un mois, c'est le 1er au 30 » serait
// une seconde implémentation de la même règle, donc une divergence certaine.
// C'est aussi lui qui recale l'ancre : cliquer le mercredi 14 avec la précision
// « semaine » désigne la semaine du lundi 12.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveTimeline, type TimelineKind } from "@/lib/roadmap/timeline";
import type { RoadmapPriority, RoadmapStatus } from "@/lib/roadmap/types";

export interface RoadmapInput {
  subjectId: string;
  title: string;
  status: RoadmapStatus | null;
  priority: RoadmapPriority | null;
  timelineKind: TimelineKind | null;
  /** Jour choisi dans la période visée. Recalé par `resolveTimeline`. */
  anchor: string | null;
  /** Dernier jour COMPRIS, pour une plage seulement. */
  rangeEnd: string | null;
  comments: string | null;
  /** Libellés libres : une personne, une organisation, un tiers. */
  assignees: string[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function validate(input: RoadmapInput): string | null {
  if (input.title.trim() === "") return "emptyTitle";
  if (!input.subjectId) return "noSubject";
  // Une précision sans date n'est pas une timeline : on le dit avant
  // l'aller-retour plutôt que de laisser la contrainte de base trancher.
  if (input.timelineKind && !input.anchor) return "missingAnchor";
  if (input.timelineKind === "range") {
    if (!input.rangeEnd) return "missingAnchor";
    if (input.anchor && input.rangeEnd < input.anchor) return "invalidRange";
  }
  return null;
}

function toRow(input: RoadmapInput) {
  const timeline = resolveTimeline(input.timelineKind, input.anchor, input.rangeEnd);
  return {
    subject_id: input.subjectId,
    title: input.title.trim(),
    status: input.status,
    priority: input.priority,
    timeline_kind: timeline.kind,
    timeline_start: timeline.start,
    timeline_end: timeline.end,
    comments: input.comments?.trim() || null,
  };
}

/**
 * Remplace la liste des assignataires.
 *
 * On efface puis on repose, plutôt que de calculer un différentiel : à trois
 * noms par action, le différentiel coûterait une lecture de plus pour un gain
 * nul. Les doublons et les libellés vides sont écartés en amont — la contrainte
 * d'unicité (action, label) les refuserait de toute façon, mais en bloc.
 */
async function replaceAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  labels: string[],
): Promise<string | null> {
  const { error: del } = await supabase
    .from("mg2030_roadmap_assignee")
    .delete()
    .eq("action_id", actionId);
  if (del) return del.message;

  const clean = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (clean.length === 0) return null;

  // Le rattachement à un compte est volontairement laissé NUL ici : il n'est
  // posé qu'à la reprise initiale, où le rapprochement a été vérifié. Deviner
  // un compte à chaque saisie finirait par relier un homonyme.
  const { error } = await supabase.from("mg2030_roadmap_assignee").insert(
    clean.map((label, i) => ({ action_id: actionId, label, app_user_id: null, sort_order: i })),
  );
  return error?.message ?? null;
}

export async function createRoadmapAction(input: RoadmapInput): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();

  // Nouvelle action en fin de sujet : on ne pousse personne.
  const { data: last } = await supabase
    .from("mg2030_roadmap_action")
    .select("sort_order")
    .eq("subject_id", input.subjectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("mg2030_roadmap_action")
    .insert({ ...toRow(input), sort_order: ((last?.sort_order as number) ?? 0) + 10 })
    .select("id")
    .single();

  if (error) return { ok: false, error: "writeFailed" };

  const failed = await replaceAssignees(supabase, data.id as string, input.assignees);
  if (failed) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

export async function updateRoadmapAction(
  id: string,
  input: RoadmapInput,
): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_roadmap_action")
    .update(toRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  const failed = await replaceAssignees(supabase, id, input.assignees);
  if (failed) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * Suppression RÉELLE, et non archivage.
 *
 * La table porte pourtant `archived_at` : il sert au cas où l'on voudrait plus
 * tard garder trace d'une action retirée. Mais une roadmap se nettoie souvent,
 * et une ligne qu'on efface ici n'est pas un fait de gestion comme l'est une
 * demande d'avis retirée — personne n'a besoin d'en retrouver la trace.
 */
export async function deleteRoadmapAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_roadmap_action").delete().eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}
