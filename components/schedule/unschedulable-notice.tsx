import { getI18n } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import type { ScenarioRow } from "@/lib/queries/schedule";

/**
 * Scénario sans planning exploitable.
 *
 * `design_bid_build` est la voie de DROIT COMMUN — le Design & Build repose sur
 * une dérogation. Mais le fichier Excel source la calcule à rebours depuis la
 * fin du Design & Build, aboutissant à des travaux achevés en octobre 2031,
 * soit 21 mois après les Jeux (GAPS 9).
 *
 * Le brief §7 interdit d'inventer des dates. On refuse donc d'afficher un
 * planning, et on dit **pourquoi** : une liste vide se lirait comme une panne,
 * et un planning inventé serait bien pire.
 */
export async function UnschedulableNotice({ scenario }: { scenario: ScenarioRow }) {
  const { t } = await getI18n();

  return (
    <Card className="p-6" style={{ borderColor: "var(--accent-2)" }}>
      <div className="flex items-start gap-3">
        <AlertIcon
          className="mt-0.5 h-6 w-6 shrink-0"
          style={{ color: "var(--accent-2)" }}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--text)]">
            {t("schedule.unschedulableTitle", { name: scenario.name })}
          </h3>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {t("schedule.unschedulableBody")}
          </p>
          {scenario.description && (
            <p className="mt-3 rounded-md bg-[var(--app-bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
              {scenario.description}
            </p>
          )}
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            {t("schedule.unschedulableFix")}
          </p>
        </div>
      </div>
    </Card>
  );
}
