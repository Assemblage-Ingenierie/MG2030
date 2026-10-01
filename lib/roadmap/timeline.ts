// ============================================================
// lib/roadmap/timeline.ts — la timeline d'une action de roadmap.
//
// UNE SEULE IDÉE : on sépare CE QU'ON A VOULU DIRE de CE QU'ON PEUT CALCULER.
//
//   • `kind`           — la précision voulue : un jour, une semaine, un mois,
//                        un trimestre, une plage. `null` = aucune date.
//   • `start` / `end`  — l'intervalle résolu, fin EXCLUSIVE.
//
// L'intervalle sert à trier, filtrer et dessiner. La précision sert à ÉCRIRE :
// « semaine du 12/10/2026 » ne doit jamais se lire « 12/10/2026 », sans quoi on
// affirmerait un jour que personne n'a choisi. C'est toute la raison d'être de
// ce module — le tableur source contenait « Oct 5 - Week », « oct 12 week » et
// « Q1 2027 », qu'aucune colonne `date` ne pouvait porter sans mentir.
//
// ⚠ AUCUN LIBELLÉ EN DUR ICI. `timelineLabel` rend une CLÉ de traduction et ses
// valeurs d'interpolation ; c'est le composant qui appelle `t()`. Le module
// reste donc pur, testable, et traduisible (brief §6).
//
// L'arithmétique de dates n'est pas réécrite : elle vient de `lib/gantt/scale`
// (`startOfWeek` rend le lundi, `startOfQuarter` le premier mois du trimestre)
// et de `lib/schedule/dates`. Ces deux modules sont déjà éprouvés et testés.
// ============================================================

import { addDays } from "@/lib/schedule/dates";
import { addMonths, startOfMonth, startOfQuarter, startOfWeek } from "@/lib/gantt/scale";
import type { IsoDate } from "@/lib/schedule/types";

export type TimelineKind = "day" | "week" | "month" | "quarter" | "range";

/** Les cinq précisions, dans l'ordre où le formulaire les propose. */
export const TIMELINE_KINDS: TimelineKind[] = ["day", "week", "month", "quarter", "range"];

export interface Timeline {
  /** `null` = aucune date, et c'est le cas majoritaire. */
  kind: TimelineKind | null;
  start: IsoDate | null;
  /** Borne EXCLUSIVE : la semaine du lundi 12 finit au 19, pas au 18. */
  end: IsoDate | null;
}

export const NO_TIMELINE: Timeline = { kind: null, start: null, end: null };

/**
 * Résout une précision et une date d'ancrage en intervalle.
 *
 * L'ancre est RECALÉE sur le début de sa période : donner le mercredi 14 avec
 * `week` rend la semaine du lundi 12. L'utilisateur qui clique un jour au
 * milieu d'une semaine désigne cette semaine, pas une semaine qui commencerait
 * un mercredi.
 *
 * `range` est le seul cas où la fin est fournie ; elle est alors prise telle
 * quelle, donc INCLUSIVE côté saisie et stockée exclusive (+1 jour). Une plage
 * du 1er au 3 couvre bien trois jours.
 */
export function resolveTimeline(
  kind: TimelineKind | null,
  anchor: IsoDate | null,
  inclusiveEnd?: IsoDate | null,
): Timeline {
  if (kind === null || !anchor) return NO_TIMELINE;

  switch (kind) {
    case "day":
      return { kind, start: anchor, end: addDays(anchor, 1) };
    case "week": {
      const start = startOfWeek(anchor);
      return { kind, start, end: addDays(start, 7) };
    }
    case "month": {
      const start = startOfMonth(anchor);
      return { kind, start, end: addMonths(start, 1) };
    }
    case "quarter": {
      const start = startOfQuarter(anchor);
      return { kind, start, end: addMonths(start, 3) };
    }
    case "range": {
      // Une plage dont la fin précède le début n'est pas une plage. On ne
      // corrige pas en silence : on refuse, et l'appelant le signale.
      if (!inclusiveEnd || inclusiveEnd < anchor) return NO_TIMELINE;
      return { kind, start: anchor, end: addDays(inclusiveEnd, 1) };
    }
  }
}

/**
 * Dernier jour COMPRIS dans la timeline, pour la saisie et l'affichage.
 *
 * Le stockage est exclusif parce que c'est ce qui rend les comparaisons
 * justes ; un humain, lui, lit « du 12 au 18 ». La conversion vit ici, à un
 * seul endroit.
 */
export function inclusiveEndOf(timeline: Timeline): IsoDate | null {
  return timeline.end ? addDays(timeline.end, -1) : null;
}

export interface TimelineLabel {
  /** Suffixe de la clé i18n : `roadmap.timeline_<key>`. */
  key: "none" | TimelineKind;
  values: Record<string, string>;
}

/**
 * De quoi écrire la timeline, sans écrire un mot.
 *
 * Rend la clé de traduction et ses valeurs. Les dates sont déjà formatées en
 * `jj/mm/aaaa` — format imposé dans les deux langues (GAPS 41). Les noms de
 * mois, eux, dépendent de la langue : `Intl` s'en charge.
 */
export function timelineLabel(timeline: Timeline, locale: "en" | "sq"): TimelineLabel {
  const { kind, start } = timeline;
  if (kind === null || !start) return { key: "none", values: {} };

  switch (kind) {
    case "day":
      return { key: "day", values: { date: human(start) } };
    case "week":
      return { key: "week", values: { date: human(start) } };
    case "month":
      return { key: "month", values: { month: monthName(start, locale) } };
    case "quarter":
      return {
        key: "quarter",
        values: { quarter: String(quarterOf(start)), year: start.slice(0, 4) },
      };
    case "range": {
      const last = inclusiveEndOf(timeline);
      return { key: "range", values: { from: human(start), to: last ? human(last) : "" } };
    }
  }
}

/**
 * Clé de tri.
 *
 * Les actions SANS DATE partent à la fin plutôt qu'au début : elles sont
 * majoritaires, et les placer en tête noierait les échéances réelles sous une
 * liste d'actions qui n'en ont pas. À précision égale de début, la période la
 * plus COURTE passe devant — « le 12 » est plus engageant que « ce trimestre ».
 */
export function timelineSortKey(timeline: Timeline): [number, string, number] {
  if (!timeline.start || !timeline.end) return [1, "", 0];
  const span = Number(new Date(timeline.end)) - Number(new Date(timeline.start));
  return [0, timeline.start, span];
}

/** Vrai si la timeline recoupe `[from, to)`. Sans date, jamais. */
export function overlaps(timeline: Timeline, from: IsoDate, to: IsoDate): boolean {
  if (!timeline.start || !timeline.end) return false;
  return timeline.start < to && timeline.end > from;
}

// ── Internes ────────────────────────────────────────────────────────────────

/** `jj/mm/aaaa`, par découpage de la chaîne ISO — aucun fuseau n'intervient. */
function human(iso: IsoDate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function quarterOf(iso: IsoDate): number {
  return Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
}

function monthName(iso: IsoDate, locale: "en" | "sq"): string {
  // `T12:00:00Z` et non minuit : à minuit, un décalage négatif ferait basculer
  // la date sur le mois précédent.
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  return new Intl.DateTimeFormat(locale === "sq" ? "sq" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
