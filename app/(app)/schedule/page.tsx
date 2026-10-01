import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { listPeople } from "@/lib/queries/people";
import { listContracts } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
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

  /* ⚠ UN SEUL SCÉNARIO À L'ÉCRAN, « base » (01/10/2026).
     « Design-Bid-Build » n'a jamais porté une seule tâche, et « Design &
     Build » n'en porte que dix : le sélecteur proposait donc trois vues dont
     deux étaient vides ou partielles, ce qui se lit comme trois plans alors
     qu'il n'y en a qu'un. Les LIGNES RESTENT EN BASE — les dix tâches de
     « Design & Build » ne sont pas perdues, et rouvrir le choix ne demandera
     que de rétablir ces quelques lignes. Un lien portant `?scenario=…` est
     encore honoré, pour ne pas casser une capture d'écran partagée. */
  const selected =
    scenarios.find((s) => s.code === params.scenario) ??
    scenarios.find((s) => s.code === "base") ??
    scenarios.find((s) => s.isActive && s.isSchedulable) ??
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

  /* Jeu NU par défaut (01/10/2026) : l'activité et le diagramme. On vient
     d'abord lire où tombent les barres ; durée, précédences et avancement sont
     des colonnes de SAISIE, qu'on affiche quand on vient saisir. Toutes
     colonnes affichées, la grille prend près de 1000 px et il ne reste presque
     rien pour le diagramme. */
  const density: Density = isDensity(params.cols ?? "") ? (params.cols as Density) : "bare";
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

  /* Ce que l'impression reprend de l'écran : échelle, filtres, colonnes. Le
     REPLI s'y ajoute côté navigateur, seul endroit qui le connaisse. */
  const printQuery = new URLSearchParams({
    scenario: selected.code,
    scale,
    cols: density,
    ...(params.contract ? { contract: params.contract } : {}),
    ...(params.subproject ? { subproject: params.subproject } : {}),
    ...(showNames ? {} : { names: "0" }),
  }).toString();

  return (
    <div className="flex max-w-full flex-col gap-4">
      <Section
        title={t("schedule.title")}
        description={t("schedule.intro")}
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
            printQuery={printQuery}
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
