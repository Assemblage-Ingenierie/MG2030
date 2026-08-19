// ============================================================
// components/ui/badge.tsx — pastilles d'état.
//
// Les couleurs viennent de STATUS (lib/tokens.ts) et sont passées en `style`,
// pas en classe : ce sont des valeurs de données, pas des choix de mise en page.
// ============================================================

import { STATUS, type StatusTone } from "@/lib/tokens";
import { cn } from "@/lib/cn";

export function Badge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const { bg, fg } = STATUS[tone];
  return (
    <span
      className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", className)}
      style={{ backgroundColor: bg, color: fg }}
    >
      {children}
    </span>
  );
}

/** Pastille neutre, pour un libellé sans code d'état (code de marché, type…). */
export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded bg-[var(--app-bg)] px-1.5 py-0.5 text-xs text-[var(--text)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Valeur absente. Le brief §11.6 impose de laisser nulle toute donnée manquante ;
 * l'interface doit donc la MONTRER comme telle, jamais afficher 0 ou une chaîne
 * vide qui se lirait comme une valeur réelle.
 */
export function NotSet({ label }: { label: string }) {
  return (
    <span className="text-[var(--text-muted)]" title={label}>
      —
    </span>
  );
}
