import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { listPeople } from "@/lib/queries/people";
import { listContracts, listSiteOptions } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
import { ScenarioSwitch } from "@/components/schedule/scenario-switch";
import { UnschedulableNotice } from "@/components/schedule/unschedulable-notice";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { ScaleSwitch } from "@/components/schedule/scale-switch";
import { SourceNote } from "@/components/referential/source-note";
import { filterTree } from "@/components/schedule/board-types";
import { recompute, type BoardModel, type ModelTask } from "@/lib/schedule/board-model";
import type { ScaleUnit } from "@/lib/gantt/scale";

const SCALES: ScaleUnit[] = ["day", "week", "month", "quarter"];

/**
 * PLAN DE CHARGE — grille de saisie et Gantt sur la même page.
 *
 * Le calendrier global et le calendrier de passation sont LE MÊME OBJET
 * (brief §7) : un seul écran, et les filtres en tiennent lieu. Le diagramme est
 * le PROLONGEMENT des colonnes éditables, pas une seconde vue à tenir
 * synchronisée.
 *
 * Cette page ne fait que CHARGER et FILTRER. Toute l'édition vit dans le
 * navigateur (components/schedule/use-board.ts) : le moteur de planification
 * est pur, il y tourne aussi bien qu'ici, et c'est ce qui rend la saisie
 * instantanée au lieu d'attendre un aller-retour par frappe.
 */
