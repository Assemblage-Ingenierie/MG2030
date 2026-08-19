// ============================================================
// lib/schedule/dates.ts — arithmétique de dates CALENDAIRES.
//
// ⚠ Aucune bibliothèque de dates, et surtout aucun `new Date(iso)` suivi de
// `getDate()`. Ce couple applique le fuseau LOCAL et décale d'un jour selon
// l'heure et la machine — un planning qui glisse d'un jour selon le poste qui
// l'affiche serait pire qu'un planning faux, parce qu'irreproductible.
//
// On travaille donc en jours juliens sur les composantes de la chaîne ISO.
// Tout est entier, tout est déterministe, rien ne dépend du fuseau.
//
// CONVENTION DE BORNES, vérifiée sur les 21 tâches datées du seed :
// `end` est la date à laquelle le SUCCESSEUR démarre. Une tâche de 14 jours
// commencée le 21/09 finit le 05/10, et son successeur commence le 05/10.
// La durée est donc l'écart entre les deux dates, borne de fin exclue.
// ============================================================

import type { IsoDate } from "./types";

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Numéro de jour julien. Algorithme de Fliegel et Van Flandern, en entiers. */
function toJulian(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

function fromJulian(jd: number): [number, number, number] {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return [
    100 * b + d - 4800 + Math.floor(m / 10),
    m + 3 - 12 * Math.floor(m / 10),
    e - Math.floor((153 * m + 2) / 5) + 1,
  ];
}

/** Convertit une date ISO en jour julien. Lève si la chaîne est malformée. */
export function toDayNumber(iso: IsoDate): number {
  const match = ISO.exec(iso);
  if (!match) throw new Error(`Date ISO invalide : « ${iso} ». Format attendu : YYYY-MM-DD.`);
  const [, y, m, d] = match;
  return toJulian(Number(y), Number(m), Number(d));
}

export function fromDayNumber(day: number): IsoDate {
  const [y, m, d] = fromJulian(day);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Ajoute des jours calendaires. Les négatifs sont acceptés (décalage amont). */
export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** Écart en jours calendaires, `to − from`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

/** La plus tardive de deux dates. `null` est neutre : c'est l'absence de contrainte. */
export function maxDate(a: IsoDate | null, b: IsoDate | null): IsoDate | null {
  if (a === null) return b;
  if (b === null) return a;
  return toDayNumber(a) >= toDayNumber(b) ? a : b;
}

export function minDate(a: IsoDate | null, b: IsoDate | null): IsoDate | null {
  if (a === null) return b;
  if (b === null) return a;
  return toDayNumber(a) <= toDayNumber(b) ? a : b;
}

/**
 * Durée en semaines, arrondie à deux décimales.
 *
 * `jours = semaines × 7`, conversion imposée au brief §7 et confirmée par le
 * fichier Excel source (nom défini `week` = 7). Vérifiée sur 21/21 tâches :
 * 98 → 14,00 · 10 → 1,43 · 15 → 2,14 · 30 → 4,29 · 822 → 117,43.
 */
export function daysToWeeks(days: number): number {
  return Math.round((days / 7) * 100) / 100;
}

export const weeksToDays = (weeks: number): number => Math.round(weeks * 7);
