// ============================================================
// lib/schedule/types.ts — modèle du moteur de planification.
//
// Module PUR : aucune dépendance base, réseau ni React. C'est ce qui permet de
// le tester sans infrastructure et de le partager entre la grille de saisie et
// le Gantt, de sorte que les deux vues ne puissent pas diverger.
// ============================================================

/** Date calendaire ISO `YYYY-MM-DD`. Jamais un `Date` : pas d'heure, pas de fuseau. */
export type IsoDate = string;

export type TaskType = "task" | "summary" | "milestone" | "group_header";

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type ConstraintKind =
  | "start_no_earlier_than"
  | "start_no_later_than"
  | "finish_no_earlier_than"
  | "finish_no_later_than"
  | "must_start_on"
  | "must_finish_on";

/** Entrée du moteur. Les dates calculées n'en font PAS partie. */
export interface TaskInput {
  id: string;
  wbsCode: string;
  type: TaskType;
  parentId: string | null;
  /** Jours CALENDAIRES. `null` sur un récapitulatif, un intertitre, un jalon. */
  durationDays: number | null;
  /** Ancre saisie à la main. Prime sur tout, y compris les prédécesseurs. */
  startDateInput: IsoDate | null;
  /** Ordre d'affichage entre frères. */
  sortOrder: number;
}

export interface DependencyInput {
  predecessorId: string;
  successorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface ConstraintInput {
  taskId: string;
  kind: ConstraintKind;
  date: IsoDate;
}

export interface ScheduleInput {
  tasks: TaskInput[];
  dependencies: DependencyInput[];
  constraints: ConstraintInput[];
  /**
   * Date de repli pour une tâche sans ancre, sans contrainte et sans
   * prédécesseur. Sans elle, une tâche orpheline resterait sans date.
   */
  projectStart: IsoDate;
}

/** Sortie : une fenêtre par tâche. */
export interface TaskWindow {
  id: string;
  wbsCode: string;
  type: TaskType;
  /** `null` sur un intertitre, qui n'a jamais de date. */
  start: IsoDate | null;
  end: IsoDate | null;
  durationDays: number | null;
  /** Ce qui a déterminé le début — pour expliquer une date à l'utilisateur. */
  driver: "input" | "constraint" | "predecessor" | "children" | "project-start" | "none";
  /** WBS du prédécesseur déterminant, quand `driver === "predecessor"`. */
  drivingPredecessor: string | null;
}

export interface ScheduleResult {
  windows: Map<string, TaskWindow>;
  /** Ordre topologique retenu, utile au diagnostic. */
  order: string[];
}

/** Cycle de précédence : le planning n'est pas calculable. */
export class ScheduleCycleError extends Error {
  constructor(public readonly cycle: string[]) {
    super(
      `Cycle de precedence : ${cycle.join(" -> ")}. ` +
        `Le planning ne peut pas etre calcule tant qu'il subsiste.`,
    );
    this.name = "ScheduleCycleError";
  }
}

/**
 * Type de dépendance non implémenté.
 *
 * Le seed ne produit que du fin-début. SS / FF / SF sont déclarés au schéma
 * pour éviter une migration ultérieure, mais le moteur refuse explicitement
 * de les traiter plutôt que de les ignorer en silence — un décalage silencieux
 * serait invisible jusqu'à la première dérive de planning.
 */
export class UnsupportedDependencyError extends Error {
  constructor(public readonly type: DependencyType) {
    super(
      `Type de precedence non implemente : ${type}. ` +
        `Seul FS (fin-debut) est gere en version 1.`,
    );
    this.name = "UnsupportedDependencyError";
  }
}
