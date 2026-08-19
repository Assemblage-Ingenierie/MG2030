// ============================================================
// components/ui/table.tsx — tableau de liste (en-tête clair).
// Spécification reprise de docs/UI_TOKENS.md §6.
//
// Le tableau de SYNTHÈSE (en-tête sombre, groupes de colonnes) et la grille
// ÉDITABLE de type tableur sont des composants distincts, livrés avec les
// modules qui les consomment (lots 6 et 8).
// ============================================================

import { cn } from "@/lib/cn";

export function Table({
  className,
  children,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr
        className={cn(
          "border-b border-[var(--border)] bg-[var(--app-bg)] text-left",
          "text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
        )}
      >
        {children}
      </tr>
    </thead>
  );
}

export function Th({
  className,
  align = "left",
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-3 py-2",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function Tr({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-[var(--border)] hover:bg-[var(--app-bg)]", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function Td({
  className,
  align = "left",
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-3 py-1.5 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** Ligne unique occupant tout le tableau, pour l'état vide. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-[var(--text-muted)]">
        {children}
      </td>
    </tr>
  );
}

/** État vide hors tableau (liste, panneau). */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">{children}</p>
  );
}
