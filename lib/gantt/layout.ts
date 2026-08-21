// ============================================================
// lib/gantt/layout.ts — géométrie du Gantt : lignes, barres, flèches.
//
// Module PUR. C'est la partie délicate du rendu interne, et c'est du CALCUL —
// donc testable sans DOM. C'est ce qui rend l'option « pas de bibliothèque »
// défendable (docs/GANTT_ARBITRAGE.md §6.2).
// ============================================================

import { toDayNumber } from "@/lib/schedule/dates";
import type { IsoDate, TaskType } from "@/lib/schedule/types";
import { PX_PER_DAY, buildTicks, type ScaleUnit, type Tick } from "./scale";

export const ROW_H = 28;
export const BAR_H = 14;
export const LABEL_W = 300;
export const HEADER_H = 40;

export interface GanttTask {
  id: string;
  wbsCode: string;
  activity: string;
  type: TaskType;
  start: IsoDate | null;
  end: IsoDate | null;
  progressPct: number | null;
  depth: number;
  contractCode: string | null;
}

export interface Bar {
  taskId: string;
  wbsCode: string;
  label: string;
  type: TaskType;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Largeur de la part réalisée, en pixels. 0 si l'avancement est inconnu. */
  progressWidth: number;
  depth: number;
  /**
   * État vis-à-vis d'aujourd'hui.
   *
   * La distinction qui compte est entre RETARD et NON RENSEIGNÉ. Une tâche dont
   * la fin est passée et dont l'avancement est INCONNU n'est pas en retard :
   * on n'en sait rien. L'ancienne règle les confondait — avec un avancement vide
   * sur tout le plan, toute tâche finissant avant aujourd'hui s'affichait en
   * rose. Une plateforme de suivi ne peut pas affirmer un retard que personne
   * n'a constaté ; c'est le genre de chiffre qui remonte à l'AFD.
   */
  status: "normal" | "done" | "late" | "unreported";
  /** Conservé pour compatibilité : vrai seulement si `status === "late"`. */
  isLate: boolean;
  /** Un jalon est rendu en losange, pas en barre. */
  diamond: boolean;
  rowIndex: number;
}

/** Flèche de précédence, en polyligne orthogonale. */
export interface Link {
  from: string;
  to: string;
  points: [number, number][];
  /** Par le flanc gauche de la barre, ou par son dessus. */
  end: LinkEnd;
}

export interface GanttLayout {
  scale: ScaleUnit;
  origin: IsoDate;
  ticks: Tick[];
  pxPerDay: number;
  chartWidth: number;
  chartHeight: number;
  bars: Bar[];
  /** Lignes SANS barre (intertitres) : elles occupent une ligne, sans dessin. */
  rows: { taskId: string; label: string; type: TaskType; depth: number; y: number }[];
  links: Link[];
  todayX: number | null;
  bufferX: number | null;
  deadlineX: number | null;
}

export interface LayoutOptions {
  tasks: GanttTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  scale: ScaleUnit;
  today?: IsoDate;
  bufferStart?: IsoDate | null;
  deadline?: IsoDate | null;
  locale?: "en" | "sq";
}

export function buildLayout(options: LayoutOptions): GanttLayout {
  const { tasks, dependencies, scale, today, bufferStart, deadline, locale = "en" } = options;

  const dated = tasks.filter((t) => t.start && t.end);
  const bounds = timeBounds(dated, [bufferStart, deadline, today]);
  const { origin, ticks, totalDays } = buildTicks(scale, bounds.from, bounds.to, locale);

  const pxPerDay = PX_PER_DAY[scale];
  const originDay = toDayNumber(origin);
  const x = (iso: IsoDate) => (toDayNumber(iso) - originDay) * pxPerDay;

  const bars: Bar[] = [];
  const rows: GanttLayout["rows"] = [];
  const barById = new Map<string, Bar>();

  tasks.forEach((task, index) => {
    const y = index * ROW_H;
    rows.push({ taskId: task.id, label: task.activity, type: task.type, depth: task.depth, y });

    // Un intertitre occupe une ligne mais ne porte AUCUNE barre : il n'agrège
    // pas ses enfants (docs/SCHEMA.md §5.2). Aucune bibliothèque Gantt ne
    // connaît cette distinction — c'est l'une des raisons du rendu interne.
    if (task.type === "group_header" || !task.start || !task.end) return;

    const isMilestone = task.type === "milestone";
    const left = x(task.start);
    const width = isMilestone ? 0 : Math.max(2, x(task.end) - left);
    const height = task.type === "summary" ? BAR_H - 5 : BAR_H;

    const bar: Bar = {
      taskId: task.id,
      wbsCode: task.wbsCode,
      label: task.activity,
      type: task.type,
      x: left,
      y: y + (ROW_H - height) / 2,
      width,
      height,
      progressWidth:
        task.progressPct === null ? 0 : Math.round((width * task.progressPct) / 100),
      depth: task.depth,
      status: barStatus(task, today),
      isLate: barStatus(task, today) === "late",
      diamond: isMilestone,
      rowIndex: index,
    };
    bars.push(bar);
    barById.set(task.id, bar);
  });

  // ── Flèches de précédence ────────────────────────────────────────────────
  const links: Link[] = [];
  for (const dep of dependencies) {
    const from = barById.get(dep.predecessorId);
    const to = barById.get(dep.successorId);
    if (!from || !to) continue;
    const route = routeLink(from, to);
    links.push({
      from: dep.predecessorId,
      to: dep.successorId,
      points: route.points,
      end: route.end,
    });
  }

  return {
    scale,
    origin,
    ticks,
    pxPerDay,
    chartWidth: Math.max(totalDays * pxPerDay, 1),
    chartHeight: Math.max(tasks.length * ROW_H, ROW_H),
    bars,
    rows,
    links,
    todayX: today ? x(today) : null,
    bufferX: bufferStart ? x(bufferStart) : null,
    deadlineX: deadline ? x(deadline) : null,
  };
}

