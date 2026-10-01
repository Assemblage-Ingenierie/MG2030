// ============================================================
// lib/roadmap/types.ts — vocabulaire du module Roadmap.
//
// Séparé de `lib/queries/roadmap.ts`, qui porte `import "server-only"` : ce
// fichier-ci doit rester importable par le filtre pur et par ses tests, qui
// tournent hors serveur. Même découpage que `lib/schedule/types.ts`.
// ============================================================

import type { Timeline } from "./timeline";

export type RoadmapStatus =
  | "not_started"
  | "pending"
  | "in_progress"
  | "blocked"
  | "done";
export type RoadmapPriority = "low" | "medium" | "high" | "urgent";

/**
 * Ordre d'avancement. `blocked` se place APRÈS « en cours » et avant
 * « terminé » : on ne se bloque que sur quelque chose qu'on a commencé, et
 * c'est l'état dont on veut sortir.
 */
export const ROADMAP_STATUSES: RoadmapStatus[] = [
  "not_started",
  "pending",
  "in_progress",
  "blocked",
  "done",
];

/** Du moins au plus pressant. L'affichage, lui, montre l'urgent en premier. */
export const ROADMAP_PRIORITIES: RoadmapPriority[] = ["low", "medium", "high", "urgent"];

/** Rang d'une priorité, pour trier du plus pressant au moins. */
export const PRIORITY_RANK: Record<RoadmapPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface RoadmapSubjectRow {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

/**
 * Entités assignables, en plus des comptes nominatifs.
 *
 * Une action incombe souvent à une STRUCTURE et non à quelqu'un : « l'AFD doit
 * envoyer le GEP » n'a pas de destinataire nommé, et en inventer un serait
 * faux. Les trois codes sont ceux de `mg2030_organisation`, déjà employés pour
 * colorer les barres du plan de charge — pas une seconde liste à maintenir.
 */
export const ASSIGNEE_ENTITIES = ["AFD", "TA", "PIU"] as const;
export type AssigneeEntity = (typeof ASSIGNEE_ENTITIES)[number];

export function isAssigneeEntity(label: string): label is AssigneeEntity {
  return (ASSIGNEE_ENTITIES as readonly string[]).includes(label);
}

export interface RoadmapAssignee {
  label: string;
  /** Renseigné quand le libellé désigne un compte. Souvent nul, et c'est normal. */
  appUserId: string | null;
}

export interface RoadmapActionRow {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  /** Nuls quand personne ne les a renseignés. On ne comble pas. */
  status: RoadmapStatus | null;
  priority: RoadmapPriority | null;
  timeline: Timeline;
  comments: string | null;
  sortOrder: number;
  assignees: RoadmapAssignee[];
}
