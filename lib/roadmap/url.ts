// ============================================================
// lib/roadmap/url.ts — l'état de l'écran vit dans l'URL.
//
// Filtres, tri et vue se lisent et s'écrivent ici, à un seul endroit. Le
// sélecteur de vue est rendu par le serveur, les en-têtes de colonnes par le
// navigateur : sans module commun, les deux construiraient l'URL chacun à sa
// façon et finiraient par se contredire — l'un effaçant le filtre que l'autre
// vient de poser.
//
// Pur, donc testé. Et conséquence utile : une vue se partage par un lien et
// survit au rechargement.
// ============================================================

import { DEFAULT_FILTERS, type DateFilter, type RoadmapFilters, type RoadmapSort, type SortColumn, type SortDirection } from "./filter";
import { ROADMAP_PRIORITIES, ROADMAP_STATUSES, type RoadmapPriority, type RoadmapStatus } from "./types";

export type RoadmapView = "list" | "timeline";

export interface RoadmapParams {
  view: RoadmapView;
  filters: RoadmapFilters;
  sort: RoadmapSort;
}

const SORT_COLUMNS: SortColumn[] = ["action", "timeline", "status", "priority", "assignee"];

/** Valeur brute d'un paramètre, telle que Next la rend. */
type Raw = string | string[] | undefined;

const one = (v: Raw): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

/** `urgent,high` → `["urgent", "high"]`, en écartant ce qui n'existe pas. */
function list<T extends string>(v: Raw, allowed: readonly T[]): T[] {
  return one(v)
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is T => (allowed as readonly string[]).includes(s));
}

/**
 * Lit l'état depuis l'URL.
 *
 * Toute valeur inconnue retombe sur le défaut : les paramètres viennent de
 * l'extérieur, et filtrer sur une chaîne arbitraire rendrait une liste vide
 * sans que personne comprenne pourquoi.
 */
export function parseRoadmapParams(params: Record<string, Raw>): RoadmapParams {
  const date = one(params.date);
  const sortColumn = one(params.sort) as SortColumn;

  return {
    view: one(params.view) === "timeline" ? "timeline" : "list",
    filters: {
      ...DEFAULT_FILTERS,
      priorities: list<RoadmapPriority>(params.priority, ROADMAP_PRIORITIES),
      statuses: list<RoadmapStatus>(params.status, ROADMAP_STATUSES),
      // Les assignataires sont du texte LIBRE : aucune liste de référence ne
      // les contient tous, on ne peut donc pas les valider contre un ensemble.
      assignees: one(params.assignee)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      date: (date === "dated" || date === "undated" ? date : "all") as DateFilter,
      showCompleted: one(params.completed) === "1",
    },
    sort: {
      column: SORT_COLUMNS.includes(sortColumn) ? sortColumn : null,
      direction: one(params.dir) === "desc" ? "desc" : "asc",
    },
  };
}

/** Ce qu'on peut changer. `undefined` = garder, et c'est le défaut. */
export interface RoadmapPatch {
  view?: RoadmapView;
  priorities?: RoadmapPriority[];
  statuses?: RoadmapStatus[];
  assignees?: string[];
  date?: DateFilter;
  showCompleted?: boolean;
  sort?: RoadmapSort;
}

/**
 * Construit la requête à partir de l'état courant et d'un changement.
 *
 * ⚠ CE QUI VAUT SA VALEUR PAR DÉFAUT N'EST PAS ÉCRIT. Une URL qui porterait
 * `?view=list&date=all&dir=asc` sur un écran vierge serait illisible, et
 * surtout impossible à comparer : deux liens désignant la même vue n'auraient
 * pas la même adresse.
 */
export function buildRoadmapQuery(current: RoadmapParams, patch: RoadmapPatch = {}): string {
  const p = new URLSearchParams();
  const keep = <T>(given: T | undefined, now: T): T => (given === undefined ? now : given);

  const view = keep(patch.view, current.view);
  if (view !== "list") p.set("view", view);

  const priorities = keep(patch.priorities, current.filters.priorities);
  if (priorities.length > 0) p.set("priority", priorities.join(","));

  const statuses = keep(patch.statuses, current.filters.statuses);
  if (statuses.length > 0) p.set("status", statuses.join(","));

  const assignees = keep(patch.assignees, current.filters.assignees);
  if (assignees.length > 0) p.set("assignee", assignees.join(","));

  const date = keep(patch.date, current.filters.date);
  if (date !== "all") p.set("date", date);

  if (keep(patch.showCompleted, current.filters.showCompleted)) p.set("completed", "1");

  const sort = keep(patch.sort, current.sort);
  if (sort.column) {
    p.set("sort", sort.column);
    if (sort.direction === "desc") p.set("dir", "desc");
  }

  const qs = p.toString();
  return qs ? `/roadmap?${qs}` : "/roadmap";
}

/**
 * Le tri suivant pour une colonne : croissant → décroissant → AUCUN.
 *
 * Le troisième clic rend l'ordre par défaut — échéance puis urgence — au lieu
 * de boucler sur deux états. Sans lui, on ne peut plus revenir à l'ordre
 * métier une fois qu'on a trié, sinon en effaçant l'URL à la main.
 */
export function nextSort(current: RoadmapSort, column: SortColumn): RoadmapSort {
  if (current.column !== column) return { column, direction: "asc" };
  if (current.direction === "asc") return { column, direction: "desc" };
  return { column: null, direction: "asc" };
}

/** Coche ou décoche une valeur d'un filtre multiple. */
export function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
