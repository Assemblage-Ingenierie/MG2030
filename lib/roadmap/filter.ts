// ============================================================
// lib/roadmap/filter.ts — filtrage, tri et regroupement de la liste.
//
// Pur, donc testé. Ce n'est PAS un filtre de sécurité : la RLS décide seule qui
// lit quoi. Ici on ne fait que choisir ce qu'on montre, et dans quel ordre.
//
// ⚠ LA RÈGLE QUI SURPREND : les actions TERMINÉES sont masquées par défaut.
// Une roadmap sert à savoir ce qu'il reste à faire ; au bout de six mois, le
// fait accompli occupe les trois quarts de l'écran et noie le reste. Mais
// masquer sans le dire ferait croire à une perte de données — d'où
// `hiddenCompleted`, qui permet à l'écran d'annoncer le nombre escamoté.
// ============================================================

import { overlaps, timelineSortKey } from "./timeline";
import {
  PRIORITY_RANK,
  ROADMAP_STATUSES,
  type RoadmapActionRow,
  type RoadmapPriority,
  type RoadmapStatus,
} from "./types";

export type DateFilter = "all" | "dated" | "undated";

/** Colonnes sur lesquelles on peut trier. */
export type SortColumn = "action" | "timeline" | "status" | "priority" | "assignee";
export type SortDirection = "asc" | "desc";

export interface RoadmapSort {
  column: SortColumn | null;
  direction: SortDirection;
}

export interface RoadmapFilters {
  /** Vide = aucun filtre. Plusieurs valeurs = union (OU). */
  priorities: RoadmapPriority[];
  statuses: RoadmapStatus[];
  assignees: string[];
  date: DateFilter;
  /** Fenêtre [from, to) facultative, pour la vue frise. */
  from?: string | null;
  to?: string | null;
  showCompleted: boolean;
}

export const DEFAULT_FILTERS: RoadmapFilters = {
  priorities: [],
  statuses: [],
  assignees: [],
  date: "all",
  showCompleted: false,
};

export const DEFAULT_SORT: RoadmapSort = { column: null, direction: "asc" };

export interface FilterOutcome {
  actions: RoadmapActionRow[];
  /**
   * Nombre d'actions terminées écartées par le SEUL fait qu'on les masque.
   *
   * Compté APRÈS les autres filtres : annoncer « 12 terminées masquées » alors
   * que onze seraient de toute façon exclues par le filtre de priorité serait
   * un chiffre faux.
   */
  hiddenCompleted: number;
}

export function applyFilters(
  actions: RoadmapActionRow[],
  filters: RoadmapFilters,
): FilterOutcome {
  const matching = actions.filter((a) => matchesExceptCompleted(a, filters));

  // ⚠ DEMANDER « terminées » DANS LE FILTRE LES MONTRE.
  // Sans cela, cocher « Completed » dans la colonne Statut rendait une liste
  // vide : le filtre retenait les terminées, puis le masquage par défaut les
  // retirait toutes. Un filtre explicite doit l'emporter sur un défaut.
  const wantsDone = filters.showCompleted || filters.statuses.includes("done");
  const hiddenCompleted = matching.filter((a) => a.status === "done").length;

  return {
    actions: wantsDone ? matching : matching.filter((a) => a.status !== "done"),
    hiddenCompleted: wantsDone ? 0 : hiddenCompleted,
  };
}

function matchesExceptCompleted(a: RoadmapActionRow, f: RoadmapFilters): boolean {
  if (f.priorities.length > 0 && !(a.priority && f.priorities.includes(a.priority))) {
    return false;
  }
  if (f.statuses.length > 0 && !(a.status && f.statuses.includes(a.status))) return false;
  if (
    f.assignees.length > 0 &&
    !a.assignees.some((x) => f.assignees.includes(x.label))
  ) {
    return false;
  }

  if (f.date === "dated" && a.timeline.kind === null) return false;
  if (f.date === "undated" && a.timeline.kind !== null) return false;

  // Une action sans date ne recoupe AUCUNE fenêtre : elle ne tombe nulle part,
  // on ne peut donc pas affirmer qu'elle tombe ici.
  if (f.from && f.to && !overlaps(a.timeline, f.from, f.to)) return false;

  return true;
}

export interface RoadmapGroup {
  /** `null` pour le groupe des actions SANS SUJET. */
  subjectId: string | null;
  subjectName: string | null;
  actions: RoadmapActionRow[];
}

/**
 * Regroupe par sujet, dans l'ordre DU RÉFÉRENTIEL.
 *
 * ⚠ L'ORDRE DES SUJETS NE SE DÉDUIT PAS DES ACTIONS. Une première version
 * conservait l'ordre d'apparition dans la liste déjà triée : le rang d'un sujet
 * dépendait alors de l'échéance de son action la plus proche, et « Training and
 * capacity building » passait devant « Training venues » parce qu'il contenait
 * la seule action datée des deux.
 *
 * Un sujet sans action visible DISPARAÎT : garder un intertitre vide ferait
 * croire à un chargement incomplet.
 *
 * ⚠ LES ORPHELINES FORMENT UN GROUPE, ELLES NE SE PERDENT PAS. Une action dont
 * le sujet a été supprimé — ou dont le sujet ne figure plus dans le référentiel
 * — tombait auparavant hors de toute boucle et disparaissait de l'écran sans
 * un mot. Elle se range maintenant EN DERNIER, sous un intertitre « sans
 * sujet » : en dernier parce que c'est une anomalie à résorber, pas une
 * rubrique du plan.
 */
