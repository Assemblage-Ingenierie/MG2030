import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { listContracts } from "@/lib/queries/referential";
import { toBoardModel } from "@/lib/schedule/to-board";
import { visibleTasks } from "@/lib/schedule/board-model";
import { filterTree } from "@/components/schedule/board-types";
import { buildLayout, ROW_H } from "@/lib/gantt/layout";
import {
  SHEET_HEAD_H,
  fitPxPerDay,
  fitScale,
  isPaper,
  paginate,
  printGeometry,
  type Paper,
} from "@/lib/schedule/print-layout";
import { ChartBody, TimeAxis } from "@/components/gantt/chart";
import { PrintButton } from "@/components/schedule/print-button";
import { Card } from "@/components/ui/card";
import type { ScaleUnit } from "@/lib/gantt/scale";

const SCALES: ScaleUnit[] = ["day", "week", "month", "quarter"];

/**
 * LE PLANNING SUR PAPIER.
 *
 * Les captures d'écran du Gantt finissent dans les rapports mensuels envoyés à
 * l'AFD : jusqu'ici elles se prenaient à la main, tronquées à la largeur de la
 * fenêtre, et il fallait trois captures pour un plan de trois ans.
 *
 * ⚠ UNE PAGE À PART, ET NON UNE FEUILLE DE STYLE D'IMPRESSION. Le diagramme de
 * l'écran fait trois mille pixels de large et vit dans une zone qui défile ;
 * le mettre à l'échelle en CSS donnerait des libellés de deux points, et le
 * laisser tel quel le couperait à la première page. Il faut le RECALCULER pour
 * la largeur du papier — c'est ce que fait `lib/schedule/print-layout.ts`.
 *
 * Trois partis pris :
 *   • PAYSAGE, toujours. Un Gantt en portrait perd un tiers de son axe de temps
 *     pour gagner six lignes ;
 *   • l'ACTIVITÉ seule à gauche. Durée, précédences et avancement sont des
 *     colonnes de saisie ; sur papier, on lit où tombent les barres ;
 *   • PAGINATION EXPLICITE. Chaque feuille porte son axe de temps et des lignes
 *     entières. Laissé au navigateur, le saut de page tombe au milieu d'une
 *     ligne et les barres d'une feuille ne se rattachent plus à aucun libellé.
 *
 * Les filtres de l'écran sont repris tels quels, et rappelés en tête : un
 * planning imprimé qui ne dit pas ce qu'il montre est un planning qui ment.
 */
