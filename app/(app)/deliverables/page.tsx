import { getI18n } from "@/lib/i18n/server";
import { contractHealth, listDeliverables } from "@/lib/queries/deliverables";
import { formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";

/**
 * Livrables et retards.
 *
 * Le registre est VIDE au chargement : aucun livrable n'est dans les sources
 * (docs/SCHEMA.md §12). La page est donc conçue pour être utile vide — elle
 * montre l'état par marché plutôt qu'un tableau blanc.
 */
export default async function DeliverablesPage() {
  const { t } = await getI18n();
  const [deliverables, health] = await Promise.all([listDeliverables(), contractHealth()]);

  const late = deliverables.filter((d) => d.isLate);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Section title={t("deliverables.title")} description={t("deliverables.intro")}>
        {late.length > 0 && (
          <Card
            className="p-4"
            style={{
              borderColor: "var(--danger)",
              backgroundColor: "color-mix(in srgb, var(--danger) 6%, transparent)",
            }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
              {t("deliverables.lateCount", { count: String(late.length) })}
            </p>
          </Card>
        )}

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("deliverables.deliverable")}</Th>
              <Th>{t("deliverables.issuer")}</Th>
              <Th>{t("deliverables.contract")}</Th>
              <Th align="right">{t("deliverables.due")}</Th>
              <Th align="right">{t("deliverables.submitted")}</Th>
              <Th align="center">{t("deliverables.status")}</Th>
              <Th>{t("deliverables.visa")}</Th>
            </Thead>
            <tbody>
              {deliverables.length === 0 && (
                <EmptyRow colSpan={7}>{t("deliverables.emptyRegister")}</EmptyRow>
              )}
              {deliverables.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium">{d.title}</Td>
                  {/* L'émetteur est un TEXTE : ni les consultants ni les
                      entreprises ne sont utilisateurs de la plateforme. */}
                  <Td className="text-sm text-[var(--text-muted)]">{d.issuer ?? "—"}</Td>
                  <Td className="text-xs text-[var(--text-muted)]">
                    {d.contractCode ?? d.lotCode ?? "—"}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPlanDate(d.contractualDate)}
                    {d.daysToDue !== null && d.daysToDue >= 0 && d.daysToDue <= 14 && (
                      <span className="ml-1 text-[11px]" style={{ color: "var(--accent-2)" }}>
                        {t("deliverables.inDays", { days: String(d.daysToDue) })}
                      </span>
                    )}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {formatPlanDate(d.actualSubmissionDate)}
                  </Td>
                  <Td align="center">
                    {d.isLate ? (
                      <Badge tone="late">{t("deliverables.late")}</Badge>
                    ) : d.status === "approved" || d.status === "approved_with_comments" ? (
                      <Badge tone="done">{t(`deliverables.${d.status}`)}</Badge>
                    ) : d.status === "expected" ? (
                      <Badge tone="upcoming">{t("deliverables.expected")}</Badge>
                    ) : (
                      <Badge tone="running">{t(`deliverables.${d.status}`)}</Badge>
                    )}
                    {/* Un retard résorbé reste visible : c'est un fait de
                        gestion, pas un incident à effacer une fois réglé. */}
                    {d.wasLate && (
                      <span
                        className="ml-1 text-[11px] text-[var(--text-muted)]"
                        title={t("deliverables.wasLateNote")}
                      >
                        {t("deliverables.wasLate")}
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-[var(--text-muted)]">
                    {d.visaByName ? `${d.visaByName} · ${formatPlanDate(d.visaDate)}` : "—"}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {deliverables.length === 0 && <SourceNote>{t("deliverables.emptyNote")}</SourceNote>}
      </Section>

      <Section title={t("deliverables.byContract")} description={t("deliverables.byContractIntro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("deliverables.contract")}</Th>
              <Th align="right">{t("deliverables.open")}</Th>
              <Th align="right">{t("deliverables.late")}</Th>
              <Th align="right">{t("deliverables.pendingNon")}</Th>
              <Th align="right">{t("deliverables.nextDue")}</Th>
            </Thead>
            <tbody>
              {health.length === 0 && <EmptyRow colSpan={5}>{t("common.empty")}</EmptyRow>}
              {health.map((h) => (
                <Tr key={h.contractCode}>
                  <Td>
                    <Chip>{h.contractCode}</Chip>
                    <span className="ml-2 text-sm">{h.contractName}</span>
                  </Td>
                  <Td align="right" className="tabular-nums">{h.deliverablesOpen}</Td>
                  <Td
                    align="right"
                    className="tabular-nums font-medium"
                    style={h.deliverablesLate > 0 ? { color: "var(--danger)" } : undefined}
                  >
                    {h.deliverablesLate}
                  </Td>
                  <Td align="right" className="tabular-nums">{h.noObjectionsPending}</Td>
                  <Td align="right" className="tabular-nums">{formatPlanDate(h.nextDue)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
