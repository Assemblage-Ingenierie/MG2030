import "server-only";

// ============================================================
// lib/i18n/server.ts — résolution de la langue et chargement du dictionnaire,
// côté serveur uniquement (Server Components par défaut, brief §4).
// ============================================================

import { cookies } from "next/headers";
import en from "@/messages/en.json";
import sq from "@/messages/sq.json";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { createTranslator, type Messages, type Translator } from "./translate";

// Import statique : les deux dictionnaires sont dans le bundle serveur. À deux
// langues et quelques kilo-octets, un chargement dynamique ne rapporterait rien
// et ajouterait de l'asynchrone partout.
const DICTIONARIES: Record<Locale, Messages> = {
  en: en as Messages,
  sq: sq as Messages,
};

/**
 * Langue de la requête courante.
 *
 * ⚠ TOUJOURS L'ANGLAIS, TANT QU'IL N'Y A QU'UNE LANGUE TRADUITE.
 *
 * `messages/sq.json` est un gabarit vide (`"_status": "not-populated"`) : en
 * albanais, tout le texte retombe sur l'anglais SAUF ce qui ne passe pas par
 * le dictionnaire — les noms de mois du Gantt, qui ont leur propre table. Un
 * compte resté en `sq` voyait donc une interface anglaise avec « Sht 26 » et
 * « Tet 26 » sur l'axe de temps. Signalé le 01/10/2026.
 *
 * Le sélecteur de langue ayant été retiré la veille, le cookie — posé pour un
 * an — n'était plus modifiable : la préférence devenait une impasse. On cesse
 * donc de l'honorer. La plomberie reste en place, et ce `return` redeviendra
 * une lecture de cookie le jour où l'albanais sera réellement traduit.
 */
export async function getLocale(): Promise<Locale> {
  return DEFAULT_LOCALE;
}

/**
 * Traducteur pour la requête courante.
 *
 * À utiliser dans tout Server Component :
 *   const { t, locale } = await getI18n();
 *   <h1>{t("nav.contracts")}</h1>
 */
export async function getI18n(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale();
  return {
    locale,
    t: createTranslator(DICTIONARIES[locale], DICTIONARIES[DEFAULT_LOCALE], locale),
  };
}

/** Dictionnaire brut, à transmettre au contexte client (voir I18nProvider). */
export async function getMessages(): Promise<{ locale: Locale; messages: Messages; fallback: Messages }> {
  const locale = await getLocale();
  return {
    locale,
    messages: DICTIONARIES[locale],
    fallback: DICTIONARIES[DEFAULT_LOCALE],
  };
}

/** Compte les clés terminales d'un dictionnaire (diagnostic de couverture). */
export function countKeys(messages: Messages): number {
  let total = 0;
  for (const value of Object.values(messages)) {
    total += typeof value === "string" ? 1 : countKeys(value);
  }
  return total;
}

export { DICTIONARIES };