export default async function SchedulePrintPage({
  searchParams,
}: {
  searchParams: Promise<{
    scenario?: string;
    scale?: string;
    contract?: string;
    subproject?: string;
    names?: string;
    paper?: string;
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

  if (!selected || !selected.isSchedulable) {
    return <Empty message={t("common.empty")} back={t("gantt.printBack")} />;
  }

  const [payload, contracts] = await Promise.all([
    loadSchedule(selected.code, scenarios),
    listContracts(),
  ]);

  const scale: ScaleUnit = SCALES.includes(params.scale as ScaleUnit)
    ? (params.scale as ScaleUnit)
    : "month";
  const paper: Paper = isPaper(params.paper ?? "") ? (params.paper as Paper) : "a4";
  const showNames = params.names !== "0";

  const model = toBoardModel(payload, contracts);

  // Mêmes filtres que l'écran, et `filterTree` conserve les ASCENDANTS : sans
  // cela, un filtre laisse des enfants indentés sous un parent disparu.
  const filtered = Boolean(params.contract || params.subproject);
  const keptIds = filtered
    ? new Set(
        filterTree(model.tasks, (task) => {
          if (params.contract && task.contractCode !== params.contract) return false;
          if (params.subproject && task.subproject !== params.subproject) return false;
          return true;
        }).map((task) => task.id),
      )
    : null;

  // Rien n'est replié sur papier : un repli est un geste de lecture à l'écran,
  // il n'a pas de sens sur une feuille qu'on ne peut pas déplier.
  const tasks = visibleTasks(model.tasks, new Set()).filter(
    (task) => keptIds === null || keptIds.has(task.id),
  );

  if (tasks.length === 0) {
    return <Empty message={t("gantt.printNothing")} back={t("gantt.printBack")} />;
  }

  const geometry = printGeometry(paper);

  const chartTasks = tasks.map((task) => ({
    id: task.id,
    wbsCode: task.wbsCode,
    activity: task.activity,
    type: task.type,
    start: task.start,
    end: task.end,
    progressPct: task.progressPct,
    depth: task.depth,
    contractCode: task.contractCode,
    ownerOrgCode: task.ownerOrgCode ?? null,
  }));

  const shownIds = new Set(tasks.map((task) => task.id));
  const dependencies = model.dependencies.filter(
    (d) => shownIds.has(d.predecessorId) && shownIds.has(d.successorId),
  );

  const common = {
    tasks: chartTasks,
    dependencies,
    scale,
    today: new Date().toISOString().slice(0, 10),
    bufferStart: payload.scenario?.bufferStartDate ?? null,
    deadline: payload.scenario?.deadlineDate ?? null,
    locale,
  };

  // TROIS PASSES, et chacune répond à une question que la précédente a ouverte.
  //
  //   1. Quelle est l'ÉTENDUE du plan ? `buildLayout` la calcule déjà, bornes
  //      de marge terminale et d'échéance comprises — inutile de la refaire.
  //   2. À quelle densité tient-elle sur la feuille ? C'est le rapport des
  //      largeurs.
  //   3. Cette densité laisse-t-elle l'échelle demandée LISIBLE ? Un plan de
  //      trois ans resserré sur 81 cm donne des mois de vingt-et-un pixels :
  //      l'axe s'imprime alors sans un seul libellé. On élargit l'unité, et on
  //      le dit dans le bandeau.
  const measured = buildLayout(common);
  const roughPxPerDay = fitPxPerDay(measured.chartWidth, measured.pxPerDay, geometry.chartWidth);
  const printedScale = fitScale(scale, roughPxPerDay);

  // Changer d'unité déplace les bornes (un trimestre commence avant un mois) :
  // on remesure plutôt que de réutiliser une densité calculée pour une autre
  // échelle, sinon le diagramme déborde de la feuille de quelques pour cent.
  const atScale = buildLayout({ ...common, scale: printedScale });
  const layout = buildLayout({
    ...common,
    scale: printedScale,
    pxPerDay: fitPxPerDay(atScale.chartWidth, atScale.pxPerDay, geometry.chartWidth),
  });

  const chartWidth = Math.min(geometry.chartWidth, Math.max(layout.chartWidth, 200));
  const sheets = paginate(tasks.length, geometry.rowsPerSheet);

  const labels = {
    buffer: t("gantt.buffer"),
    deadline: t("gantt.deadline"),
    today: t("gantt.today"),
    unreported: t("gantt.unreported"),
    late: t("gantt.late"),
  };

  const scopeLabel = params.contract
    ? params.contract
    : params.subproject
      ? t(`schedule.sub_${params.subproject}`)
      : t("gantt.filterWholeProject");

  const backHref = `/schedule?${new URLSearchParams({
    scenario: selected.code,
    scale,
    ...(params.contract ? { contract: params.contract } : {}),
    ...(params.subproject ? { subproject: params.subproject } : {}),
  }).toString()}`;

  return (
    <div className="mx-auto flex flex-col gap-4" style={{ width: geometry.pageWidth }}>
      {/* La règle `@page` est écrite ici et non dans la feuille globale : le
          format dépend du choix fait à l'écran, et `@page` ne lit pas de
          variable CSS. */}
      <style>{`@page { size: ${geometry.pageCss}; margin: 8mm; }`}</style>

      {/* Barre de commande — absente du papier. */}
      <div
        data-print-hide=""
        className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
      >
        <PrintButton />
        <span
          role="group"
          aria-label={t("gantt.printTitle")}
          className="inline-flex items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
        >
          {(["a4", "a3"] as Paper[]).map((value) => (
            <Link
              key={value}
              href={`?${new URLSearchParams({ ...params, paper: value } as Record<string, string>).toString()}`}
              aria-current={value === paper ? "true" : undefined}
              className={
                "rounded px-2.5 py-1 text-xs font-medium uppercase " +
                (value === paper
                  ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                  : "text-[var(--text-muted)]")
              }
            >
              {value}
            </Link>
          ))}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{t("gantt.printPaperHint")}</span>
        {printedScale !== scale && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            {t("gantt.printScaleWidened", {
              asked: t(`gantt.${scale}`),
              used: t(`gantt.${printedScale}`),
            })}
          </span>
        )}
        <Link
          href={backHref}
          className="ml-auto text-xs underline"
          style={{ color: "var(--accent)" }}
        >
          {t("gantt.printBack")}
        </Link>
      </div>

      {sheets.map((sheet, index) => (
        <section
          key={sheet.from}
          className="print-sheet border border-[var(--border)] bg-white"
          style={{ width: geometry.pageWidth }}
        >
          {/* Le bandeau est répété sur CHAQUE feuille : une page détachée de la
              liasse doit encore dire de quel scénario et de quelle date elle
              parle. */}
          <header
            className="flex items-end justify-between border-b border-[var(--border)] px-2 pb-1"
            style={{ height: SHEET_HEAD_H }}
          >
            <div>
              <h1 className="text-sm font-semibold text-[var(--text)]">
                {t("gantt.printTitle")}
              </h1>
              <p className="text-[10px] text-[var(--text-muted)]">
                {`${t("gantt.printScenario")} ${selected.code} · ${t("gantt.printScale")} ${t(
                  `gantt.${printedScale}`,
                )} · ${t("gantt.printFilter")} ${scopeLabel}`}
              </p>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {`${t("gantt.printIssued")} ${common.today} · ${index + 1}/${sheets.length}`}
            </p>
          </header>

          <div className="flex items-start">
            <div style={{ width: geometry.nameWidth }}>
              {/* Cale de la hauteur de l'axe : sans elle, la première activité
                  se retrouve en face de l'échelle de temps et tout le reste
                  est décalé d'une ligne. */}
              <div style={{ height: 44 }} className="border-b border-[var(--border)]" />
              {tasks.slice(sheet.from, sheet.from + sheet.count).map((task, i) => (
                <div
                  key={task.id}
                  className="flex items-center overflow-hidden px-1 text-[10px] text-[var(--text)]"
                  style={{
                    height: ROW_H,
                    paddingLeft: 4 + task.depth * 10,
                    fontWeight:
                      task.type === "summary" || task.type === "group_header" ? 600 : 400,
                    // Même alternance que le diagramme : c'est ce qui permet de
                    // suivre une ligne de l'œil sur trente centimètres.
                    backgroundColor:
                      (sheet.from + i) % 2 === 1 ? "rgba(0,0,0,0.035)" : undefined,
                  }}
                >
                  <span className="truncate">{task.activity}</span>
                </div>
              ))}
            </div>

            <div style={{ width: chartWidth }}>
              <TimeAxis layout={layout} width={chartWidth} />
              <ChartBody
                layout={layout}
                width={chartWidth}
                rowCount={tasks.length}
                labels={labels}
                showNames={showNames}
                window={sheet}
                idSuffix={`p${index}`}
              />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function Empty({ message, back }: { message: string; back: string }) {
  return (
    <Card className="mx-auto max-w-lg p-8 text-center text-sm text-[var(--text-muted)]">
      <p>{message}</p>
      <Link href="/schedule" className="mt-3 inline-block underline" style={{ color: "var(--accent)" }}>
        {back}
      </Link>
    </Card>
  );
}
