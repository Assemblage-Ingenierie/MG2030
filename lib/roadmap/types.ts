// ============================================================
// lib/roadmap/types.ts — vocabulaire du module Roadmap.
//
// Séparé de `lib/queries/roadmap.ts`, qui porte `import "server-only"` : ce
// fichier-ci doit rester importable par le filtre pur et par ses tests, qui
// tournent hors serveur. Même découpage que `lib/schedule/types.ts`.
// ============================================================

import type { Timeline } from "./timeline";

export type RoadmapStatus = "not_started" | "pending" | "in_progress" | "done";
export type RoadmapPriority = "low" | "medium" | "high" | "urgent";

/** Ordre d'avancement, pour les listes déroulantes. */
export const ROADMAP_STATUSES: RoadmapStatus[] = [
  "not_started",
  "pending",
  "in_progress",
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