export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    scenario?: string;
    scale?: string;
    contract?: string;
    site?: string;
    subproject?: string;
    cols?: string;
  }>;
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

  const [{ tasks, dependencies, constraints, scenario }, people, sites, contracts] =
    await Promise.all([
      loadSchedule(selected.code, scenarios),
      listPeople(),
      listSiteOptions(),
      listContracts(),
    ]);

  const scale: ScaleUnit = SCALES.includes(params.scale as ScaleUnit)
    ? (params.scale as ScaleUnit)
    : "month";

  // Jeu de colonnes réduit PAR DÉFAUT : toutes colonnes affichées, la grille
  // prend près de 1000 px et il ne reste presque rien pour le diagramme.
  const compact = params.cols !== "all";

  const constraintByTask = new Map(constraints.map((c) => [c.taskId, c.date]));
  const contractIdByCode = new Map(contracts.map((c) => [c.contractCode, c.id]));

  const modelTasks: ModelTask[] = tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    activity: task.activity,
    type: task.type,
    parentId: task.parentId,
    durationDays: task.durationDays,
    startAnchor: task.startDateInput,
    constraintDate: constraintByTask.get(task.id) ?? null,
    progressPct: task.progressPct,
    ownerId: task.ownerId,
    ownerName: task.ownerName,
    contractId: task.contractCode ? contractIdByCode.get(task.contractCode) ?? null : null,
    contractCode: task.contractCode,
    siteId: task.siteId,
    siteCode: task.siteCode,
    subproject: task.subproject,
    sortOrder: task.sortOrder,
    start: task.computed?.start ?? task.storedStart,
    end: task.computed?.end ?? task.storedEnd,
    depth: task.depth,
    driver: task.computed?.driver ?? null,
    drivingPredecessor: task.computed?.drivingPredecessor ?? null,
    drifted: task.drifted,
  }));

  // Début de projet : la plus ancienne contrainte, à défaut la plus ancienne
  // date stockée. Jamais une date en dur.
  const projectStart =
    constraints.map((c) => c.date).sort()[0] ??
    modelTasks
      .map((task) => task.start)
      .filter((d): d is string => Boolean(d))
      .sort()[0] ??
    new Date().toISOString().slice(0, 10);

  // On recalcule une fois côté serveur pour que le premier rendu soit déjà
  // juste : sans cela, l'écran afficherait brièvement les dates stockées.
  const initial: BoardModel = recompute({
    tasks: modelTasks,
    dependencies: dependencies.map((d) => ({
      predecessorId: d.predecessorId,
      successorId: d.successorId,
    })),
    projectStart,
    cycle: null,
  });

  // ── Vues filtrées (brief §9.4) ───────────────────────────────────────────
  //
  // Le filtre ne touche PAS au modèle : il ne fait que restreindre l'affichage.
  // Sinon les numéros de ligne se renuméroteraient d'une vue à l'autre, et les
  // précédences pointant hors du filtre disparaîtraient de la saisie.
  //
  // `filterTree` conserve les ASCENDANTS des lignes retenues : sans cela, un
  // filtre laissait des enfants indentés sous un parent disparu.
  const selectedSite = params.site
    ? sites.find((s) => s.siteCode === params.site) ?? null
    : null;
  const filtered = Boolean(params.contract || params.site || params.subproject);

  const visibleIds = filtered
    ? filterTree(initial.tasks, (task) => {
        if (params.contract && task.contractCode !== params.contract) return false;

        // Un site précis : les tâches rattachées à ce hall, UNION celles de son
        // sous-projet qui n'en désignent aucun. Car « Training venues works »
        // couvre les 13 halls à la fois.
        if (selectedSite) {
          if (task.siteId !== null) return task.siteCode === selectedSite.siteCode;
          return task.subproject === selectedSite.subproject;
        }

        if (params.subproject && task.subproject !== params.subproject) return false;
        return true;
      }).map((task) => task.id)
    : null;

  const contractCodes = [
    ...new Set(tasks.map((task) => task.contractCode).filter((c): c is string => Boolean(c))),
  ].sort();
  const subprojects = [
    ...new Set(
      initial.tasks
        .map((task) => task.subproject)
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    ),
  ].sort();

  const unassigned = initial.tasks.filter(
    (task) => task.type === "task" && task.ownerId === null,
  ).length;

  const planId = tasks[0]?.planId ?? "";

  return (
    <div className="flex max-w-full flex-col gap-4">
      <Section
        title={t("schedule.title")}
        description={t("schedule.intro")}
        actions={<ScenarioSwitch scenarios={scenarios} current={selected.code} />}
      >
        {/* La marge terminale et l'échéance des Jeux sont le cadre dans lequel
            tout le reste doit tenir : affichées avant la grille. */}
        {scenario?.bufferStartDate && (
          <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 text-sm">
            <Fact label={t("schedule.bufferStart")} value={scenario.bufferStartDate} />
            <Fact label={t("schedule.bufferMonths")} value={String(scenario.bufferMonths ?? "—")} />
            <Fact label={t("schedule.deadline")} value={scenario.deadlineDate ?? "—"} />
          </Card>
        )}

        <Card className="overflow-hidden">
          <ScaleSwitch
            scale={scale}
            scales={SCALES}
            contractCodes={contractCodes}
            currentContract={params.contract ?? null}
            sites={sites}
            currentSite={params.site ?? null}
            subprojects={subprojects}
            currentSubproject={params.subproject ?? null}
            compact={compact}
            scenarioCode={selected.code}
          />
          <ScheduleBoard
            initial={initial}
            people={people}
            sites={sites}
            contracts={contracts.map((c) => ({
              id: c.id,
              contractCode: c.contractCode,
              name: c.name,
            }))}
            scenarioCode={selected.code}
            planId={planId}
            scale={scale}
            today={new Date().toISOString().slice(0, 10)}
            bufferStart={scenario?.bufferStartDate ?? null}
            deadline={scenario?.deadlineDate ?? null}
            locale={locale}
            compact={compact}
            visibleIds={visibleIds}
          />
        </Card>

        {visibleIds !== null && (
          <SourceNote>
            {t("schedule.filteredNote", {
              shown: String(visibleIds.length),
              total: String(initial.tasks.length),
            })}
          </SourceNote>
        )}
        {unassigned > 0 && (
          <SourceNote>{t("schedule.unassignedNote", { count: String(unassigned) })}</SourceNote>
        )}
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
