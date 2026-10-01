// ============================================================
// lib/ui/calendar.ts — la GRILLE d'un mois, en pur calcul.
//
// Un calendrier est deux choses très différentes : une arithmétique de dates,
// et un tapis de boutons. On sépare les deux — l'arithmétique se teste, le
// tapis de boutons ne se teste qu'à l'œil.
//
// ⚠ SEMAINE COMMENÇANT LE LUNDI. Convention ISO, celle du Kosovo comme de la
// France, et déjà celle de `lib/gantt/scale.ts` : un calendrier qui commencerait
// le dimanche ferait lire « semaine du 12 » décalée d'un jour par rapport à la
// frise du plan de charge.
//
// Aucune dépendance, aucun fuseau : on manipule des `YYYY-MM-DD`, comme partout
// ailleurs dans l'application. Un `Date` ici aurait rouvert la question du
// décalage horaire, déjà payée une fois (voir `localToday`).
// ============================================================

import { addDays, fromDayNumber, toDayNumber } from "@/lib/schedule/dates";
import { isoDayOfWeek, startOfMonth } from "@/lib/gantt/scale";

/** Six semaines pleines, toujours : une grille qui change de hauteur saute. */
export const WEEKS_SHOWN = 6;

export interface CalendarDay {
  iso: string;
  day: number;
  /** Faux pour les jours de débord, ceux du mois précédent ou suivant. */
  inMonth: boolean;
}

/**
 * Les 42 cases de la grille d'un mois.
 *
 * Toujours six lignes, même quand cinq suffiraient : sinon la hauteur du
 * panneau change d'un mois à l'autre, le bouton « mois suivant » se déplace
 * sous le curseur, et on clique deux fois sans le vouloir.
 */
export function monthGrid(anchor: string): CalendarDay[] {
  const first = startOfMonth(anchor);
  const month = first.slice(0, 7);
  // Reculer jusqu'au lundi qui ouvre la semaine du 1er.
  const start = addDays(first, -(isoDayOfWeek(first) - 1));

  return Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => {
    const iso = addDays(start, i);
    return { iso, day: Number(iso.slice(8, 10)), inMonth: iso.slice(0, 7) === month };
  });
}

/** Décale de `months` mois en gardant le quantième, borné à la fin du mois. */
export function shiftMonth(iso: string, months: number): string {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1 + months;
  const day = Number(iso.slice(8, 10));

  const y = year + Math.floor(month / 12);
  const m = ((month % 12) + 12) % 12;

  // ⚠ LE 31 JANVIER + 1 MOIS N'EST PAS LE 3 MARS. Sans ce plafonnement, passer
  // au mois suivant depuis le 31 déborde sur le mois d'après, et la grille
  // saute un mois entier sous les doigts.
  const last = daysInMonth(y, m + 1);
  const target = `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(
    Math.min(day, last),
  ).padStart(2, "0")}`;
  return target;
}

export function daysInMonth(year: number, month1to12: number): number {
  const firstOfNext =
    month1to12 === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month1to12 + 1).padStart(2, "0")}-01`;
  return Number(fromDayNumber(toDayNumber(firstOfNext) - 1).slice(8, 10));
}

/**
 * Le déplacement au clavier, en jours.
 *
 * Les conventions d'un sélecteur de date de bureau : flèches pour le jour et la
 * semaine, Origine et Fin pour les bords de semaine. Le mois, lui, ne se
 * compte pas en jours — il est traité à part par l'appelant.
 */
export function moveByKey(iso: string, key: string): string | null {
  switch (key) {
    case "ArrowLeft":
      return addDays(iso, -1);
    case "ArrowRight":
      return addDays(iso, 1);
    case "ArrowUp":
      return addDays(iso, -7);
    case "ArrowDown":
      return addDays(iso, 7);
    case "Home":
      return addDays(iso, -(isoDayOfWeek(iso) - 1));
    case "End":
      return addDays(iso, 7 - isoDayOfWeek(iso));
    case "PageUp":
      return shiftMonth(iso, -1);
    case "PageDown":
      return shiftMonth(iso, 1);
    default:
      return null;
  }
}

/** `YYYY-MM-DD` et rien d'autre : ce qui vient d'un champ libre se vérifie. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(Number(value.slice(0, 4)), month);
}
