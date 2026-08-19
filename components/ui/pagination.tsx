import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Pagination côté serveur (brief §4).
 *
 * De vrais liens, pas des boutons : la page est partageable, le retour arrière
 * fonctionne, et la navigation reste possible sans JavaScript. Les autres
 * paramètres de filtre sont conservés — perdre son filtre en changeant de page
 * est l'irritant classique.
 */
export function Pagination({
  page,
  pageCount,
  total,
  basePath,
  params,
  labels,
}: {
  page: number;
  pageCount: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
  labels: { page: string; of: string; previous: string; next: string };
}) {
  if (pageCount <= 1) {
    return (
      <span className="text-xs tabular-nums text-[var(--text-muted)]">
        {total} {labels.of} {total}
      </span>
    );
  }

  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") search.set(key, value);
    }
    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  const link =
    "rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-medium transition-colors";

  return (
    <nav className="flex items-center gap-2" aria-label={labels.page}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(link, "hover:bg-[var(--app-bg)]")}>
          {labels.previous}
        </Link>
      ) : (
        <span className={cn(link, "cursor-not-allowed opacity-50")}>{labels.previous}</span>
      )}

      <span className="text-xs tabular-nums text-[var(--text-muted)]">
        {labels.page} {page} {labels.of} {pageCount} · {total}
      </span>

      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(link, "hover:bg-[var(--app-bg)]")}>
          {labels.next}
        </Link>
      ) : (
        <span className={cn(link, "cursor-not-allowed opacity-50")}>{labels.next}</span>
      )}
    </nav>
  );
}
