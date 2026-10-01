"use client";

// ============================================================
// tab-toggle.tsx — un interrupteur par onglet.
//
// Pas de bouton « Enregistrer » : chaque bascule est une décision complète, et
// une page d'interrupteurs qu'il faut penser à valider produit des réglages
// qu'on croit posés et qui ne le sont pas.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { setNavHidden } from "./actions";

export function TabToggle({ href, hidden }: { href: string; hidden: boolean }) {
  const t = useT();
  // L'état est tenu LOCALEMENT en plus du serveur : la revalidation du layout
  // met une bonne seconde à revenir, et un interrupteur qui ne bouge pas se
  // reclique.
  const [on, setOn] = useState(!hidden);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(false);
    start(async () => {
      try {
        await setNavHidden(href, !next);
      } catch {
        setOn(!next); // La base a refusé : l'écran doit le dire, pas mentir.
        setError(true);
      }
    });
  }

  return (
    <span className="flex items-center justify-end gap-2">
      {error && (
        <span className="text-xs" style={{ color: "var(--danger)" }}>
          {t("tabs.error_writeFailed")}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={on}
        title={on ? t("tabs.hide") : t("tabs.show")}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-2 py-1 text-xs font-medium",
          "transition-colors disabled:opacity-50",
          on
            ? "border-transparent text-[var(--on-accent)]"
            : "border-[var(--border)] text-[var(--text-muted)]",
        )}
        style={on ? { backgroundColor: "var(--accent)" } : undefined}
      >
        {on ? (
          <EyeIcon className="h-3.5 w-3.5" />
        ) : (
          <EyeOffIcon className="h-3.5 w-3.5" />
        )}
        {on ? t("tabs.visible") : t("tabs.hidden")}
      </button>
    </span>
  );
}
