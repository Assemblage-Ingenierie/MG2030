import { getI18n } from "@/lib/i18n/server";
import { listContracts, listLots } from "@/lib/queries/referential";
import { formatAmount, formatAmountRange, formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";

/**
 * Marchés et lots.
 *
 * Deux particularités du projet, visibles à l'écran :
 *   • un marché en gré à gré n'a ni publication ni ouverture des plis. Ce n'est
 *     PAS une donnée manquante : on l'affiche « sans objet » (GAPS 6) ;
 *   • un lot dont les bâtiments ne sont pas affectés le dit explicitement,
 *     plutôt que d'afficher un zéro qui se lirait comme « aucun bâtiment ».
 */
export default async function ContractsPage() {
  const { t, locale } = await getI18n();
  const [contracts, lots] = await Promise.all([listContracts(), listLots()]);

  const lotsByContract = new Map<string, typeof lots>();
  for (const lot of lots) {
    const list = lotsByContract.get(lot.contractCode);
    if (list) list.push(lot);
    else lotsByContract.set(lot.contractCode, [lot]);
  }

  const unassignedLots = lots.filter((l) => l.buildingCount === 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section title={t("contracts.title")} description={t("contracts.intro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("contracts.code")}</Th>
              <Th>{t("contracts.name")}</Th>
              <Th align="center">{t("contracts.type")}</Th>
              <Th align="center">{t("contracts.procedure")}</Th>
              <Th align="center">{t("contracts.scenario")}</Th>
              <Th align="right">{t("contracts.estimate")}</Th>
              <Th align="right">{t("contracts.publication")}</Th>
              <Th align="right">{t("contracts.opening")}</Th>
              <Th align="right">{t("contracts.signature")}</Th>
              <Th align="right">{t("contracts.completion")}</Th>
            </Thead>
            <tbody>
              {contracts.length === 0 && <EmptyRow colSpan={10}>{t("common.empty")}</EmptyRow>}
              {contracts.map((c) => {
                // Gré à gré : l'absence d'avis est une conséquence de la
                // procédure, pas un trou dans les données.
                const directContracting = c.procedure === "DC";
                return (
                  <Tr key={c.id}>
                    <Td className="font-medium whitespace-nowrap">{c.contractCode}</Td>
                    <Td>
                      <span className="block">{c.name}</span>
                      <span className="block font-mono text-[11px] text-[var(--text-muted)]">
                        {c.contractNumber}
                      </span>
                    </Td>
                    <Td align="center">
                      <Chip>{c.contractType}</Chip>
                    </Td>
                    <Td align="center">
                      <Chip>{c.procedure}</Chip>
                    </Td>
                    <Td align="center" className="text-xs text-[var(--text-muted)]">
                      {c.scenarioCode}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {c.estimatedAmount === null ? (
                        <span className="text-[var(--text-muted)]">TBD</span>
                      ) : (
                        formatAmount(c.estimatedAmount, locale, { compact: true })
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {directContracting && !c.spnPublicationDate ? (
                        <span
                          className="text-[var(--text-muted)]"
                          title={t("contracts.notApplicableDirect")}
                        >
                          {t("common.notApplicable")}
                        </span>
                      ) : (
                        formatPlanDate(c.spnPublicationDate)
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {directContracting && !c.bidOpeningDate ? (
                        <span
                          className="text-[var(--text-muted)]"
                          title={t("contracts.notApplicableDirect")}
                        >
                          {t("common.notApplicable")}
                        </span>
                      ) : (
                        formatPlanDate(c.bidOpeningDate)
                      )}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPlanDate(c.signatureDate)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {formatPlanDate(c.completionDate)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        <SourceNote>{t("contracts.numberNote")}</SourceNote>
        <SourceNote>{t("contracts.estimateNote")}</SourceNote>
      </Section>

      <Section title={t("lots.title")} description={t("lots.intro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("lots.code")}</Th>
              <Th>{t("lots.name")}</Th>
              <Th>{t("lots.contract")}</Th>
              <Th align="right">{t("lots.amount")}</Th>
              <Th align="right">{t("lots.turnover")}</Th>
              <Th align="right">{t("lots.buildings")}</Th>
              <Th>{t("lots.contractor")}</Th>
            </Thead>
            <tbody>
              {lots.length === 0 && <EmptyRow colSpan={7}>{t("common.empty")}</EmptyRow>}
              {lots.map((l) => (
                <Tr key={l.id}>
                  <Td className="font-medium whitespace-nowrap">{l.lotCode}</Td>
                  <Td>{l.name}</Td>
                  <Td className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                    {l.contractCode}
                  </Td>
                  <Td align="right" className="tabular-nums whitespace-nowrap">
                    {formatAmountRange(l.amountMin, l.amountMax, locale)}
                  </Td>
                  <Td align="right" className="tabular-nums whitespace-nowrap">
                    {formatAmountRange(l.turnoverMin, l.turnoverMax, locale)}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {l.buildingCount > 0 ? (
                      l.buildingCount
                    ) : (
                      /* Zéro bâtiment se lirait comme « lot vide ». Ici la
                         composition n'est simplement pas arrêtée. */
                      <span
                        className="text-xs text-[var(--text-muted)]"
                        title={t("lots.unassignedNote")}
                      >
                        {t("lots.unassigned")}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[var(--text-muted)]">{l.contractor ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {unassignedLots.length > 0 && <SourceNote>{t("lots.unassignedNote")}</SourceNote>}
      </Section>
    </div>
  );
}
