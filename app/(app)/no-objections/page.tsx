import { getI18n } from "@/lib/i18n/server";
import { isPending, listNoObjections, listNoObjectionTaskOptions } from "@/lib/queries/procurement";
import { listContracts } from "@/lib/queries/referential";
import { listScenarios } from "@/lib/queries/schedule";
import { formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip } from "@/components/ui/badge";
import {
  AddNoObjectionButton,
  NoObjectionRowActions,
} from "@/components/procurement/no-objection-form";

/**
 * AVIS DE NON-OBJECTION AFD.
 *
 * Point de passage obligé de la passation : sans avis, rien ne se signe. Le
 * planning le sait et porte des tâches dédiées (« AFD's NoN », TV.2.3, SC.2.4).
 *
 * Le parti pris de cet écran : LE RETARD SE MESURE CONTRE LA DURÉE PRÉVUE AU
 * PLAN pour la tâche que l'avis porte — jamais contre un délai standard
 * inventé. Un avis sans tâche liée affiche donc son temps écoulé et rien de
 * plus. Écrire « en retard » sans référence serait donner une opinion pour un
 * fait, dans un document que la PIU transmet à l'AFD.
 */
export default async function NoObjectionsPage() {
  const { t } = await getI18n();

  const scenarios = await listScenarios();
  const active =
    scenarios.find((s) => s.isActive && s.isSchedulable) ??
    scenarios.find((s) => s.isSchedulable) ??
    null;

  const [rows, contracts, tasks] = await Promise.all([
    listNoObjections(),
    listContracts(),
    active ? listNoObjectionTaskOptions(active.code) : Promise.resolve([]),
  ]);

  const contractOptions = contracts.map((c) => ({
    id: c.id,
    code: c.contractCode,
    name: c.name,
  }));

  const awaiting = rows.filter((r) => isPending(r.status));
  const overdue = rows.filter((r) => (r.overdueDays ?? 0) > 0);

  // Délai réel constaté, une fois les avis rendus. C'est le seul chiffre qui
  // permette d'argumenter auprès de l'AFD, et il ne vaut qu'une fois observé.
  const answered = rows.filter((r) => r.turnaroundDays !== null);
  const meanTurnaround =
    answered.length === 0
      ? null
      : Math.round(
          answered.reduce((sum, r) => sum + (r.turnaroundDays ?? 0), 0) / answered.length,
        );

  // Regroupement par contrat, dans l'ordre des codes ; les avis sans contrat
  // (le plan de passation lui-même, par exemple) ferment la liste.
  const nameByCode = new Map(contracts.map((c) => [c.contractCode, c.name]));
  const byContract = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.contractCode ?? "";
    byContract.set(key, [...(byContract.get(key) ?? []), r]);
  }
  const groups = [...byContract.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([code, groupRows]) => ({
      key: code || "none",
      code: code || null,
      name: code ? nameByCode.get(code) ?? code : null,
      rows: groupRows,
      awaiting: groupRows.filter((r) => isPending(r.status)).length,
      overdue: groupRows.filter((r) => (r.overdueDays ?? 0) > 0).length,
    }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section
        title={t("noObjections.title")}
        description={t("noObjections.intro")}
        actions={<AddNoObjectionButton contracts={contractOptions} tasks={tasks} />}
      >
        {/* Les trois chiffres que la PIU regarde avant tout le reste. */}
        <Card className="flex flex-wrap items-center gap-x-8 gap-y-2 p-3 text-sm">
          <Stat label={t("noObjections.awaiting")} value={String(awaiting.length)} />
          <Stat
            label={t("noObjections.overdue")}
            value={String(overdue.length)}
            tone={overdue.length > 0 ? "var(--danger)" : undefined}
          />
          <Stat
            label={t("noObjections.meanTurnaround")}
            value={
              meanTurnaround === null
                ? "—"
                : t("noObjections.daysShort", { days: String(meanTurnaround) })
            }
          />
        </Card>

        {rows.length === 0 && (
          <Card className="overflow-x-auto">
            <Table>
              <tbody>
                <EmptyRow colSpan={8}>{t("noObjections.empty")}</EmptyRow>
              </tbody>
            </Table>
          </Card>
        )}

        {/* UN MENU DÉROULANT PAR CONTRAT. `<details>` natif : dépliable sans
            une ligne de JavaScript, et l'écran reste un Server Component. Le
            résumé de chaque groupe porte ce qu'on y cherche d'abord — combien
            d'avis attendent, combien dépassent — pour savoir lequel ouvrir. */}
        {groups.map((group) => (
          <details
            key={group.key}
            className="group overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[var(--app-bg)]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
                className="shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-90"
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {group.code ? <Chip>{group.code}</Chip> : null}
              <span className="min-w-0 truncate text-sm font-semibold text-[var(--text)]">
                {group.name ?? t("noObjections.noContract")}
              </span>
              <span className="ml-auto flex shrink-0 items-center gap-3 text-xs text-[var(--text-muted)]">
                <span>{t("noObjections.groupCount", { count: String(group.rows.length) })}</span>
                {group.awaiting > 0 && (
                  <span>{t("noObjections.groupAwaiting", { count: String(group.awaiting) })}</span>
                )}
                {group.overdue > 0 && (
                  <span className="font-medium" style={{ color: "var(--danger)" }}>
                    {t("noObjections.groupOverdue", { count: String(group.overdue) })}
                  </span>
                )}
              </span>
            </summary>
            <div className="overflow-x-auto border-t border-[var(--border)]">
          <Table>
            <Thead>
              <Th>{t("noObjections.subject")}</Th>
              <Th>{t("noObjections.reference")}</Th>
              <Th>{t("noObjections.target")}</Th>
              <Th align="center">{t("noObjections.status")}</Th>
              <Th align="right">{t("noObjections.sentDate")}</Th>
              <Th align="right">{t("noObjections.elapsed")}</Th>
              <Th align="right">{t("noObjections.responseDate")}</Th>
              <Th align="right">{t("common.actions")}</Th>
            </Thead>
            <tbody>
              {group.rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">
                    {r.subject}
                    {r.comments && (
                      <span className="mt-0.5 block text-xs font-normal text-[var(--text-muted)]">
                        {r.comments}
                      </span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs text-[var(--text-muted)]">
                    {r.reference ?? "—"}
                  </Td>
                  <Td className="text-xs">
                    {r.contractCode && <Chip>{r.contractCode}</Chip>}
                    {r.lotCode && <Chip>{r.lotCode}</Chip>}
                    {r.taskWbs && (
                      <span className="ml-1 font-mono text-[var(--text-muted)]">{r.taskWbs}</span>
                    )}
                    {!r.contractCode && !r.lotCode && !r.taskWbs && "—"}
                  </Td>
                  <Td align="center">
                    <Badge tone={tone(r.status)}>{t(`noObjections.status_${r.status}`)}</Badge>
                  </Td>
                  <Td align="right" className="tabular-nums">{formatPlanDate(r.sentDate)}</Td>
                  <Td align="right" className="tabular-nums">
                    {r.elapsedDays === null ? (
                      "—"
                    ) : (
                      <>
                        {t("noObjections.daysShort", { days: String(r.elapsedDays) })}
                        {/* Le dépassement n'est affirmé QUE si une tâche fournit
                            la durée prévue. Sinon : temps écoulé, sans verdict. */}
                        {r.overdueDays !== null && r.overdueDays > 0 && (
                          <span
                            className="ml-1 text-[11px] font-medium"
                            style={{ color: "var(--danger)" }}
                            title={t("noObjections.overdueTooltip", {
                              allowed: String(r.allowedDays ?? 0),
                              wbs: r.taskWbs ?? "",
                            })}
                          >
                            +{r.overdueDays}
                          </span>
                        )}
                        {r.overdueDays === null && isPending(r.status) && (
                          <span
                            className="ml-1 text-[11px] text-[var(--text-muted)]"
                            title={t("noObjections.noReferenceTooltip")}
                          >
                            ?
                          </span>
                        )}
                      </>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPlanDate(r.responseDate)}
                    {r.turnaroundDays !== null && (
                      <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                        {t("noObjections.daysShort", { days: String(r.turnaroundDays) })}
                      </span>
                    )}
                  </Td>
                  <Td align="right">
                    <NoObjectionRowActions
                      contracts={contractOptions}
                      tasks={tasks}
                      row={{
                        id: r.id,
                        status: r.status,
                        reference: r.reference,
                        subject: r.subject,
                        contractId: r.contractId,
                        lotId: r.lotId,
                        taskId: r.taskId,
                        sentDate: r.sentDate,
                        comments: r.comments,
                      }}
                    />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
            </div>
          </details>
        ))}
      </Section>
    </div>
  );
}

function tone(status: string): "done" | "late" | "running" | "upcoming" {
  switch (status) {
    case "no_objection":
      return "done";
    case "rejected":
      return "late";
    case "sent":
    case "no_objection_with_comments":
      return "running";
    default:
      return "upcoming";
  }
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">{label}</span>
      <span className="text-lg font-semibold tabular-nums" style={tone ? { color: tone } : undefined}>
        {value}
      </span>
    </span>
  );
}
