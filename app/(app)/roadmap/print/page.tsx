import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { listRoadmapActions, listRoadmapSubjects } from "@/lib/queries/roadmap";
import { applyFilters, groupBySubject, sortActions } from "@/lib/roadmap/filter";
import { buildRoadmapQuery, parseRoadmapParams } from "@/lib/roadmap/url";
import { timelineLabel } from "@/lib/roadmap/timeline";
import { shortAssignee } from "@/lib/roadmap/assignee-label";
import { ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import { localToday } from "@/lib/schedule/dates";
import { Card } from "@/components/ui/card";
import { RichText } from "@/components/roadmap/rich-text";
import { PrintButton } from "@/components/schedule/print-button";

/**
 * LA ROADMAP SUR PAPIER.
 *
 * Elle part en annexe du rapport mensuel et se projette en revue hebdomadaire.
 * Jusqu'ici cela voulait dire une capture d'écran : tronquée à la largeur de la
 * fenêtre, sans les lignes sous le pli, et sans dire quels filtres étaient
 * posés.
 *
 * ⚠ CE QUI EST IMPRIMÉ EST CE QUI EST FILTRÉ, et le bandeau l'écrit. Un
 * planning qui ne dit pas ce qu'il montre est un planning qui ment — c'est la
 * même règle que pour l'impression du plan de charge.
 *
 * Pas de pagination explicite ici, contrairement au Gantt : une liste de texte
 * se coupe proprement entre deux lignes, et `break-inside: avoid` suffit à ce
 * qu'une action ne soit pas tranchée en deux pages. Le Gantt, lui, devait
 * emporter son axe de temps sur chaque feuille.
 */
export default async function RoadmapPrintPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t, locale } = await getI18n();
  const params = parseRoadmapParams(await searchParams);

  const [subjects, actions] = await Promise.all([
    listRoadmapSubjects(),
    listRoadmapActions(params.archived),
  ]);

  const { actions: visible } = applyFilters(actions, params.filters);
  const groups = groupBySubject(sortActions(visible, params.sort), subjects);

  if (groups.length === 0) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center text-sm text-[var(--text-muted)]">
        <p>{t("roadmap.printNothing")}</p>
        <Link
          href={buildRoadmapQuery(params)}
          className="mt-3 inline-block underline"
          style={{ color: "var(--accent)" }}
        >
          {t("roadmap.printBack")}
        </Link>
      </Card>
    );
  }

  // Ce qui restreint la liste, écrit en toutes lettres. Les filtres vides ne
  // sont pas mentionnés : « Priorité : toutes » occupe une ligne pour ne rien
  // dire.
  const applied = [
    params.filters.statuses.map((s) => t(`roadmap.status_${s}`)),
    params.filters.priorities.map((p) => t(`roadmap.priority_${p}`)),
    params.filters.assignees,
  ]
    .flat()
    .join(" · ");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <style>{`@page { size: A4 portrait; margin: 12mm; }`}</style>

      <div
        data-print-hide=""
        className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3"
      >
        <PrintButton />
        <span className="text-xs text-[var(--text-muted)]">{t("roadmap.printPaperHint")}</span>
        <Link
          href={buildRoadmapQuery(params)}
          className="ml-auto text-xs underline"
          style={{ color: "var(--accent)" }}
        >
          {t("roadmap.printBack")}
        </Link>
      </div>

      <article className="print-sheet bg-white p-1">
        <header className="mb-3 border-b-2 pb-2" style={{ borderColor: "var(--accent)" }}>
          <h1 className="text-lg font-semibold text-[var(--text)]">
            {t("roadmap.printTitle")}
          </h1>
          <p className="text-[11px] text-[var(--text-muted)]">
            {`${t("roadmap.printIssued")} ${localToday()} · ${t("roadmap.printFilters")} ${
              applied === "" ? t("roadmap.printNoFilter") : applied
            }`}
          </p>
        </header>

        {groups.map((group) => (
          <section key={group.subjectId ?? "orphans"} className="mb-4">
            <h2
              className="mb-1 border-b border-[var(--border)] pb-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                color: group.subjectId === null ? "var(--danger)" : "var(--text-muted)",
              }}
            >
              {group.subjectName ?? t("roadmap.noSubject")}
            </h2>

            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-[var(--text-muted)]">
                  <th className="w-[46%] py-1 font-semibold">{t("roadmap.action")}</th>
                  <th className="w-[18%] py-1 font-semibold">{t("roadmap.timeline")}</th>
                  <th className="w-[12%] py-1 font-semibold">{t("roadmap.status")}</th>
                  <th className="w-[10%] py-1 font-semibold">{t("roadmap.priority")}</th>
                  <th className="w-[14%] py-1 font-semibold">{t("roadmap.assignee")}</th>
                </tr>
              </thead>
              <tbody>
                {group.actions.map((action) => {
                  const label = timelineLabel(action.timeline, locale);
                  return (
                    // `break-inside: avoid` : une action coupée entre deux
                    // pages perd son intitulé ou sa date, et il faut revenir
                    // en arrière pour la relire.
                    <tr
                      key={action.id}
                      className="border-b border-[var(--border)] align-top"
                      style={{ breakInside: "avoid" }}
                    >
                      <td
                        className="py-1 pr-2"
                        style={
                          action.priority === "urgent"
                            ? {
                                borderLeft: `3px solid ${ROADMAP_PRIORITY.urgent}`,
                                paddingLeft: 6,
                              }
                            : { paddingLeft: 9 }
                        }
                      >
                        <span className="font-medium text-[var(--text)]">{action.title}</span>
                        {action.detail && (
                          <RichText
                            source={action.detail}
                            className="mt-0.5 text-[10px] text-[var(--text-muted)]"
                          />
                        )}
                      </td>
                      <td className="py-1 pr-2 tabular-nums">
                        {t(`roadmap.timeline_${label.key}`, label.values)}
                      </td>
                      <td className="py-1 pr-2">
                        {action.status && (
                          // Les mêmes pastilles qu'à l'écran : qui a suivi la
                          // revue sur l'écran doit retrouver ses couleurs sur
                          // la feuille.
                          <span
                            className="inline-block rounded px-1.5 py-0.5"
                            style={{
                              backgroundColor: ROADMAP_STATUS[action.status].bg,
                              color: ROADMAP_STATUS[action.status].fg,
                            }}
                          >
                            {t(`roadmap.status_${action.status}`)}
                          </span>
                        )}
                      </td>
                      <td
                        className="py-1 pr-2 font-medium"
                        style={
                          action.priority
                            ? { color: ROADMAP_PRIORITY[action.priority] }
                            : undefined
                        }
                      >
                        {action.priority ? t(`roadmap.priority_${action.priority}`) : ""}
                      </td>
                      <td className="py-1">
                        {action.assignees.map((a) => shortAssignee(a.label)).join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </article>
    </div>
  );
}
