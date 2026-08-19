// ============================================================
// components/ui/button.tsx
// Spécifications reprises littéralement de docs/UI_TOKENS.md §6.
// Aucune couleur en dur : uniquement var(--token).
// ============================================================

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium " +
  "transition-colors disabled:cursor-not-allowed";

const VARIANT: Record<ButtonVariant, string> = {
  // L'accent porte le texte `--on-accent` : sur le bleu institutionnel, le
  // blanc des six étoiles de l'emblème.
  primary:
    "bg-[var(--accent)] font-semibold text-[var(--on-accent)] " +
    "transition-opacity hover:opacity-90 disabled:opacity-60",
  secondary:
    "border border-[var(--border)] text-[var(--text)] hover:bg-[var(--app-bg)] disabled:opacity-60",
  quiet:
    "text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)] disabled:opacity-50",
  // `--danger` est distinct de `--accent` : l'accent n'étant plus rouge, une
  // action destructrice a besoin de son propre signal.
  danger:
    "bg-[var(--danger)] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60",
};

const SIZE: Record<ButtonSize, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANT[variant], SIZE[size], block && "w-full", className)}
      {...props}
    />
  );
}

/** Bouton réduit à une icône. `label` est obligatoire : il porte l'accessibilité. */
export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...props
}: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
        "text-[var(--text-muted)] transition-colors",
        "hover:bg-[var(--app-bg)] hover:text-[var(--text)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
