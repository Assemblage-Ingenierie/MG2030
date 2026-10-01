import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { ROADMAP_PRIORITIES, ROADMAP_STATUSES } from "@/lib/roadmap/types";
import type { DateFilter, RoadmapFilters } from "@/lib/roadmap/filter";

/**
 * Barre de filtres de la roadmap.
 *
 * TOUT PASSE PAR L'URL, comme pour le plan de charge : une vue se partage par
 * un lien et survit à un rechargement. Ce sont donc de vrais `<Link>`, pas des
 * boutons à état — et le composant peut rester un Server Component.
 *
 * `undefined` = garder la valeur courante, `null` = l'effacer. Sans cette
 * distinction, poser un filtre effacerait les autres.
 */
export async function RoadmapFilterBar({
  filters,
  assignees,
  hiddenCompleted,
  view,
}: {
  filters: RoadmapFilters;
  assignees: string[];
  hiddenCompleted: number;
  view: "list" | "timeline";
}) {
  const { t } = await getI18n();

  const href = (next: {
    priority?: string | null;
    status?: string | null;
    assignee?: string | null;
    date?: DateFilter;
    completed?: boolean;
    view?: "list" | "timeline";
  }) => {
    const p = new URLSearchParams();
    const keep = <T,>(given: T | undefined, current: T) =>
      given === undefined ? current : given;

    const v = keep(next.view, view);
    if (v === "timeline") p.set("view", v);

    const priority = keep(next.priority, filters.priority);
    if (priority) p.set("priority", priority);
    const status = keep(next.status, filters.status);
    if (status) p.set("status", status);
    const assignee = keep(next.assignee, filters.assignee);
    if (assignee) p.set("assignee", assignee);
    const date = keep(next.date, filters.date);
    if (date !== "all") p.set("date", date);
    if (keep(next.completed, filters.showCompleted)) p.set("completed", "1");

    const qs = p.toString();
    return qs ? `/roadmap?${qs}` : "/roadmap";
  };

  const chip = "rounded px-2.5 py-1 text-xs font-medium transition-colors";
  const active = "bg-[var(--surface)] text-[var(--text)] shadow-sm";
  const idle = "text-[var(--text-muted)] hover:text-[var(--text)]";
  const group = "inline-flex flex-wrap items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] p-2">
      {/* Vue : liste ou frise. Premier, parce qu'il commande tout le reste. */}
      <div role="group" aria-label={t("roadmap.viewList")} className={group}>
        <Link
          href={href({ view: "list" })}
          aria-current={view === "list" ? "true" : undefined}
          className={cn(chip, view === "list" ? active : idle)}
        >
          {t("roadmap.viewList")}
        </Link>
        <Link
          href={href({ view: "timeline" })}
          aria-current={view === "timeline" ? "true" : undefined}
          className={cn(chip, view === "timeline" ? active : idle)}
        >
          {t("roadmap.viewTimeline")}
        </Link>
      </div>

      <div role="group" aria-label={t("roadmap.priority")} className={group}>
        <Link
          href={href({ priority: null })}
          aria-current={filters.priority === null ? "true" : undefined}
          className={cn(chip, filters.priority === null ? active : idle)}
        >
          {t("roadmap.allPriorities")}
        </Link>
        {/* Du plus pressant au moins : l'urgent se cherche en premier. */}
        {[...ROADMAP_PRIORITIES].reverse().map((p) => (
          <Link
            key={p}
            href={href({ priority: p })}
            aria-current={filters.priority === p ? "true" : undefined}
            className={cn(chip, filters.priority === p ? active : idle)}
          >
            {t(`roadmap.priority_${p}`)}
          </Link>
        ))}
      </div>

      <div role="group" aria-label={t("roadmap.status")} className={group}>
        <Link
          href={href({ status: null })}
          aria-current={filters.status === null ? "true" : undefined}
          className={cn(chip, filters.status === null ? active : idle)}
        >
          {t("roadmap.allStatuses")}
        </Link>
        {ROADMAP_STATUSES.map((s) => (
          <Link
            key={s}
            href={href({ status: s })}
            aria-current={filters.status === s ? "true" : undefined}
            className={cn(chip, filters.status === s ? active : idle)}
          >
            {t(`roadmap.status_${s}`)}
          </Link>
        ))}
      </div>

      <div role="group" aria-label={t("roadmap.timeline")} className={group}>
        {(["all", "dated", "undated"] as DateFilter[]).map((d) => (
          <Link
            key={d}
            href={href({ date: d })}
            aria-current={filters.date === d ? "true" : undefined}
            className={cn(chip, filters.date === d ? active : idle)}
          >
            {t(d === "all" ? "roadmap.allDates" : `roadmap.${d}`)}
          </Link>
        ))}
      </div>

      {assignees.length > 0 && (
        <div role="group" aria-label={t("roadmap.assignee")} className={group}>
          <Link
            href={href({ assignee: null })}
            aria-current={filters.assignee === null ? "true" : undefined}
            className={cn(chip, filters.assignee === null ? active : idle)}
          >
            {t("roadmap.allAssignees")}
          </Link>
          {assignees.map((a) => (
            <Link
              key={a}
              href={href({ assignee: a })}
              aria-current={filters.assignee === a ? "true" : undefined}
              className={cn(chip, filters.assignee === a ? active : idle)}
            >
              {a}
            </Link>
          ))}
        </div>
      )}

      {/* Les terminées. Le compte des masquées est affiché À CÔTÉ du bouton :
          sans lui, on ne peut pas savoir qu'il y a quelque chose à montrer. */}
      <div className="ml-auto flex items-center gap-2">
        {hiddenCompleted > 0 && (
          <span className="text-xs text-[var(--text-muted)]">
            {t("roadmap.completedHidden", { count: String(hiddenCompleted) })}
          </span>
        )}
        <Link
          href={href({ completed: !filters.showCompleted })}
          aria-pressed={filters.showCompleted}
          className={
            "rounded border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text)] " +
            (filters.showCompleted ? "bg-[var(--app-bg)]" : "bg-[var(--surface)]")
          }
        >
          {t(filters.showCompleted ? "roadmap.hideCompleted" : "roadmap.showCompleted")}
        </Link>
      </div>
    </div>
  );
}
