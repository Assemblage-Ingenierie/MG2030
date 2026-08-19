import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { Card, Section } from "@/components/ui/card";
import { TaskGrid, type GridTask } from "@/components/schedule/task-grid";
import { ScenarioSwitch } from "@/components/schedule/scenario-switch";
import { UnschedulableNotice } from "@/components/schedule/unschedulable-notice";
import { SourceNote } from "@/components/referential/source-note";

/**
 * Planning.
 *
 * Le calendrier global et le calendrier de passation sont LE MÊME OBJET
 * (brief §7) : il n'y a qu'un écran, et le filtre par marché en tient lieu.
 */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ scenario?: string }>;
}) {
  const { t } = await getI18n();
  const { scenario: requested } = await searchParams;

  const scenarios = await listScenarios();
  // Par défaut, le scénario actif ; à défaut, le premier planifiable.
  const selected =
    scenarios.find((s) => s.code === requested) ??
    scenarios.find((s) => s.isActive && s.isSchedulable) ??
    scenarios.find((s) => s.isSchedulable) ??
    null;

  if (!selected) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-[var(--text-muted)]">
        {t("common.empty")}
      </Card>
    );
  }

  // Un scénario sans planning exploitable ne s'affiche PAS vide : on explique
  // pourquoi (GAPS 9). Une liste vide se lirait comme une panne.
  if (!selected.isSchedulable) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <Section title={t("schedule.title")} description={t("schedule.intro")}>
          <ScenarioSwitch scenarios={scenarios} current={selected.code} />
          <UnschedulableNotice scenario={selected} />
        </Section>
      </div>
    );
  }

  const { tasks, scenario } = await loadSchedule(selected.code);

  const rows: GridTask[] = tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    type: task.type,
    activity: task.activity,
    durationDays: task.durationDays,
    start: task.computed?.start ?? task.storedStart,
    end: task.computed?.end ?? task.storedEnd,
    progressPct: task.progressPct,
    contractCode: task.contractCode,
    depth: task.depth,
    drifted: task.drifted,
    driver: task.computed?.driver ?? null,
    drivingPredecessor: task.computed?.drivingPredecessor ?? null,
  }));

  const drifted = rows.filter((r) => r.drifted).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section
        title={t("schedule.title")}
        description={t("schedule.intro")}
        actions={<ScenarioSwitch scenarios={scenarios} current={selected.code} />}
      >
        {/* La marge terminale et l'échéance des Jeux sont le cadre dans lequel
            tout le reste doit tenir : elles sont affichées avant la grille. */}
        {scenario?.bufferStartDate && (
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 text-sm">
            <Fact label={t("schedule.bufferStart")} value={scenario.bufferStartDate} />
            <Fact
              label={t("schedule.bufferMonths")}
              value={String(scenario.bufferMonths ?? "—")}
            />
            <Fact label={t("schedule.deadline")} value={scenario.deadlineDate ?? "—"} />
          </Card>
        )}

        <Card className="overflow-hidden">
          <TaskGrid tasks={rows} scenarioCode={selected.code} />
        </Card>

        {drifted > 0 && <SourceNote>{t("schedule.driftNote")}</SourceNote>}
      </Section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="font-medium tabular-nums text-[var(--text)]">{value}</span>
    </span>
  );
}
