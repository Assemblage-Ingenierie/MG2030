// ============================================================
// components/schedule/board-types.ts — modèle partagé entre la grille de
// saisie et le volet Gantt, pour garantir qu'ils décrivent LES MÊMES lignes,
// dans le même ordre, à la même hauteur.
//
// L'alignement ligne à ligne des deux volets tient entièrement à cela : une
// seule liste, une seule constante de hauteur.
//
// Le MODÈLE lui-même vit dans lib/schedule/board-model.ts : il est pur, donc
// testé. Ce fichier ne porte que la géométrie et les règles d'affichage.
// ============================================================

import { filterKeepingAncestors } from "@/lib/schedule/tree";
import type { ModelTask } from "@/lib/schedule/board-model";

/** La ligne de la grille EST la tâche du modèle : aucune traduction entre les deux. */
export type BoardTask = ModelTask;

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

export interface ContractChoice {
  id: string;
  contractCode: string;
  name: string;
}

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

/** Colonnes de la grille, dans l'ordre de tabulation. */
export type BoardColumn =
  | "activity"
  | "duration"
  | "start"
  | "predecessors"
  | "owner"
  | "contract"
  | "site"
  | "progress";

export const BOARD_COLUMNS: BoardColumn[] = [
  "activity",
  "duration",
  "start",
  "predecessors",
  "owner",
  "contract",
  "site",
  "progress",
];

/**
 * Jeu réduit : les quatre colonnes qui portent le CALENDRIER.
 *
 * Les précédences en font partie et non le responsable : c'est la précédence
 * qui explique une date, et l'écran sert d'abord à comprendre pourquoi une
 * tâche tombe là.
 */
export const COMPACT_COLUMNS: BoardColumn[] = [
  "activity",
  "duration",
  "start",
  "predecessors",
];

export function visibleColumns(compact: boolean): BoardColumn[] {
  return compact ? COMPACT_COLUMNS : BOARD_COLUMNS;
}

/** Largeurs en pixels. Le total fixe la largeur du volet de gauche. */
export const COLUMN_WIDTH: Record<BoardColumn | "rowNo" | "end", number> = {
  /** Numéro de ligne : la clé que l'utilisateur manipule pour les précédences. */
  rowNo: 40,
  activity: 250,
  duration: 62,
  start: 90,
  end: 90,
  predecessors: 88,
  owner: 120,
  contract: 88,
  site: 92,
  progress: 58,
};

/** Largeur du volet de gauche : numéro, colonnes visibles, fin, actions. */
export function gridWidth(columns: BoardColumn[], actionsWidth: number): number {
  return (
    COLUMN_WIDTH.rowNo +
    COLUMN_WIDTH.end +
    columns.reduce((sum, column) => sum + COLUMN_WIDTH[column], 0) +
    actionsWidth
  );
}

/**
 * Ordre de rendu, en-tête et lignes CONFONDUS.
 *
 * « Fin » s'insère juste après « Début » et non en queue : c'est la colonne
 * qu'on vient lire, et l'éloigner de son début casse la lecture. Les deux
 * volets dérivent de cette même liste — sans quoi masquer une colonne les
 * décalait l'un par rapport à l'autre.
 */
export function renderOrder(columns: BoardColumn[]): (BoardColumn | "end")[] {
  const out: (BoardColumn | "end")[] = [];
  for (const column of columns) {
    out.push(column);
    if (column === "start") out.push("end");
  }
  return out;
}

export const RIGHT_ALIGNED = new Set<BoardColumn | "end">([
  "duration",
  "start",
  "end",
  "progress",
]);

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
    return (
      column === "activity" ||
      column === "owner" ||
      column === "site" ||
      column === "contract"
    );
  }
  if (task.type === "milestone") {
    return (
      column === "activity" ||
      column === "start" ||
      column === "predecessors" ||
      column === "owner" ||
      column === "site" ||
      column === "contract"
    );
  }
  return true;
}

/**
 * La date de début est-elle SAISISSABLE, ou bien résulte-t-elle du calcul ?
 *
 * Dès qu'une tâche a un prédécesseur, son début vaut la fin de celui-ci : c'est
 * la définition de fin-début. Laisser le champ ouvert permettait d'avancer le
 * début sans que le prédécesseur bouge — le lien affiché à l'écran ne
 * correspondait alors plus à rien, et la « logique fin-début » n'était vraie
 * qu'aussi longtemps qu'on n'y touchait pas.
 *
 * Pour détacher une tâche, on vide sa colonne de précédences. C'est explicite,
 * visible, et réversible.
 */
export function isStartEditable(task: BoardTask, hasPredecessor: boolean): boolean {
  return !hasPredecessor && isCellEditable(task, "start");
}
