// ============================================================
// components/schedule/board-types.ts — modèle partagé entre la grille de
// saisie et le volet Gantt, pour garantir qu'ils décrivent LES MÊMES lignes,
// dans le même ordre, à la même hauteur.
//
// L'alignement ligne à ligne des deux volets tient entièrement à cela : une
// seule liste, une seule constante de hauteur.
// ============================================================

import { filterKeepingAncestors } from "@/lib/schedule/tree";

/**
 * Filtre le plan en conservant les ascendants des lignes retenues.
 * L'implémentation est pure et testée dans lib/schedule/tree.ts.
 */
export function filterTree(
  tasks: BoardTask[],
  keep: (task: BoardTask) => boolean,
): BoardTask[] {
  return filterKeepingAncestors(tasks, keep);
}

export interface BoardTask {
  id: string;
  wbsCode: string;
  activity: string;
  type: "task" | "summary" | "milestone" | "group_header";
  parentId: string | null;
  depth: number;
  durationDays: number | null;
  /** Date calculée par le moteur. */
  start: string | null;
  end: string | null;
  /** Ancre saisie à la main : la date est figée, elle ne suit plus les précédences. */
  startAnchor: string | null;
  /** Contrainte « pas avant ». */
  constraintDate: string | null;
  progressPct: number | null;
  ownerId: string | null;
  ownerName: string | null;
  contractCode: string | null;
  /** Sous-projet porté par la tâche. Nul pour les jalons transverses. */
  subproject: "athletes_village" | "training_venues" | null;
  /** Site précis, quand la PIU a affiné hall par hall. */
  siteId: string | null;
  siteCode: string | null;
  /** Codes WBS des prédécesseurs, tels qu'ils s'affichent et se saisissent. */
  predecessorCodes: string[];
  /** Ce qui détermine la date de début — sert à l'expliquer sans la déplier. */
  driver: string | null;
  drivingPredecessor: string | null;
  drifted: boolean;
}

export interface PersonOption {
  id: string;
  fullName: string;
  roleCode: string;
}

export interface SiteChoice {
  id: string;
  siteCode: string;
  name: string;
  subproject: "athletes_village" | "training_venues";
}

/** Colonnes de la grille, dans l'ordre de tabulation. */
export type BoardColumn =
  | "activity"
  | "duration"
  | "start"
  | "owner"
  | "predecessors"
  | "site"
  | "progress";

export const BOARD_COLUMNS: BoardColumn[] = [
  "activity",
  "duration",
  "start",
  "owner",
  "predecessors",
  "site",
  "progress",
];

/** Largeurs en pixels. Le total fixe la largeur du volet de gauche. */
export const COLUMN_WIDTH: Record<BoardColumn | "wbs" | "end", number> = {
  wbs: 72,
  activity: 260,
  duration: 74,
  start: 92,
  end: 92,
  owner: 130,
  predecessors: 100,
  site: 104,
  progress: 62,
};

export const GRID_WIDTH =
  COLUMN_WIDTH.wbs +
  COLUMN_WIDTH.activity +
  COLUMN_WIDTH.duration +
  COLUMN_WIDTH.start +
  COLUMN_WIDTH.end +
  COLUMN_WIDTH.owner +
  COLUMN_WIDTH.predecessors +
  COLUMN_WIDTH.site +
  COLUMN_WIDTH.progress;

/**
 * Une cellule est éditable selon le TYPE de la tâche.
 *
 *  • `group_header` — intertitre : ni durée ni date, il organise la liste.
 *  • `summary`      — récapitulatif : ses dates viennent de ses enfants, les
 *                     modifier n'aurait aucun effet. On ne le propose donc pas.
 *  • `milestone`    — jalon : durée nulle par construction.
 */
export function isCellEditable(task: BoardTask, column: BoardColumn): boolean {
  if (task.type === "group_header") return column === "activity";
  if (task.type === "summary") {
    return column === "activity" || column === "owner" || column === "site";
  }
  if (task.type === "milestone") {
    return (
      column === "activity" || column === "start" || column === "owner" || column === "site"
    );
  }
  return true;
}
