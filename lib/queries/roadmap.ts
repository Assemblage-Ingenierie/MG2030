import "server-only";

// ============================================================
// lib/queries/roadmap.ts — lecture de la roadmap.
//
// Ce module ne REFILTRE RIEN : la RLS décide seule qui lit quoi (brief §8).
// Les filtres posés ici sont des filtres d'AFFICHAGE, demandés par l'écran —
// priorité, statut, assignataire, période — et non des filtres de sécurité.
//
// La timeline arrive en trois colonnes et repart en un objet `Timeline` : le
// reste de l'application ne manipule jamais le triplet brut, c'est la seule
// façon de garantir qu'on n'écrira pas une semaine comme un jour.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { NO_TIMELINE, type Timeline, type TimelineKind } from "@/lib/roadmap/timeline";
import type {
  RoadmapActionRow,
  RoadmapPriority,
  RoadmapStatus,
  RoadmapSubjectRow,
} from "@/lib/roadmap/types";

// Ré-exportés pour que les écrans n'aient qu'un seul import à faire.
export type { RoadmapActionRow, RoadmapSubjectRow } from "@/lib/roadmap/types";

interface RawAction {
  id: string;
  subject_id: string;
  title: string;
  status: RoadmapStatus | null;
  priority: RoadmapPriority | null;
  timeline_kind: TimelineKind | null;
  timeline_start: string | null;
  timeline_end: string | null;
  comments: string | null;
  sort_order: number;
  mg2030_roadmap_subject: { name: string } | null;
  mg2030_roadmap_assignee: { label: string; app_user_id: string | null; sort_order: number }[];
}

export async function listRoadmapSubjects(): Promise<RoadmapSubjectRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_roadmap_subject")
    .select("id, code, name, sort_order")
    .order("sort_order");

  if (error) throw new Error(`Lecture des sujets de roadmap : ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    sortOrder: r.sort_order as number,
  }));
}

/**
 * Toutes les actions non archivées, avec leur sujet et leurs assignataires.
 *
 * Aucun filtre n'est appliqué ICI : le volume est celui d'une roadmap de
 * pilotage — quelques dizaines de lignes — et filtrer côté base obligerait à
 * refaire l'aller-retour à chaque clic sur un filtre. L'écran filtre en
 * mémoire, et conserve ainsi les compteurs « combien sont masquées ».
 */
export async function listRoadmapActions(
  /**
   * `false` (défaut) : les actions courantes. `true` : les ARCHIVÉES, et elles
   * seules — on ne mélange jamais les deux dans une même liste, sinon une
   * ligne archivée se relirait comme une ligne active.
   */
  archived = false,
): Promise<RoadmapActionRow[]> {
  const supabase = await createClient();
  const query = supabase
    .from("mg2030_roadmap_action")
    .select(
      `id, subject_id, title, status, priority,
       timeline_kind, timeline_start, timeline_end,
       comments, sort_order,
       mg2030_roadmap_subject ( name ),
       mg2030_roadmap_assignee ( label, app_user_id, sort_order )`,
    )
    .order("sort_order");

  const { data, error } = archived
    ? await query.not("archived_at", "is", null)
    : await query.is("archived_at", null);

  if (error) throw new Error(`Lecture de la roadmap : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as RawAction;
    return {
      id: r.id,
      subjectId: r.subject_id,
      subjectName: r.mg2030_roadmap_subject?.name ?? "",
      title: r.title,
      status: r.status,
      priority: r.priority,
      timeline: toTimeline(r),
      comments: r.comments,
      sortOrder: r.sort_order,
      assignees: (r.mg2030_roadmap_assignee ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a) => ({ label: a.label, appUserId: a.app_user_id })),
    };
  });
}

/**
 * Les libellés d'assignataires réellement employés, pour alimenter le filtre.
 *
 * On les lit dans les DONNÉES plutôt que dans un référentiel : « Alban », « TA »
 * et « G8 » n'existent nulle part ailleurs, et un filtre bâti sur la liste des
 * comptes ne les proposerait jamais.
 */
export function assigneeLabels(actions: RoadmapActionRow[]): string[] {
  const seen = new Set<string>();
  for (const action of actions) for (const a of action.assignees) seen.add(a.label);
  return [...seen].sort((a, b) => a.localeCompare(b));
}

/** Les trois colonnes de la base en un objet, ou l'absence de date. */
function toTimeline(r: RawAction): Timeline {
  if (!r.timeline_kind || !r.timeline_start || !r.timeline_end) return NO_TIMELINE;
  return { kind: r.timeline_kind, start: r.timeline_start, end: r.timeline_end };
}
