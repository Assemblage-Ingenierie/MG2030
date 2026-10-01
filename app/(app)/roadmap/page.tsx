import { getI18n } from "@/lib/i18n/server";
import { localToday } from "@/lib/schedule/dates";
import { listPeople } from "@/lib/queries/people";
import { assigneeLabels, listRoadmapActions, listRoadmapSubjects } from "@/lib/queries/roadmap";
import { applyFilters, groupBySubject, sortActions } from "@/lib/roadmap/filter";
import { buildRoadmapQuery, parseRoadmapParams } from "@/lib/roadmap/url";
import {
  ASSIGNEE_ENTITIES,
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
} from "@/lib/roadmap/types";
import { ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip, NotSet } from "@/components/ui/badge";
import { ViewSwitch } from "@/components/roadmap/view-switch";
import { ColumnHeader } from "@/components/roadmap/column-header";
import { InlinePriority, InlineStatus, InlineTimeline } from "@/components/roadmap/inline-cell";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { AddActionButton, ActionRowActions } from "@/components/roadmap/action-form";
import Link from "next/link";

/**
 * Roadmap — suivi opérationnel des actions de l'AMO.
 *
 * Reprise d'une feuille Google dont le champ « Timeline » mêlait des dates
 * exactes, des semaines, des trimestres et beaucoup de vide. Tout l'écran en
 * découle : on affiche la PRÉCISION telle qu'elle a été voulue, et on ne
 * transforme jamais une semaine en jour.
 *
 * Filtres et tri vivent DANS LES EN-TÊTES de colonnes, comme dans un tableur,
 * et dans l'URL : une vue filtrée se partage par un lien.
 */
export default async function RoadmapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { t } = await getI18n();
  const params = parseRoadmapParams(await searchParams);

  const [subjects, actions, people] = await Promise.all([
    listRoadmapSubjects(),
    listRoadmapActions(),
    listPeople(),
  ]);

  const { actions: visible, hiddenCompleted } = applyFilters(actions, params.filters);
  const sorted = sortActions(visible, params.sort);
  const groups = groupBySubject(sorted, subjects);

  const personOptions = people.map((p) => ({ id: p.id, fullName: p.fullName }));

  // Les assignataires proposés au filtre viennent des DONNÉES, entités et
  // comptes compris : « Alban » et « G8 » n'existent dans aucun référentiel et
  // ne seraient jamais proposés autrement.
  const assigneeOptions = [
    ...new Set([...ASSIGNEE_ENTITIES, ...assigneeLabels(actions)]),
  ].map((label) => ({ value: label, label }));

  const statusOptions = ROADMAP_STATUSES.map((s) => ({
    value: s,
    label: t(`roadmap.status_${s}`),
    swatch: ROADMAP_STATUS[s].bg,
  }));
  const priorityOptions = [...ROADMAP_PRIORITIES].reverse().map((p) => ({
    value: p,
    label: t(`roadmap.priority_${p}`),
    swatch: ROADMAP_PRIORITY[p],
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Section
        title={t("roadmap.title")}
        description={t("roadmap.intro")}
        actions={<AddActionButton subjects={subjects} people={personOptions} />}
      >
        {/* La vue d'un côté, l'état du filtrage de l'autre. Le compte des
            terminées masquées est la seule chose qui doive rester visible en
            permanence : sans lui, des lignes manquent sans explication. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ViewSwitch params={params} />
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            {hiddenCompleted > 0 && (
              <span>{t("roadmap.completedHidden", { count: String(hiddenCompleted) })}</span>
            )}
            <Link
              href={buildRoadmapQuery(params, { showCompleted: !params.filters.showCompleted })}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-medium text-[var(--text)]"
            >
              {t(
                params.filters.showCompleted
                  ? "roadmap.hideCompleted"
                  : "roadmap.showCompleted",
              )}
            </Link>
          </div>
        </div>

        {params.view === "timeline" ? (
          <RoadmapTimeline
            groups={groupBySubject(
              sorted.filter((a) => a.timeline.kind !== null),
              subjects,
            )}
            undated={sorted.filter((a) => a.timeline.kind === null)}
            today={localToday()}
          />
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
            {actions.length === 0 ? t("roadmap.empty") : t("roadmap.emptyFiltered")}
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.subjectId} className="overflow-visible">
              <div className="border-b border-[var(--border)] bg-[var(--app-bg)] px-3 py-2">
                <h3 className="text-sm font-semibold text-[var(--text)]">{group.subjectName}</h3>
              </div>
              {/* `overflow-visible` et non `hidden` : les menus de filtre et
                  d'édition en ligne débordent de la carte, et un rognage les
                  couperait net. */}
              <Table>
                <Thead>
                  <Th>
                    <ColumnHeader
                      label={t("roadmap.action")}
                      column="action"
                      kind={null}
                      params={params}
                    />
                  </Th>
                  <Th>
                    <ColumnHeader
                      label={t("roadmap.timeline")}
                      column="timeline"
                      kind={null}
                      params={params}
                    />
                  </Th>
                  <Th>
                    <ColumnHeader
                      label={t("roadmap.status")}
                      column="status"
                      kind="statuses"
                      options={statusOptions}
                      params={params}
                    />
                  </Th>
                  <Th>
                    <ColumnHeader
                      label={t("roadmap.priority")}
                      column="priority"
                      kind="priorities"
                      options={priorityOptions}
                      params={params}
                    />
                  </Th>
                  <Th>
                    <ColumnHeader
                      label={t("roadmap.assignee")}
                      column="assignee"
                      kind="assignees"
                      options={assigneeOptions}
                      params={params}
                    />
                  </Th>
                  <Th align="right">{t("common.actions")}</Th>
                </Thead>
                <tbody>
                  {group.actions.length === 0 && (
                    <EmptyRow colSpan={6}>{t("roadmap.emptyFiltered")}</EmptyRow>
                  )}
                  {group.actions.map((action) => (
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
                        <InlineTimeline actionId={action.id} value={action.timeline} />
                      </Td>
                      <Td>
                        <InlineStatus
                          actionId={action.id}
                          value={action.status}
                          notSetLabel={t("roadmap.notSet")}
                        />
                      </Td>
                      <Td>
                        <InlinePriority
                          actionId={action.id}
                          value={action.priority}
                          notSetLabel={t("roadmap.notSet")}
                        />
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
                        <ActionRowActions
                          action={action}
                          subjects={subjects}
                          people={personOptions}
                        />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ))
        )}
      </Section>
    </div>
  );
}