/**
 * Où en est la tâche par rapport à aujourd'hui.
 *
 * Quatre états, et la nuance décisive est la dernière :
 *
 *   • `done`       — avancement à 100 %, quelle que soit la date.
 *   • `late`       — la fin est passée, du travail a été fait, il n'est pas
 *                    fini. C'est un retard CONSTATÉ.
 *   • `unreported` — la fin est passée et personne n'a renseigné
 *                    l'avancement. On n'en sait rien, et le dire est plus
 *                    utile que d'affirmer un retard.
 *   • `normal`     — tout le reste.
 *
 * Seules les vraies tâches sont jugées : un récapitulatif hérite des dates de
 * ses enfants, et un intertitre n'a pas de date du tout.
 */
function barStatus(task: GanttTask, today: IsoDate | undefined): Bar["status"] {
  if (task.progressPct !== null && task.progressPct >= 100) return "done";
  if (task.type !== "task") return "normal";
  if (today === undefined || task.end === null || task.end >= today) return "normal";
  return task.progressPct === null ? "unreported" : "late";
}

/** Où la flèche aboutit : dans le flanc gauche de la barre, ou sur son dessus. */
export type LinkEnd = "side" | "top";

/**
 * Trace une flèche de la fin du prédécesseur au début du successeur.
 *
 * Le tracé PRÉCÉDENT contournait systématiquement par la gouttière : un coude
 * en L quand il y avait de la place, un Z par-dessous sinon. Résultat, sur un
 * enchaînement fin-début sans battement — c'est-à-dire le cas NORMAL, celui de
 * presque tout le plan — la flèche partait à droite, redescendait, revenait à
 * gauche. Elle faisait le tour pour relier deux points superposés.
 *
 * Trois cas désormais, du plus fréquent au plus rare :
 *
 *  1. FIN-DÉBUT SANS BATTEMENT (le cas normal) — la fin du prédécesseur et le
 *     début du successeur sont au même x. On descend tout droit et on entre par
 *     le DESSUS de la barre. C'est ce que dessine MS Project, et c'est le tracé
 *     le plus court possible : un segment.
 *
 *  2. AVEC BATTEMENT — il y a de la place à droite : on descend au niveau du
 *     successeur puis on entre par son FLANC gauche. Deux segments, aucun
 *     détour.
 *
 *  3. CHEVAUCHEMENT — le successeur commence AVANT la fin du prédécesseur, ce
 *     qui n'arrive qu'avec une ancre contractuelle contradictoire. Là seulement
 *     on contourne par la gouttière : aller tout droit traverserait les deux
 *     barres.
 */
export function routeLink(
  from: Bar,
  to: Bar,
): { points: [number, number][]; end: LinkEnd } {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;

  // En deçà, un segment horizontal serait plus court que sa propre pointe de
  // flèche : on entre par le dessus.
  const MIN_RUN = 10;
  const gap = endX - startX;

  if (gap >= MIN_RUN) {
    return {
      points: [
        [startX, startY],
        [startX, endY],
        [endX, endY],
      ],
      end: "side",
    };
  }

  if (gap >= 0) {
    // Descente droite dans le dessus de la barre. On vise `to.x + 3` pour que
    // la pointe tombe dans la barre et non sur son coin exact.
    const x = to.x + 3;
    return {
      points: [
        [startX, startY],
        [startX, startY + (to.y - startY) / 2],
        [x, startY + (to.y - startY) / 2],
        [x, to.y],
      ],
      end: "top",
    };
  }

  // Contournement par la gouttière entre deux lignes.
  const detourY = Math.max(from.y + from.height, to.y + to.height) + ROW_H / 2 - 4;
  const stub = 8;
  return {
    points: [
      [startX, startY],
      [startX + stub, startY],
      [startX + stub, detourY],
      [endX - stub, detourY],
      [endX - stub, endY],
      [endX, endY],
    ],
    end: "side",
  };
}

/** Plage temporelle couverte, avec une marge d'une période de chaque côté. */
function timeBounds(
  dated: GanttTask[],
  extras: (IsoDate | null | undefined)[],
): { from: IsoDate; to: IsoDate } {
  const dates: IsoDate[] = [];
  for (const t of dated) {
    if (t.start) dates.push(t.start);
    if (t.end) dates.push(t.end);
  }
  for (const d of extras) if (d) dates.push(d);

  if (dates.length === 0) {
    const todayIso = new Date().toISOString().slice(0, 10);
    return { from: todayIso, to: todayIso };
  }

  dates.sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}
