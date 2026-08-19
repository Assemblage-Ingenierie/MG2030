// ============================================================
// components/ui/card.tsx — conteneurs.
//
// Règle du dépôt de charte, reprise telle quelle : une surface posée DANS LE
// FLUX n'a pas d'ombre, seulement une bordure 1 px. L'ombre est réservée à ce
// qui flotte au-dessus (popover, modale, tiroir).
// ============================================================

import { cn } from "@/lib/cn";

/** Conteneur courant : tableau encadré, panneau, bloc de page. */
export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Carte de page pleine : connexion, écran d'accès refusé. */
export function PanelCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  actions,
  className,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] p-2",
        className,
      )}
    >
      <h2 className="px-1 text-sm font-semibold text-[var(--text)]">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
