import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { Card, Section } from "@/components/ui/card";
import { ScenarioSwitch } from "@/components/schedule/scenario-switch";
import { UnschedulableNotice } from "@/components/schedule/unschedulable-notice";
import { GanttChart } from "@/components/gantt/gantt-chart";
import { GanttToolbar } from "@/components/gantt/gantt-toolbar";
import type { GanttTask } from "@/lib/gantt/layout";
import type { ScaleUnit } from "@/lib/gantt/scale";

const SCALES: ScaleUnit[] = ["day", "week", "month", "quarter"];

/**
 * Restitution Gantt.
 *
 * Rendu SVG interne, zéro dépendance (docs/GANTT_ARBITRAGE.md). Quatre
 * échelles, filtres par marché et par site, liens de précédence, marge
 * terminale et échéance des Jeux.
 */
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string; scale?: string; contract?: string }>;
}) {
  const { t, locale } = await getI18n();
  const params = await searchParams;

  const scenarios = await listScenarios();
  const selected =
    scenarios.find((s) => s.code === params.scenario) ??
    scenarios.find((s) => s.isActive && s.isSchedulable) ??
    scenarios.find((s) => s.isSchedulable) ??
    null;

  if (!selected) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-[var(--text-muted)]">
        {t("gantt.noTasks")}
      </Card>
    );
  }

  if (!selected.isSchedulable) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Section title={t("gantt.title")} description={t("gantt.intro")}>
          <ScenarioSwitch scenarios={scenarios} current={selected.code} basePath="/gantt" />
          <UnschedulableNotice scenario={selected} />
        </Section>
      </div>
    );
  }

  const { tasks, dependencies, scenario } = await loadSchedule(selected.code);

  const scale: ScaleUnit = SCALES.includes(params.scale as ScaleUnit)
    ? (params.scale as ScaleUnit)
    : "month";

  // Filtre par marché : le calendrier de passation n'est pas un module séparé,
  // c'est une VUE FILTRÉE du même planning (brief §7).
  const filtered = params.contract
    ? tasks.filter((task) => task.contractCode === params.contract)
    : tasks;

  const chartTasks: GanttTask[] = filtered.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    activity: task.activity,
    type: task.type,
    start: task.computed?.start ?? task.storedStart,
    end: task.computed?.end ?? task.storedEnd,
    progressPct: task.progressPct,
    depth: task.depth,
    contractCode: task.contractCode,
  }));

  const visibleIds = new Set(chartTasks.map((task) => task.id));
  // Une flèche dont une extrémité est filtrée n'a nulle part où aboutir.
  const chartLinks = dependencies.filter(
    (d) => visibleIds.has(d.predecessorId) && visibleIds.has(d.successorId),
  );

  const contractCodes = [
    ...new Set(tasks.map((task) => task.contractCode).filter((c): c is string => Boolean(c))),
  ].sort();

  return (
    <div className="mx-auto flex max-w-full flex-col gap-6">
      <Section
        title={t("gantt.title")}
        description={t("gantt.intro")}
        actions={<ScenarioSwitch scenarios={scenarios} current={selected.code} basePath="/gantt" />}
      >
        <Card className="overflow-hidden">
          <GanttToolbar
            scale={scale}
            scales={SCALES}
            contractCodes={contractCodes}
            currentContract={params.contract ?? null}
            scenarioCode={selected.code}
          />
          <GanttChart
            tasks={chartTasks}
            dependencies={chartLinks}
            scale={scale}
            today={new Date().toISOString().slice(0, 10)}
            bufferStart={scenario?.bufferStartDate ?? null}
            deadline={scenario?.deadlineDate ?? null}
            locale={locale}
          />
        </Card>
      </Section>
    </div>
  );
}
