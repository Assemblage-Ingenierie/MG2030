// ============================================================
// lib/i18n/format.ts — formats de dates, nombres et montants.
// ISOMORPHE. S'appuie exclusivement sur l'API `Intl` native : zéro dépendance.
//
// Décisions du 19/08/2026 (docs/GAPS.md) :
//   • 41 — stockage UTC, affichage Europe/Belgrade, format dd/mm/yyyy dans les
//          DEUX langues (on n'utilise donc PAS le format par défaut de la locale,
//          qui donnerait mm/dd/yyyy en anglais) ;
//   • 42 — euros HORS TAXES, mention « HT » explicite partout.
// ============================================================

import { CURRENCY, DISPLAY_TIME_ZONE, type Locale } from "./config";

/**
 * Date de planning : `dd/mm/yyyy`, identique en anglais et en albanais.
 *
 * Les dates de planning sont des `date` Postgres — des jours calendaires sans
 * heure ni fuseau. On les formate donc SANS conversion de fuseau : appliquer
 * Europe/Belgrade à « 2026-07-01 » risquerait de la décaler d'un jour selon le
 * fuseau du serveur. D'où le découpage littéral de la chaîne ISO.
 */
export function formatPlanDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return "—";
  return `${d}/${m}/${y}`;
}

/**
 * Horodatage applicatif (dépôt de document, notification) : `dd/mm/yyyy HH:mm`.
 * Ceux-là sont des `timestamptz` : on les convertit bien en Europe/Belgrade.
 */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/** Nombre entier ou décimal, séparateurs selon la langue. */
export function formatNumber(
  value: number | null | undefined,
  locale: Locale,
  decimals = 0,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Montant en euros HORS TAXES.
 *
 * La mention « HT » n'est pas décorative : le plan de passation annonce ses
 * montants « inclusive of tax » alors que toutes les valeurs chargées viennent
 * du budget projet, qui est HT (docs/GAPS.md point 42). Sans la mention, un
 * lecteur du plan de passation croira lire du TTC.
 */
export function formatAmount(
  value: number | null | undefined,
  locale: Locale,
  options: { compact?: boolean; withSuffix?: boolean } = {},
): string {
  const { compact = false, withSuffix = true } = options;
  if (value == null || Number.isNaN(value)) return "—";

  const formatted = new Intl.NumberFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);

  return withSuffix ? `${formatted} excl. VAT` : formatted;
}

/**
 * Fourchette de montants : une valeur unique si les bornes sont égales, sinon
 * « min – max ». Les lots de travaux du seed portent des bornes, pas une valeur
 * (docs/GAPS.md point 34).
 */
export function formatAmountRange(
  min: number | null | undefined,
  max: number | null | undefined,
  locale: Locale,
): string {
  if (min == null && max == null) return "—";
  if (min == null) return formatAmount(max, locale);
  if (max == null) return formatAmount(min, locale);
  if (min === max) return formatAmount(min, locale);
  return `${formatAmount(min, locale, { withSuffix: false })} – ${formatAmount(max, locale)}`;
}

/** Durée en jours calendaires, avec l'équivalent en semaines (jours = semaines × 7). */
export function formatDuration(days: number | null | undefined, locale: Locale): string {
  if (days == null) return "—";
  const weeks = Math.round((days / 7) * 100) / 100;
  return `${formatNumber(days, locale)} d (${formatNumber(weeks, locale, 2)} w)`;
}