export function groupBySubject(
  actions: RoadmapActionRow[],
  subjects: { id: string; name: string }[],
): RoadmapGroup[] {
  const known = new Set(subjects.map((s) => s.id));
  const byId = new Map<string, RoadmapActionRow[]>();
  const orphans: RoadmapActionRow[] = [];

  for (const action of actions) {
    if (action.subjectId === null || !known.has(action.subjectId)) {
      orphans.push(action);
      continue;
    }
    const found = byId.get(action.subjectId);
    if (found) found.push(action);
    else byId.set(action.subjectId, [action]);
  }

  const groups: RoadmapGroup[] = subjects
    .filter((s) => (byId.get(s.id) ?? []).length > 0)
    .map((s) => ({
      subjectId: s.id as string | null,
      subjectName: s.name as string | null,
      actions: byId.get(s.id) ?? [],
    }));

  if (orphans.length > 0) {
    groups.push({ subjectId: null, subjectName: null, actions: orphans });
  }
  return groups;
}

/**
 * Tri.
 *
 * Sans colonne choisie, l'ordre par défaut met l'ÉCHÉANCE avant l'urgence. Ce
 * n'est pas indifférent : une action « moyenne » due cette semaine demande une
 * décision plus tôt qu'une « urgente » sans date, et trier par priorité d'abord
 * remonterait en tête une colonne d'urgences dont aucune n'est datée.
 *
 * Une colonne explicitement choisie l'emporte, mais le défaut reste le
 * départage : deux actions de même statut se rangent encore par échéance.
 */
export function sortActions(
  actions: RoadmapActionRow[],
  sort: RoadmapSort = DEFAULT_SORT,
): RoadmapActionRow[] {
  const sign = sort.direction === "desc" ? -1 : 1;

  return actions.slice().sort((a, b) => {
    if (sort.column) {
      // ⚠ LES VALEURS ABSENTES RESTENT EN DERNIER, DANS LES DEUX SENS.
      // Elles sont comparées AVANT le tri de colonne, donc hors du facteur
      // d'inversion. Sans cela, trier « par priorité décroissante » remontait
      // en tête un bloc de cases vides : celui qui trie par priorité cherche
      // des priorités, pas des trous. C'est aussi la convention des tableurs.
      const ma = isMissing(a, sort.column);
      const mb = isMissing(b, sort.column);
      if (ma !== mb) return ma ? 1 : -1;

      const d = compareColumn(a, b, sort.column);
      if (d !== 0) return d * sign;
    }
    return defaultCompare(a, b);
  });
}

/** Une colonne est « absente » quand rien n'y a été renseigné. */
function isMissing(a: RoadmapActionRow, column: SortColumn): boolean {
  switch (column) {
    case "action":
      return false;
    case "timeline":
      return a.timeline.kind === null;
    case "status":
      return a.status === null;
    case "priority":
      return a.priority === null;
    case "assignee":
      return a.assignees.length === 0;
  }
}

function compareColumn(
  a: RoadmapActionRow,
  b: RoadmapActionRow,
  column: SortColumn,
): number {
  switch (column) {
    case "action":
      return a.title.localeCompare(b.title);
    case "timeline": {
      const ka = timelineSortKey(a.timeline);
      const kb = timelineSortKey(b.timeline);
      if (ka[0] !== kb[0]) return ka[0] - kb[0];
      if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
      return ka[2] - kb[2];
    }
    case "status":
      return statusRank(a.status) - statusRank(b.status);
    case "priority":
      return priorityRank(a.priority) - priorityRank(b.priority);
    case "assignee":
      // Sur le PREMIER assignataire : c'est celui qu'on lit, et c'est aussi
      // celui qui porte l'action dans la plupart des lignes.
      return (a.assignees[0]?.label ?? "").localeCompare(b.assignees[0]?.label ?? "");
  }
}

function defaultCompare(a: RoadmapActionRow, b: RoadmapActionRow): number {
  const ka = timelineSortKey(a.timeline);
  const kb = timelineSortKey(b.timeline);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
  if (ka[2] !== kb[2]) return ka[2] - kb[2];

  const pa = priorityRank(a.priority);
  const pb = priorityRank(b.priority);
  if (pa !== pb) return pa - pb;

  return a.sortOrder - b.sortOrder;
}

/** Une valeur absente se range APRÈS celles qui existent, jamais avant. */
function priorityRank(p: RoadmapPriority | null): number {
  return p ? PRIORITY_RANK[p] : 99;
}

function statusRank(s: RoadmapStatus | null): number {
  return s ? ROADMAP_STATUSES.indexOf(s) : 99;
}
