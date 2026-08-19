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

/** Langue de la requête courante, depuis le cookie. Repli : anglais. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
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
