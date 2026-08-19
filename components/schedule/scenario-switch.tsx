import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import type { ScenarioRow } from "@/lib/queries/schedule";

/**
 * Bascule entre scénarios.
 *
 * `design_bid_build` et `design_build` sont MUTUELLEMENT EXCLUSIFS : ils
 * partagent le même groupe d'exclusion et décrivent deux voies concurrentes
 * pour le même périmètre physique. La bascule matérialise l'arbitrage — c'est
 * précisément ce que le brief §7 veut préserver.
 *
 * Un scénario sans planning exploitable reste accessible, mais signalé : le
 * masquer donnerait à croire qu'il n'existe pas, alors qu'il est la voie de
 * droit commun.
 */
export async function ScenarioSwitch({
  scenarios,
  current,
  basePath = "/schedule",
}: {
  scenarios: ScenarioRow[];
  current: string;
  basePath?: string;
}) {
  const { t } = await getI18n();

  return (
    <div
      role="group"
      aria-label={t("schedule.scenario")}
      className="inline-flex flex-wrap items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
    >
      {scenarios.map((s) => {
        const active = s.code === current;
        return (
          <Link
            key={s.code}
            href={`${basePath}?scenario=${s.code}`}
            aria-current={active ? "true" : undefined}
            title={s.isSchedulable ? s.name : t("schedule.noPlanTooltip")}
            className={cn(
              "flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]",
            )}
          >
            {s.name}
            {!s.isSchedulable && (
              /* Le point d'or dit « pas de planning », sans masquer l'entrée. */
              <span aria-hidden="true" style={{ color: "var(--accent-2)" }}>
                ●
              </span>
            )}
            {s.isActive && s.exclusiveGroup && (
              <span className="text-[10px] uppercase tracking-wide opacity-70">
                {t("schedule.activeHypothesis")}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
