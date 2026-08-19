// ============================================================
// lib/i18n/config.ts — configuration d'internationalisation.
//
// AUCUNE dépendance externe (brief §4 : « aucune dépendance lourde sans
// validation préalable »). Un dictionnaire à deux langues, une recherche de clé
// par chemin pointé et l'API `Intl` native suffisent — next-intl et consorts
// apportent surtout du routage localisé, dont le brief n'a pas besoin.
//
// Langue de référence de l'interface : l'anglais (brief §6).
// Code de l'albanais : `sq` (décision du 19/08/2026, docs/GAPS.md point 40).
// ============================================================

export const LOCALES = ["en", "sq"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * La langue est portée par un cookie, pas par un segment d'URL.
 *
 * Conséquence assumée : les URL ne sont pas localisées (`/contracts`, pas
 * `/en/contracts`). C'est un outil interne à 30 comptes, sans référencement ni
 * partage public de liens localisés ; le segment d'URL n'apporterait qu'une
 * restructuration de l'arborescence des routes. Réversible : passer à un
 * segment `[locale]` ne toucherait pas aux dictionnaires.
 */
export const LOCALE_COOKIE = "mg2030_locale";

/** Fuseau d'AFFICHAGE. Le stockage reste en UTC (décision GAPS 41). */
export const DISPLAY_TIME_ZONE = "Europe/Belgrade";

/** Devise unique du projet : euro, montants hors taxes (décision GAPS 42). */
export const CURRENCY = "EUR";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Libellé d'une langue dans sa propre langue (sélecteur de langue). */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  sq: "Shqip",
};
