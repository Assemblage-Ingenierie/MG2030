import { getI18n } from "@/lib/i18n/server";
import { isPending, listNoObjections, listNoObjectionTaskOptions } from "@/lib/queries/procurement";
import { listContracts } from "@/lib/queries/referential";
import { listScenarios } from "@/lib/queries/schedule";
import { formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
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

        <Card className="overflow-x-auto">
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
              {rows.length === 0 && <EmptyRow colSpan={8}>{t("noObjections.empty")}</EmptyRow>}
              {rows.map((r) => (
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
        </Card>

        {rows.length === 0 && <SourceNote>{t("noObjections.emptyNote")}</SourceNote>}
        {tasks.length > 0 && (
          <SourceNote>
            {t("noObjections.taskSourceNote", { count: String(tasks.length) })}
          </SourceNote>
        )}
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
