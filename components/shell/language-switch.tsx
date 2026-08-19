"use client";

// ============================================================
// components/shell/language-switch.tsx — bascule de langue.
//
// Un <form> par langue, soumis à une Server Action (app/actions/locale.ts).
// Conséquence : la bascule fonctionne même sans JavaScript. `useTransition`
// n'ajoute qu'un retour visuel pendant le re-rendu.
// ============================================================

import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";
import { useI18n } from "@/components/i18n/i18n-context";
import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/config";
import { cn } from "@/lib/cn";

export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5",
        pending && "opacity-60",
      )}
    >
      {LOCALES.map((value) => {
        const active = value === locale;
        return (
          <form
            key={value}
            action={(formData) => startTransition(() => setLocale(formData))}
          >
            <input type="hidden" name="locale" value={value} />
            <button
              type="submit"
              aria-pressed={active}
              title={LOCALE_LABELS[value]}
              disabled={active || pending}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium uppercase transition-colors",
                active
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {value}
            </button>
          </form>
        );
      })}
    </div>
  );
}
