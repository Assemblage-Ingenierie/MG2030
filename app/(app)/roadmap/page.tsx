import { getI18n } from "@/lib/i18n/server";
import { localToday } from "@/lib/schedule/dates";
import { assigneeLabels, listRoadmapActions, listRoadmapSubjects } from "@/lib/queries/roadmap";
import {
  DEFAULT_FILTERS,
  applyFilters,
  groupBySubject,
  sortActions,
  type DateFilter,
  type RoadmapFilters,
} from "@/lib/roadmap/filter";
import { timelineLabel } from "@/lib/roadmap/timeline";
import {
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@/lib/roadmap/types";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip, NotSet } from "@/components/ui/badge";
import { RoadmapFilterBar } from "@/components/roadmap/roadmap-filters";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { AddActionButton, ActionRowActions } from "@/components/roadmap/action-form";

/**
 * Roadmap — suivi opérationnel des actions de l'AMO.
 *
 * Reprise d'une feuille Google dont le champ « Timeline » mêlait des dates
 * exactes, des semaines, des trimestres et beaucoup de vide. Tout l'écran
 * découle de ce constat : on affiche la PRÉCISION telle qu'elle a été voulue,
 * et on ne transforme jamais une semaine en jour.
 *
 * Les filtres passent par l'URL — une vue se partage par un lien et survit au
 * rechargement. Les actions terminées sont masquées par défaut, et l'écran dit
 * combien il en masque.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    priority?: string;
    status?: string;
    assignee?: string;
    date?: string;
    completed?: string;
  }>;
}) {
  const { t, locale } = await getI18n();
  const params = await searchParams;

  const [subjects, actions] = await Promise.all([
    listRoadmapSubjects(),
    listRoadmapActions(),
  ]);

  const filters = parseFilters(params);
  const view = params.view === "timeline" ? "timeline" : "list";

  const { actions: visible, hiddenCompleted } = applyFilters(actions, filters);
  const sorted = sortActions(visible);
  const groups = groupBySubject(sorted);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Section
        title={t("roadmap.title")}
        description={t("roadmap.intro")}
        actions={<AddActionButton subjects={subjects} />}
      >
        <Card className="overflow-hidden">
          <RoadmapFilterBar
            filters={filters}
            assignees={assigneeLabels(actions)}
            hiddenCompleted={hiddenCompleted}
            view={view}
          />
        </Card>

        {view === "timeline" ? (
          <RoadmapTimeline
            groups={groupBySubject(sorted.filter((a) => a.timeline.kind !== null))}
            undated={sorted.filter((a) => a.timeline.kind === null)}
            today={localToday()}
          />
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
            {actions.length === 0 ? t("roadmap.empty") : t("roadmap.emptyFiltered")}
          </Card>
        ) : (
          /* Un tableau PAR SUJET plutôt qu'un seul tableau avec une colonne
             « sujet » répétée : le regroupement est la structure même de la
             roadmap, et la répétition de la valeur en ferait du bruit. */
          groups.map((group) => (
            <Card key={group.subjectId} className="overflow-hidden">
              <div className="border-b border-[var(--border)] bg-[var(--app-bg)] px-3 py-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">{group.subjectName}</h3>
              </div>
              <Table>
                <Thead>
                  <Th>{t("roadmap.action")}</Th>
                  <Th>{t("roadmap.timeline")}</Th>
                  <Th>{t("roadmap.status")}</Th>
                  <Th>{t("roadmap.priority")}</Th>
                  <Th>{t("roadmap.assignee")}</Th>
                  <Th align="right">{t("common.actions")}</Th>
                </Thead>
                <tbody>
                  {group.actions.length === 0 && (
                    <EmptyRow colSpan={6}>{t("roadmap.emptyFiltered")}</EmptyRow>
                  )}
                  {group.actions.map((action) => {
                    const label = timelineLabel(action.timeline, locale);
                    return (
                      <Tr key={action.id}>
                        <Td>
                          <span className="text-[14px] text-[var(--text)]">{action.title}</span>
                          {action.comments && (
                            <span className="block text-xs text-[var(--text-muted)]">
                              {action.comments}
                            </span>
                          )}
                        </Td>
                        <Td>
                          {/* L'absence de date est GRISÉE, pas vide : une
                              cellule blanche se lit comme un oubli. */}
                          <span
                            className={
                              action.timeline.kind === null
                                ? "text-xs text-[var(--text-muted)]"
                                : "text-xs tabular-nums text-[var(--text)]"
                            }
                          >
                            {t(`roadmap.timeline_${label.key}`, label.values)}
                          </span>
                        </Td>
                        <Td>
                          {action.status ? (
                            <Badge tone={statusTone(action.status)}>
                              {t(`roadmap.status_${action.status}`)}
                            </Badge>
                          ) : (
                            <NotSet label={t("roadmap.notSet")} />
                          )}
                        </Td>
                        <Td>
                          {action.priority ? (
                            <span
                              className="text-xs font-medium"
                              style={
                                action.priority === "urgent"
                                  ? { color: "var(--danger)" }
                                  : { color: "var(--text-muted)" }
                              }
                            >
                              {t(`roadmap.priority_${action.priority}`)}
                            </span>
                          ) : (
                            <NotSet label={t("roadmap.notSet")} />
                          )}
                        </Td>
                        <Td>
                          {action.assignees.length === 0 ? (
                            <NotSet label={t("roadmap.notSet")} />
                          ) : (
                            <span className="flex flex-wrap gap-1">
                              {action.assignees.map((a) => (
                                <Chip key={a.label}>{a.label}</Chip>
                              ))}
                            </span>
                          )}
                        </Td>
                        <Td align="right">
                          <ActionRowActions action={action} subjects={subjects} />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          ))
        )}
      </Section>
    </div>
  );
}

/**
 * Les filtres viennent de l'URL, donc de l'extérieur : toute valeur inconnue
 * retombe sur le défaut plutôt que de filtrer sur une chaîne arbitraire.
 */
function parseFilters(params: {
  priority?: string;
  status?: string;
  assignee?: string;
  date?: string;
  completed?: string;
}): RoadmapFilters {
  const priority = ROADMAP_PRIORITIES.includes(params.priority as RoadmapPriority)
    ? (params.priority as RoadmapPriority)
    : null;
  const status = ROADMAP_STATUSES.includes(params.status as RoadmapStatus)
    ? (params.status as RoadmapStatus)
    : null;
  const date: DateFilter =
    params.date === "dated" || params.date === "undated" ? params.date : "all";

  return {
    ...DEFAULT_FILTERS,
    priority,
    status,
    assignee: params.assignee?.trim() || null,
    date,
    showCompleted: params.completed === "1",
  };
}

/** Le statut emprunte le vocabulaire d'état déjà employé ailleurs. */
function statusTone(status: RoadmapStatus): "running" | "done" | "upcoming" {
  if (status === "done") return "done";
  if (status === "in_progress") return "running";
  return "upcoming";
}
