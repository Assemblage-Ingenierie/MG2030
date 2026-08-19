"use client";

// ============================================================
// components/i18n/i18n-context.tsx — traduction côté client.
//
// Le dictionnaire est transmis UNE FOIS par le layout serveur. Les Client
// Components consomment `useT()` ; ils n'importent jamais les JSON eux-mêmes,
// ce qui évite d'embarquer deux dictionnaires dans le bundle navigateur.
// ============================================================

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type Messages, type Translator } from "@/lib/i18n/translate";

interface I18nValue {
  locale: Locale;
  t: Translator;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  locale,
  messages,
  fallback,
  children,
}: {
  locale: Locale;
  messages: Messages;
  fallback: Messages;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ locale, t: createTranslator(messages, fallback, locale) }),
    [locale, messages, fallback],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Traducteur client. Lève si le fournisseur est absent — un libellé muet est pire. */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n doit être utilisé sous <I18nProvider>.");
  }
  return value;
}

/** Raccourci le plus courant : `const t = useT()`. */
export function useT(): Translator {
  return useI18n().t;
}
