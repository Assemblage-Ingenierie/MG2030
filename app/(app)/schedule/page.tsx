import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { listPeople } from "@/lib/queries/people";
import { listSiteOptions } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
import { ScenarioSwitch } from "@/components/schedule/scenario-switch";
import { UnschedulableNotice } from "@/components/schedule/unschedulable-notice";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { ScaleSwitch } from "@/components/schedule/scale-switch";
import { SourceNote } from "@/components/referential/source-note";
import { filterTree, type BoardTask } from "@/components/schedule/board-types";
import type { ScaleUnit } from "@/lib/gantt/scale";

const SCALES: ScaleUnit[] = ["day", "week", "month", "quarter"];

/**
 * PLAN DE CHARGE — grille de saisie et Gantt sur la même page.
 *
 * Le calendrier global et le calendrier de passation sont LE MÊME OBJET
 * (brief §7) : un seul écran, et le filtre par marché en tient lieu. Le
 * diagramme est le PROLONGEMENT des colonnes éditables, pas une seconde vue à
 * tenir synchronisée.
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

  // `scenarios` est passé au chargeur : sans cela il les relisait, doublant la
  // requête d'agrégat sur les tâches à chaque affichage.
  const [{ tasks, dependencies, constraints, scenario }, people, sites] = await Promise.all([
    loadSchedule(selected.code, scenarios),
    listPeople(),
    listSiteOptions(),
  ]);

  // Jeu de colonnes réduit PAR DÉFAUT : toutes colonnes affichées, la grille
  // prend 986 px et il ne reste que 160 px de diagramme sur un portable.
  const compact = params.cols !== "all";

  const scale: ScaleUnit = SCALES.includes(params.scale as ScaleUnit)
    ? (params.scale as ScaleUnit)
    : "month";

  const byId = new Map(tasks.map((task) => [task.id, task]));
  const constraintByTask = new Map(constraints.map((c) => [c.taskId, c.date]));

  const predecessorCodes = new Map<string, string[]>();
  for (const dep of dependencies) {
    const code = byId.get(dep.predecessorId)?.wbsCode;
    if (!code) continue;
    const list = predecessorCodes.get(dep.successorId);
    if (list) list.push(code);
    else predecessorCodes.set(dep.successorId, [code]);
  }

  const all: BoardTask[] = tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    activity: task.activity,
    type: task.type,
    parentId: task.parentId,
    depth: task.depth,
    durationDays: task.durationDays,
    start: task.computed?.start ?? task.storedStart,
    end: task.computed?.end ?? task.storedEnd,
    startAnchor: task.startDateInput,
    constraintDate: constraintByTask.get(task.id) ?? null,
    progressPct: task.progressPct,
    ownerId: task.ownerId,
    ownerName: task.ownerName,
    contractCode: task.contractCode,
    subproject: task.subproject,
    siteId: task.siteId,
    siteCode: task.siteCode,
    predecessorCodes: (predecessorCodes.get(task.id) ?? []).sort(),
    driver: task.computed?.driver ?? null,
    drivingPredecessor: task.computed?.drivingPredecessor ?? null,
    drifted: task.drifted,
  }));

  // ── Vues filtrées (brief §9.4) ───────────────────────────────────────────
  //
  // Le calendrier de passation n'est pas un module séparé : c'est une VUE
  // FILTRÉE du même planning (brief §7). D'où trois filtres sur un seul écran.
  //
  // `filterTree` conserve les ASCENDANTS des lignes retenues. Sans cela, un
  // filtre laissait des enfants indentés sous un parent disparu, et faisait
  // s'évanouir les récapitulatifs — qui ne portent ni marché ni site alors
  // qu'ils donnent le total. C'était un défaut du filtre par marché.
  const selectedSite = params.site
    ? sites.find((s) => s.siteCode === params.site) ?? null
    : null;

  const board = filterTree(all, (task) => {
    if (params.contract && task.contractCode !== params.contract) return false;

    // Un site précis : les tâches explicitement rattachées à ce hall, UNION
    // celles de son sous-projet qui n'en désignent aucun. Car « Training
    // venues works » couvre les 13 halls à la fois — l'exclure de la vue d'un
    // hall cacherait le travail qui s'y déroule vraiment.
    if (selectedSite) {
      const attached = task.siteId !== null;
      if (attached) return task.siteCode === selectedSite.siteCode;
      return task.subproject === selectedSite.subproject;
    }

    if (params.subproject && task.subproject !== params.subproject) return false;
    return true;
  });

  const visibleIds = new Set(board.map((task) => task.id));
  // Une flèche dont une extrémité est filtrée n'a nulle part où aboutir.
  const links = dependencies
    .filter((d) => visibleIds.has(d.predecessorId) && visibleIds.has(d.successorId))
    .map((d) => ({ predecessorId: d.predecessorId, successorId: d.successorId }));

  const contractCodes = [
    ...new Set(tasks.map((task) => task.contractCode).filter((c): c is string => Boolean(c))),
  ].sort();

  // Sous-projets réellement présents dans ce scénario : on ne propose pas un
  // filtre qui ne retiendrait rien.
  const subprojects = [
    ...new Set(tasks.map((task) => task.subproject).filter((s): s is NonNullable<typeof s> => Boolean(s))),
  ].sort();

  const drifted = board.filter((task) => task.drifted).length;
  const unassigned = board.filter(
    (task) => task.type === "task" && task.ownerId === null,
  ).length;

  // Le plan d'accueil des nouvelles tâches : celui du scénario affiché.
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
            tasks={board}
            dependencies={links}
            people={people}
            sites={sites}
            scenarioCode={selected.code}
            planId={planId}
            scale={scale}
            today={new Date().toISOString().slice(0, 10)}
            bufferStart={scenario?.bufferStartDate ?? null}
            deadline={scenario?.deadlineDate ?? null}
            locale={locale}
            compact={compact}
          />
        </Card>

        {board.length < all.length && (
          <SourceNote>
            {t("schedule.filteredNote", {
              shown: String(board.length),
              total: String(all.length),
            })}
          </SourceNote>
        )}
        {drifted > 0 && <SourceNote>{t("schedule.driftNote")}</SourceNote>}
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
