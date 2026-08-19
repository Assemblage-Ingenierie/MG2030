// ============================================================
// lib/i18n/translate.ts — noyau de traduction, ISOMORPHE (serveur + client).
// Aucun accès système : c'est une fonction pure sur un dictionnaire déjà chargé.
// ============================================================

import type { Locale } from "./config";
import { DEFAULT_LOCALE } from "./config";

/** Dictionnaire arborescent tel qu'il est écrit dans messages/*.json. */
export type Messages = { [key: string]: string | Messages };

/** Valeurs interpolées dans une chaîne : « {count} tâches ». */
export type TranslationValues = Record<string, string | number>;

export type Translator = (key: string, values?: TranslationValues) => string;

/** Résout un chemin pointé (« nav.contracts ») dans un dictionnaire. */
function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Remplace les repères `{nom}` par leur valeur. */
function interpolate(template: string, values?: TranslationValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/**
 * Fabrique un traducteur.
 *
 * Repli en cascade : locale demandée → anglais → la clé elle-même. Renvoyer la
 * clé plutôt qu'une chaîne vide est délibéré : une traduction manquante doit se
 * VOIR à l'écran (`nav.contracts` s'affiche tel quel), pas disparaître. En
 * développement, elle est aussi signalée en console.
 *
 * @param messages   dictionnaire de la locale courante
 * @param fallback   dictionnaire anglais, pour les clés non encore traduites
 */
export function createTranslator(
  messages: Messages,
  fallback: Messages,
  locale: Locale,
): Translator {
  return (key, values) => {
    const found = lookup(messages, key) ?? lookup(fallback, key);
    if (found === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] clé absente : « ${key} » (locale « ${locale} »)`);
      }
      return key;
    }
    if (lookup(messages, key) === undefined && locale !== DEFAULT_LOCALE) {
      // La clé existe en anglais mais pas dans la locale demandée : c'est un
      // trou de traduction attendu tant que `sq` n'est pas peuplé (brief §9).
      if (process.env.NODE_ENV !== "production") {
        console.info(`[i18n] non traduit en « ${locale} » : « ${key} »`);
      }
    }
    return interpolate(found, values);
  };
}
