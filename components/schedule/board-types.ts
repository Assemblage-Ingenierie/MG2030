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
  /** Entité de rattachement (TA, AFD, PIU) : donne la couleur de la barre. */
  orgCode: string | null;
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
  | "successors"
  | "owner"
  | "contract"
  | "progress";

export const BOARD_COLUMNS: BoardColumn[] = [
  "activity",
  "duration",
  "start",
  "predecessors",
  "successors",
  "owner",
  "contract",
  "progress",
];

/**
 * Jeu réduit : les colonnes qui portent le CALENDRIER.
 *
 * Les précédences en font partie et non le responsable : c'est la précédence
 * qui explique une date, et l'écran sert d'abord à comprendre pourquoi une
 * tâche tombe là.
 *
 * Les SUIVANTES y figurent aussi, au prix de 88 px pris au diagramme. C'est le
 * seul moyen de planifier à rebours sans passer par le jeu complet — et
 * planifier à rebours est le mode normal ici : la date d'ouverture des Jeux ne
 * se déplacera pas, donc on remonte depuis elle plutôt que de dérouler depuis
 * aujourd'hui.
 */
export const COMPACT_COLUMNS: BoardColumn[] = [
  "activity",
  "duration",
  "start",
  "predecessors",
  "successors",
];

/**
 * Jeu NU : l'activité, et le diagramme.
 *
 * C'est la vue de lecture — celle qu'on projette en réunion et qu'on imprime.
 * Toute colonne intermédiaire y est du bruit : on ne vient pas y saisir, on
 * vient regarder où tombent les barres, et chaque colonne retirée est 60 à
 * 90 px rendus au diagramme. Demandé le 01/10/2026.
 *
 * La fin de tâche reste affichée : elle est hors du jeu de colonnes (voir
 * `gridWidth`), et une barre sans sa date de fin lisible oblige à viser
 * l'échelle de temps à l'œil.
 */
export const BARE_COLUMNS: BoardColumn[] = ["activity"];

/**
 * Trois densités, et chacune répond à une question différente :
 *   • `bare`    — où en est-on ? (lecture, projection, impression)
 *   • `compact` — pourquoi cette tâche tombe-t-elle là ? (précédences)
 *   • `all`     — qui la tient, sur quel marché, à quel avancement ? (saisie)
 */
export type Density = "bare" | "compact" | "all";

export const DENSITIES: Density[] = ["bare", "compact", "all"];

export const isDensity = (v: string): v is Density =>
  (DENSITIES as string[]).includes(v);

export function visibleColumns(density: Density): BoardColumn[] {
  if (density === "bare") return BARE_COLUMNS;
  return density === "compact" ? COMPACT_COLUMNS : BOARD_COLUMNS;
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
  successors: 88,
  owner: 130,
  contract: 110,
  progress: 58,
};

/**
 * Largeur du volet de gauche : numéro, colonnes visibles, fin, actions.
 *
 * ⚠ LA COLONNE « FIN » SUIT « DÉBUT ». Elle n'est pas dans `BoardColumn` — elle
 * n'est pas éditable, c'est début + durée — mais elle occupe bien une colonne.
 * Sa largeur était comptée en toutes circonstances : avec le jeu NU, qui ne
 * garde que l'activité, le volet réservait 90 px à une colonne qu'il ne
 * dessinait plus. Même règle que `renderOrder`, et c'est voulu : les deux
 * doivent dire la même chose.
 */
export function gridWidth(columns: BoardColumn[], actionsWidth: number): number {
  return (
    COLUMN_WIDTH.rowNo +
    (columns.includes("start") ? COLUMN_WIDTH.end : 0) +
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
    return column === "activity" || column === "owner" || column === "contract";
  }
  if (task.type === "milestone") {
    return (
      column === "activity" ||
      column === "start" ||
      column === "predecessors" ||
      column === "successors" ||
      column === "owner" ||
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
