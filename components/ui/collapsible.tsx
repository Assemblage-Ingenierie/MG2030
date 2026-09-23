"use client";

// ============================================================
// components/ui/collapsible.tsx — bloc dépliable avec une zone d'actions.
//
// Pourquoi pas `<details>` : tout ce qui n'est pas dans son `<summary>` est
// masqué une fois replié, et un bouton placé DANS le `<summary>` replie le
// bloc à chaque clic. Ici, l'en-tête cliquable et les actions sont voisins,
// jamais imbriqués.
//
// Le contenu replié reste MONTÉ (`hidden`), pour qu'une saisie en cours dans
// un tableau ne soit pas perdue en refermant le bloc.
// ============================================================

import { useState } from "react";
import { cn } from "@/lib/cn";

export function Collapsible({
  title,
  actions,
  children,
  defaultOpen = false,
  className,
}: {
  /** Contenu de l'en-tête cliquable. */
  title: React.ReactNode;
  /** Boutons de l'en-tête : ils ne déplient ni ne replient le bloc. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
            className={cn(
              "shrink-0 text-[var(--text-muted)] transition-transform",
              open && "rotate-90",
            )}
          >
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </div>
      <div hidden={!open} className="border-t border-[var(--border)] p-4">
        {children}
      </div>
    </div>
  );
}
