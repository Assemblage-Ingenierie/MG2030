import { getI18n } from "@/lib/i18n/server";
import { listContracts, listLots } from "@/lib/queries/referential";
import { listScenarios } from "@/lib/queries/schedule";
import { formatAmount, formatAmountRange, formatPlanDate } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
import {
  AddContractButton,
  AddLotButton,
  ContractRowEdit,
  LotRowEdit,
} from "@/components/referential/contract-row-edit";

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
  const [contracts, lots, scenarios] = await Promise.all([
    listContracts(),
    listLots(),
    listScenarios(),
  ]);

  const unassignedLots = lots.filter((l) => l.buildingCount === 0);

  const scenarioOptions = scenarios.map((s) => ({ id: s.id, code: s.code, name: s.name }));
  const contractOptions = contracts.map((c) => ({
    id: c.id,
    contractCode: c.contractCode,
    name: c.name,
  }));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section
        title={t("contracts.title")}
        description={t("contracts.intro")}
        actions={<AddContractButton scenarios={scenarioOptions} />}
      >
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
              <Th align="right">{t("common.edit")}</Th>
            </Thead>
            <tbody>
              {contracts.length === 0 && <EmptyRow colSpan={11}>{t("common.empty")}</EmptyRow>}
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
                    <Td align="right">
                      <ContractRowEdit
                        contract={{
                          id: c.id,
                          contractCode: c.contractCode,
                          contractNumber: c.contractNumber,
                          name: c.name,
                          contractType: c.contractType as
                            | "C"
                            | "W"
                            | "G"
                            | "NC"
                            | "DB",
                          competitionType: c.competitionType as "NPC" | "IPC" | null,
                          procedure: c.procedure as
                            | "REOI"
                            | "IB"
                            | "PQL+IB"
                            | "RQ"
                            | "DC",
                          selectionMethod: c.selectionMethod as
                            | "QCBS"
                            | "QBS"
                            | "FBS"
                            | "LCS"
                            | "lowest_evaluated_compliant_bid"
                            | null,
                          afdReview: c.afdReview as "prior" | "post",
                          scenarioId: c.scenarioId,
                          estimatedAmountEur: c.estimatedAmount,
                          contractor: c.contractor,
                          spnPublicationDate: c.spnPublicationDate,
                          bidOpeningDate: c.bidOpeningDate,
                          signatureDate: c.signatureDate,
                          completionDate: c.completionDate,
                        }}
                        scenarios={scenarioOptions}
                      />
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

      <Section
        title={t("lots.title")}
        description={t("lots.intro")}
        actions={<AddLotButton contracts={contractOptions} />}
      >
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
              <Th align="right">{t("common.edit")}</Th>
            </Thead>
            <tbody>
              {lots.length === 0 && <EmptyRow colSpan={8}>{t("common.empty")}</EmptyRow>}
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
                  <Td align="right">
                    <LotRowEdit
                      lot={{
                        id: l.id,
                        lotCode: l.lotCode,
                        contractId: l.contractId,
                        lotNumber: l.lotNumber,
                        name: l.name,
                        amountEurMin: l.amountMin,
                        amountEurMax: l.amountMax,
                        minTurnoverEurMin: l.turnoverMin,
                        minTurnoverEurMax: l.turnoverMax,
                        contractor: l.contractor,
                      }}
                      contracts={contractOptions}
                    />
                  </Td>
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
