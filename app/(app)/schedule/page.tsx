import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { listPeople } from "@/lib/queries/people";
import { listContracts } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
import { ScenarioSwitch } from "@/components/schedule/scenario-switch";
import { UnschedulableNotice } from "@/components/schedule/unschedulable-notice";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { ScaleSwitch } from "@/components/schedule/scale-switch";
import { filterTree, isDensity, type Density } from "@/components/schedule/board-types";
import { toBoardModel } from "@/lib/schedule/to-board";
import type { BoardModel } from "@/lib/schedule/board-model";
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
    subproject?: string;
    cols?: string;
    names?: string;
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

  const [{ tasks, dependencies, constraints, scenario }, people, contracts] =
    await Promise.all([
      loadSchedule(selected.code, scenarios),
      listPeople(),
      listContracts(),
    ]);

  const scale: ScaleUnit = SCALES.includes(params.scale as ScaleUnit)
    ? (params.scale as ScaleUnit)
    : "month";

  // Jeu de colonnes réduit PAR DÉFAUT : toutes colonnes affichées, la grille
  // prend près de 1000 px et il ne reste presque rien pour le diagramme.
  // `cols=all` (ancien lien) continue de fonctionner, et `cols=bare` ne garde
  // que l'activité.
  const density: Density = isDensity(params.cols ?? "") ? (params.cols as Density) : "compact";
  // Noms des tâches affichés PAR DÉFAUT : sans eux, une barre ne se lit qu'en
  // suivant sa ligne jusqu'à la grille. `names=0` les masque.
  const showNames = params.names !== "0";

  const initial: BoardModel = toBoardModel(
    { tasks, dependencies, constraints },
    contracts.map((c) => ({ id: c.id, contractCode: c.contractCode })),
  );

  // ── Vues filtrées (brief §9.4) ───────────────────────────────────────────
  //
  // Le filtre ne touche PAS au modèle : il ne fait que restreindre l'affichage.
  // Sinon les numéros de ligne se renuméroteraient d'une vue à l'autre, et les
  // précédences pointant hors du filtre disparaîtraient de la saisie.
  //
  // `filterTree` conserve les ASCENDANTS des lignes retenues : sans cela, un
  // filtre laissait des enfants indentés sous un parent disparu.
  const filtered = Boolean(params.contract || params.subproject);

  const visibleIds = filtered
    ? filterTree(initial.tasks, (task) => {
        if (params.contract && task.contractCode !== params.contract) return false;
        if (params.subproject && task.subproject !== params.subproject) return false;
        return true;
      }).map((task) => task.id)
    : null;

  const contractCodes = [
    ...new Set(tasks.map((task) => task.contractCode).filter((c): c is string => Boolean(c))),
  ].sort();
  // Les DEUX sous-projets, toujours, et non ceux présents dans le scénario.
  // Le scénario « Base » ne porte que les training venues : le Student Center
  // n'apparaissait donc nulle part, et on ne pouvait pas constater qu'il était
  // vide ici. Un filtre qui rend zéro ligne est une information ; un filtre
  // absent n'en est pas une.
  const subprojects = ["athletes_village", "training_venues"];

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
            subprojects={subprojects}
            currentSubproject={params.subproject ?? null}
            density={density}
            showNames={showNames}
            scenarioCode={selected.code}
          />
          <ScheduleBoard
            initial={initial}
            people={people}
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
            density={density}
            showNames={showNames}
            visibleIds={visibleIds}
          />
        </Card>
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
