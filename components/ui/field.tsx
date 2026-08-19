// ============================================================
// components/ui/field.tsx — champ, étiquette, message d'erreur.
//
// Deux variantes de focus coexistent, comme dans le dépôt de charte :
//   • `ring`   — anneau, en FORMULAIRE ;
//   • `border` — bordure seule, en CELLULE de tableau, où l'anneau déborderait
//                sur les cellules voisines.
//
// Le style de champ EN ERREUR n'existait pas dans le dépôt de charte (l'erreur
// y était un bandeau sous le formulaire). Il est ajouté ici : pour un outil de
// SAISIE dont le critère de succès est la vitesse (brief §2), l'utilisateur doit
// voir quel champ pose problème sans relire le formulaire.
// ============================================================

import { useId } from "react";
import { cn } from "@/lib/cn";

export const FIELD_BASE =
  "w-full rounded-md border bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--text)] " +
  "outline-none transition-colors " +
  "disabled:cursor-not-allowed disabled:bg-[var(--app-bg)] disabled:text-[var(--text-muted)] " +
  "placeholder:text-[var(--text-muted)]";

export function fieldClasses(opts: { invalid?: boolean; focusStyle?: "ring" | "border" } = {}) {
  const { invalid = false, focusStyle = "ring" } = opts;
  return cn(
    FIELD_BASE,
    invalid
      ? "border-[var(--danger)] focus:ring-2 focus:ring-[var(--danger)]"
      : focusStyle === "ring"
        ? "border-[var(--border)] focus:ring-2 focus:ring-[var(--focus)]"
        : "border-[var(--border)] focus:border-[var(--focus)]",
  );
}

export function Label({
  children,
  htmlFor,
  optionalText,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  /** Mention « (optionnel) » déjà traduite par l'appelant. */
  optionalText?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("block text-sm font-medium text-[var(--text)]", className)}
    >
      {children}
      {optionalText && (
        <span className="ml-1 font-normal text-[var(--text-muted)]">({optionalText})</span>
      )}
    </label>
  );
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-sm text-[var(--danger)]">
      {children}
    </p>
  );
}

export interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string;
  optionalText?: string;
  hint?: string;
  focusStyle?: "ring" | "border";
}

/** Champ complet : étiquette, saisie, erreur — reliés par `aria-describedby`. */
export function Field({
  label,
  error,
  optionalText,
  hint,
  focusStyle = "ring",
  className,
  id,
  ...props
}: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div className={className}>
      <Label htmlFor={fieldId} optionalText={optionalText}>
        {label}
      </Label>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(error && errorId, hint && hintId) || undefined}
        className={cn("mt-1", fieldClasses({ invalid: Boolean(error), focusStyle }))}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-[var(--text-muted)]">
          {hint}
        </p>
      )}
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}
