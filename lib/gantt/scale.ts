// ============================================================
// lib/gantt/scale.ts — échelles temporelles du Gantt.
//
// Module PUR : testable sans DOM. Quatre échelles imposées au brief §9.4 —
// jour, semaine, mois, trimestre.
//
// Comme le moteur, on travaille en jours juliens et jamais en `Date` local :
// une frise qui se décale d'un jour selon le fuseau du poste serait pire
// qu'une frise fausse, parce qu'irreproductible.
// ============================================================

import { addDays, fromDayNumber, toDayNumber } from "@/lib/schedule/dates";
import type { IsoDate } from "@/lib/schedule/types";

export type ScaleUnit = "day" | "week" | "month" | "quarter";

/** Une graduation de l'axe. */
export interface Tick {
  /** Position du DÉBUT de la graduation, en jours depuis l'origine de la frise. */
  offsetDays: number;
  /** Largeur de la graduation, en jours. */
  spanDays: number;
  date: IsoDate;
  label: string;
  /** Graduation forte : début de mois, de trimestre, d'année. */
  major: boolean;
}

/** Pixels par jour, par échelle. Un compromis lisibilité / largeur totale. */
export const PX_PER_DAY: Record<ScaleUnit, number> = {
  day: 24,
  week: 6,
  month: 2.2,
  quarter: 0.9,
};

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_SQ = [
  "Jan", "Shk", "Mar", "Pri", "Maj", "Qer",
  "Kor", "Gsh", "Sht", "Tet", "Nën", "Dhj",
];

function parts(iso: IsoDate): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/**
 * Jour de la semaine ISO : 1 = lundi … 7 = dimanche.
 *
 * Le jour julien 0 est un LUNDI : `jd % 7 === 0` vaut donc lundi, sans décalage
 * à appliquer. (Une première version ajoutait un `+1` de trop, ce qui alignait
 * les semaines sur le dimanche.)
 */
export function isoDayOfWeek(iso: IsoDate): number {
  return (toDayNumber(iso) % 7) + 1;
}

/** Numéro de semaine ISO 8601. La semaine 1 contient le premier jeudi de l'année. */
export function isoWeek(iso: IsoDate): number {
  const jd = toDayNumber(iso);
  const dow = isoDayOfWeek(iso);
  const thursday = jd + (4 - dow);
  const { y } = parts(fromDayNumber(thursday));
  const jan1 = toDayNumber(`${y}-01-01`);
  return Math.floor((thursday - jan1) / 7) + 1;
}

/** Lundi de la semaine contenant `iso`. */
export function startOfWeek(iso: IsoDate): IsoDate {
  return fromDayNumber(toDayNumber(iso) - (isoDayOfWeek(iso) - 1));
}

export const startOfMonth = (iso: IsoDate): IsoDate =>
  `${iso.slice(0, 7)}-01`;

export function startOfQuarter(iso: IsoDate): IsoDate {
  const { y, m } = parts(iso);
  const firstMonth = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(firstMonth).padStart(2, "0")}-01`;
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  // On ne construit que des débuts de période : le jour reste tel quel, et
  // c'est toujours 1 dans nos usages.
  return `${ny}-${String(nm).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Graduations couvrant `[from, to]`.
 *
 * L'origine de la frise est ALIGNÉE sur le début de la première période :
 * une frise mensuelle qui commencerait un 17 rendrait toutes les colonnes
 * décalées d'une demi-largeur.
 */
export function buildTicks(
  unit: ScaleUnit,
  from: IsoDate,
  to: IsoDate,
  locale: "en" | "sq" = "en",
): { origin: IsoDate; ticks: Tick[]; totalDays: number } {
  const months = locale === "sq" ? MONTHS_SQ : MONTHS_EN;

  const origin =
    unit === "day" ? from
    : unit === "week" ? startOfWeek(from)
    : unit === "month" ? startOfMonth(from)
    : startOfQuarter(from);

  const originDay = toDayNumber(origin);
  const endDay = toDayNumber(to);
  const ticks: Tick[] = [];

  let cursor = origin;
  // Garde-fou : une plage aberrante ne doit pas boucler indéfiniment.
  for (let guard = 0; guard < 20_000 && toDayNumber(cursor) <= endDay; guard++) {
    const { y, m, d } = parts(cursor);
    let next: IsoDate;
    let label: string;
    let major: boolean;

    switch (unit) {
      case "day":
        next = addDays(cursor, 1);
        label = String(d);
        major = d === 1;
        break;
      case "week":
        next = addDays(cursor, 7);
        label = `W${isoWeek(cursor)}`;
        // Semaine contenant un début de mois : repère plus fort.
        major = d <= 7;
        break;
      case "month":
        next = addMonths(cursor, 1);
        label = `${months[m - 1]} ${String(y).slice(2)}`;
        major = m === 1;
        break;
      default:
        next = addMonths(cursor, 3);
        label = `Q${Math.floor((m - 1) / 3) + 1} ${y}`;
        major = m === 1;
        break;
    }

    const offsetDays = toDayNumber(cursor) - originDay;
    ticks.push({
      offsetDays,
      spanDays: toDayNumber(next) - toDayNumber(cursor),
      date: cursor,
      label,
      major,
    });
    cursor = next;
  }

  const last = ticks[ticks.length - 1];
  const totalDays = last ? last.offsetDays + last.spanDays : 1;
  return { origin, ticks, totalDays };
}

/**
 * Échelle adaptée à une durée : on ne montre pas trois ans au jour, ni deux
 * semaines au trimestre.
 */
export function suggestScale(spanDays: number): ScaleUnit {
  if (spanDays <= 60) return "day";
  if (spanDays <= 400) return "week";
  if (spanDays <= 1500) return "month";
  return "quarter";
}
