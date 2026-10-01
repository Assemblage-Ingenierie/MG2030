// ============================================================
// lib/roadmap/filter.ts — filtrage et regroupement de la liste.
//
// Pur, donc testé. Ce n'est PAS un filtre de sécurité : la RLS décide seule qui
// lit quoi. Ici on ne fait que choisir ce qu'on montre.
//
// ⚠ LA RÈGLE QUI SURPREND : les actions TERMINÉES sont masquées par défaut.
// Une roadmap sert à savoir ce qu'il reste à faire ; au bout de six mois, le
// fait accompli occupe les trois quarts de l'écran et noie le reste. Mais
// masquer sans le dire ferait croire à une perte de données — d'où
// `hiddenCompleted`, qui permet à l'écran d'annoncer le nombre escamoté et de
// proposer de les montrer.
// ============================================================

import { overlaps, timelineSortKey } from "./timeline";
import { PRIORITY_RANK, type RoadmapActionRow, type RoadmapPriority, type RoadmapStatus } from "./types";

/** Comment la timeline entre dans le filtre. */
export type DateFilter = "all" | "dated" | "undated";

export interface RoadmapFilters {
  priority: RoadmapPriority | null;
  status: RoadmapStatus | null;
  /** Libellé exact, tel qu'il figure sur l'action. */
  assignee: string | null;
  date: DateFilter;
  /** Fenêtre [from, to) facultative, pour la vue timeline. */
  from?: string | null;
  to?: string | null;
  showCompleted: boolean;
}

export const DEFAULT_FILTERS: RoadmapFilters = {
  priority: null,
  status: null,
  assignee: null,
  date: "all",
  showCompleted: false,
};

export interface FilterOutcome {
  actions: RoadmapActionRow[];
  /**
   * Nombre d'actions terminées écartées par le seul fait qu'on les masque.
   *
   * Compté APRÈS les autres filtres : annoncer « 12 terminées masquées » alors
   * que onze d'entre elles seraient de toute façon exclues par le filtre de
   * priorité serait un chiffre faux.
   */
  hiddenCompleted: number;
}

export function applyFilters(
  actions: RoadmapActionRow[],
  filters: RoadmapFilters,
): FilterOutcome {
  const matching = actions.filter((a) => matchesExceptCompleted(a, filters));
  const hiddenCompleted = matching.filter((a) => a.status === "done").length;

  return {
    actions: filters.showCompleted ? matching : matching.filter((a) => a.status !== "done"),
    hiddenCompleted: filters.showCompleted ? 0 : hiddenCompleted,
  };
}

function matchesExceptCompleted(a: RoadmapActionRow, f: RoadmapFilters): boolean {
  if (f.priority && a.priority !== f.priority) return false;
  if (f.status && a.status !== f.status) return false;
  if (f.assignee && !a.assignees.some((x) => x.label === f.assignee)) return false;

  if (f.date === "dated" && a.timeline.kind === null) return false;
  if (f.date === "undated" && a.timeline.kind !== null) return false;

  // Une fenêtre ne retient que ce qui la recoupe. Une action sans date n'en
  // recoupe aucune : c'est `overlaps` qui le dit, et c'est voulu — elle ne
  // tombe nulle part, on ne peut donc pas affirmer qu'elle tombe ici.
  if (f.from && f.to && !overlaps(a.timeline, f.from, f.to)) return false;

  return true;
}

export interface RoadmapGroup {
  subjectId: string;
  subjectName: string;
  actions: RoadmapActionRow[];
}

/**
 * Regroupe par sujet, en conservant l'ordre du tableur.
 *
 * Un sujet qui n'a plus d'action visible DISPARAÎT : garder un intertitre vide
 * ferait croire à un chargement incomplet.
 */
export function groupBySubject(actions: RoadmapActionRow[]): RoadmapGroup[] {
  const groups = new Map<string, RoadmapGroup>();
  for (const action of actions) {
    const found = groups.get(action.subjectId);
    if (found) found.actions.push(action);
    else
      groups.set(action.subjectId, {
        subjectId: action.subjectId,
        subjectName: action.subjectName,
        actions: [action],
      });
  }
  return [...groups.values()];
}

/**
 * Tri à l'intérieur d'un sujet : d'abord l'échéance, puis l'urgence.
 *
 * La date passe AVANT la priorité, et ce n'est pas indifférent : une action
 * « moyenne » due cette semaine demande une décision plus tôt qu'une
 * « urgente » sans date. Trier par priorité d'abord remonterait en tête une
 * colonne d'urgences dont aucune n'est datée.
 */
export function sortActions(actions: RoadmapActionRow[]): RoadmapActionRow[] {
  return actions.slice().sort((a, b) => {
    const ka = timelineSortKey(a.timeline);
    const kb = timelineSortKey(b.timeline);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    if (ka[1] !== kb[1]) return ka[1] < kb[1] ? -1 : 1;
    if (ka[2] !== kb[2]) return ka[2] - kb[2];

    const pa = a.priority ? PRIORITY_RANK[a.priority] : 99;
    const pb = b.priority ? PRIORITY_RANK[b.priority] : 99;
    if (pa !== pb) return pa - pb;

    return a.sortOrder - b.sortOrder;
  });
}
