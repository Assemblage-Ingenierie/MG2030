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
      isLate:
        today !== undefined &&
        task.end < today &&
        (task.progressPct ?? 0) < 100 &&
        task.type === "task",
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
    links.push({ from: dep.predecessorId, to: dep.successorId, points: routeLink(from, to) });
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
 * Trace une flèche de la fin du prédécesseur au début du successeur.
 *
 * Deux cas seulement, ce qui suffit à un graphe fin-début :
 *   • le successeur commence APRÈS la fin du prédécesseur → coude en L ;
 *   • il commence avant ou au même point → contournement en Z, par-dessous,
 *     sinon la flèche traverserait les deux barres.
 */
function routeLink(from: Bar, to: Bar): [number, number][] {
  const startX = from.x + from.width;
  const startY = from.y + from.height / 2;
  const endX = to.x;
  const endY = to.y + to.height / 2;
  const gap = 8;

  if (endX >= startX + gap) {
    const midX = endX - gap;
    return [
      [startX, startY],
      [midX, startY],
      [midX, endY],
      [endX, endY],
    ];
  }

  // Contournement : on descend sous la ligne du prédécesseur, on recule, on
  // remonte. `+ ROW_H / 2` place le retour dans la gouttière entre deux lignes.
  const detourY = Math.max(from.y + from.height, to.y + to.height) + ROW_H / 2 - 4;
  return [
    [startX, startY],
    [startX + gap, startY],
    [startX + gap, detourY],
    [endX - gap, detourY],
    [endX - gap, endY],
    [endX, endY],
  ];
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
