import { Fragment } from "react";
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
import { EmptyRow, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ViewSwitch } from "@/components/roadmap/view-switch";
import { ColumnHeader } from "@/components/roadmap/column-header";
import {
  InlineAssignees,
  InlineDetail,
  InlinePriority,
  InlineStatus,
  InlineTimeline,
  InlineTitle,
} from "@/components/roadmap/inline-cell";
import { RoadmapTimeline } from "@/components/roadmap/roadmap-timeline";
import { AddActionButton, ActionRowActions } from "@/components/roadmap/action-form";
import { AddSubject, SubjectTitle } from "@/components/roadmap/subject-row";
import { RoadmapExports } from "@/components/roadmap/exports";
import { hasAmbiguousFirstNames } from "@/lib/roadmap/assignee-label";
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

  const [subjects, actions, people, archivedCount] = await Promise.all([
    listRoadmapSubjects(),
    listRoadmapActions(params.archived),
    listPeople(),
    // Compté toujours, pour que le bouton des archives annonce combien il en
    // contient : « Archives » tout court n'apprend pas s'il y a quelque chose
    // à y voir.
    listRoadmapActions(true).then((a) => a.length),
  ]);

  const { actions: visible, hiddenCompleted } = applyFilters(actions, params.filters);
  const sorted = sortActions(visible, params.sort);
  const groups = groupBySubject(sorted, subjects);

  const personOptions = people.map((p) => ({ id: p.id, fullName: p.fullName }));

  // ⚠ ON N'ÉCRIT LE PRÉNOM SEUL QUE S'IL DÉSIGNE ENCORE. Deux « Arben »
  // réduits à « Arben » ne se distinguent plus, et une colonne illisible vaut
  // mieux qu'une colonne fausse. Décidé sur l'ensemble des comptes et des
  // libellés employés, pas ligne par ligne : un même nom doit s'écrire de la
  // même façon partout dans le tableau.
  const shortNames = !hasAmbiguousFirstNames([
    ...people.map((p) => p.fullName),
    ...assigneeLabels(actions),
  ]);

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
      {/* Sans sous-titre : la phrase d'intention se lisait une fois, puis
          occupait deux lignes à chaque visite d'un écran consulté
          quotidiennement. Retirée le 01/10/2026. */}
      <Section
        title={t("roadmap.title")}
        actions={<AddActionButton subjects={subjects} people={personOptions} />}
      >
        {/* La vue d'un côté, l'état du filtrage de l'autre. Le compte des
            terminées masquées est la seule chose qui doive rester visible en
            permanence : sans lui, des lignes manquent sans explication. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ViewSwitch params={params} />
            <RoadmapExports params={params} />
          </span>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            {hiddenCompleted > 0 && (
              <span>{t("roadmap.completedHidden", { count: String(hiddenCompleted) })}</span>
            )}
            {!params.archived && (
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
            )}
            {(archivedCount > 0 || params.archived) && (
              <Link
                href={buildRoadmapQuery(params, { archived: !params.archived })}
                aria-pressed={params.archived}
                className="rounded border border-[var(--border)] px-2 py-1 font-medium text-[var(--text)]"
                style={
                  params.archived
                    ? { backgroundColor: "var(--app-bg)" }
                    : { backgroundColor: "var(--surface)" }
                }
              >
                {params.archived
                  ? t("roadmap.backToActive")
                  : t("roadmap.showArchived", { count: String(archivedCount) })}
              </Link>
            )}
          </div>
        </div>

        {params.view === "timeline" ? (
          <>
            {/* ⚠ LES FILTRES EXISTAIENT DÉJÀ, ILS N'AVAIENT PAS DE BOUTON.
                `applyFilters` s'appliquait aux deux vues, mais les menus de
                filtre vivaient dans les en-têtes du tableau : en frise, on ne
                pouvait donc poser aucun filtre, et un filtre posé en liste
                devenait invisible une fois basculé. Les trois facettes sont
                reprises ici, sur la même mécanique d'URL. */}
            <div className="flex flex-wrap items-center gap-2">
              <ColumnHeader
                label={t("roadmap.filterByAssignee")}
                column={null}
                kind="assignees"
                options={assigneeOptions}
                params={params}
              />
              <ColumnHeader
                label={t("roadmap.status")}
                column={null}
                kind="statuses"
                options={statusOptions}
                params={params}
              />
              <ColumnHeader
                label={t("roadmap.priority")}
                column={null}
                kind="priorities"
                options={priorityOptions}
                params={params}
              />
            </div>
            <RoadmapTimeline
              groups={groupBySubject(
                sorted.filter((a) => a.timeline.kind !== null),
                subjects,
              )}
              undated={sorted.filter((a) => a.timeline.kind === null)}
              today={localToday()}
              people={personOptions}
              shortNames={shortNames}
            />
          </>
        ) : (
          /* UN SEUL TABLEAU, les sujets en lignes grises.
             Chaque sujet avait sa propre carte et son propre tableau : les
             colonnes se recalaient donc sur le contenu de chaque bloc, et
             « Status » ne tombait pas à la même abscisse d'un sujet à l'autre.
             L'œil ne pouvait plus descendre une colonne. Un tableau unique
             partage ses largeurs par construction, et l'intertitre devient une
             ligne de respiration plutôt qu'un nouveau départ.

             `overflow-visible` : les menus de filtre et d'édition débordent de
             la carte, un rognage les couperait net.

             ⚠ LE TABLEAU EST RENDU MÊME VIDE. Une liste sans résultat
             remplaçait tout l'écran par un message, en-têtes comprises : on
             perdait l'accès aux filtres au moment précis où il fallait en
             défaire un, et le seul recours était de recharger l'adresse à la
             main. Le vide est désormais une LIGNE du tableau, pas sa
             disparition — signalé le 01/10/2026. */
          <Card className="overflow-visible">
            {/* ⚠ UNE LARGEUR MINIMALE, SINON LE TABLEAU SE PLIE. Avec sept
                colonnes sur un écran de portable, « Appoint a panel for the
                complaint mechanism » se repliait sur huit lignes d'un ou deux
                mots : la ligne devenait un paragraphe, et le tableau
                illisible. `Table` offre déjà un défilement horizontal — mieux
                vaut faire glisser que lire à la verticale. */}
            <Table className="min-w-[960px]">
              <Thead>
                <Th className="w-[38%]">
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
                {groups.length === 0 && (
                  <EmptyRow colSpan={6}>
                    {actions.length === 0 ? t("roadmap.empty") : t("roadmap.emptyFiltered")}
                  </EmptyRow>
                )}
                {groups.map((group, groupIndex) => (
                  <Fragment key={group.subjectId ?? "orphans"}>
                    <tr className="group">
                      {/* ⚠ LE SUJET PORTE LE BLEU DE LA CHARTE (01/10/2026).
                          L'intertitre était ivoire sur ivoire : sur une liste
                          de quatre-vingts lignes, on ne voyait plus où un sujet
                          commençait, et le tableau se lisait à plat.

                          Le groupe des ORPHELINES garde le fond neutre : ce
                          n'est pas un sujet mais une anomalie à résorber, et
                          la peindre aux couleurs de la maison la rangerait
                          parmi les autres. Son rouge d'avertissement, en
                          prime, ne se lirait pas sur du bleu nuit. */}
                      <td
                        colSpan={6}
                        className={
                          "border-b border-t border-[var(--border)] px-3 py-1.5 " +
                          "text-xs font-semibold uppercase tracking-wide " +
                          (group.subjectId === null
                            ? "bg-[var(--app-bg)] text-[var(--text-muted)]"
                            : "")
                        }
                        style={
                          group.subjectId === null
                            ? undefined
                            : { backgroundColor: "var(--accent)", color: "var(--on-accent)" }
                        }
                      >
                        {/* Le groupe des ORPHELINES ne se renomme pas, ne se
                            déplace pas et ne se supprime pas : ce n'est pas un
                            sujet, c'est une anomalie à résorber. On dit ce qui
                            leur est arrivé plutôt que de les laisser sous un
                            intertitre muet. */}
                        {group.subjectId === null ? (
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span style={{ color: "var(--danger)" }}>
                              {t("roadmap.noSubject")}
                            </span>
                            <span className="tabular-nums">{group.actions.length}</span>
                            <span className="font-normal normal-case tracking-normal">
                              {t("roadmap.noSubjectHint")}
                            </span>
                          </span>
                        ) : (
                          <SubjectTitle
                            subjectId={group.subjectId}
                            name={group.subjectName ?? ""}
                            count={group.actions.length}
                            canMoveUp={groupIndex > 0}
                            canMoveDown={
                              groupIndex < groups.length - 1 &&
                              groups[groupIndex + 1].subjectId !== null
                            }
                          />
                        )}
                      </td>
                    </tr>
                    {group.actions.map((action) => (
                      <Tr key={action.id}>
                        {/* ⚠ LE LISERÉ EST PORTÉ PAR LA PREMIÈRE CELLULE, pas
                            par la ligne : une bordure posée sur un `<tr>` ne
                            s'affiche pas en `border-collapse`, qui est le mode
                            de tous les tableaux de l'application. */}
                        <Td
                          className={
                            action.priority === "urgent" ? "border-l-[3px]" : undefined
                          }
                          style={
                            action.priority === "urgent"
                              ? { borderLeftColor: "var(--danger)" }
                              : undefined
                          }
                        >
                          {/* ⚠ LE DÉTAIL EST DANS LA CELLULE DE L'ACTION, en
                              plus petit. Il avait eu sa propre colonne le temps
                              d'une version, pour lui donner une cible de clic ;
                              mais il complète l'intitulé, il ne lui fait pas
                              face — et une septième colonne écrasait l'action
                              elle-même. Il garde sa cible : le clic porte sur
                              la ligne de détail, pas sur le titre. */}
                          <InlineTitle actionId={action.id} value={action.title} />
                          <InlineDetail
                            actionId={action.id}
                            value={action.detail}
                            placeholder={t("roadmap.addDetail")}
                          />
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
                          <InlineAssignees
                            actionId={action.id}
                            value={action.assignees}
                            people={personOptions}
                            notSetLabel={t("roadmap.notSet")}
                            shortNames={shortNames}
                          />
                        </Td>
                        <Td align="right">
                          <ActionRowActions
                            action={action}
                            subjects={subjects}
                            people={personOptions}
                            archived={params.archived}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </Table>
            {!params.archived && (
              <div className="border-t border-[var(--border)] px-3 py-2">
                <AddSubject />
              </div>
            )}
          </Card>
        )}
      </Section>
    </div>
  );
}
