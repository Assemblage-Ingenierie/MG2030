import { getI18n } from "@/lib/i18n/server";
import {
  listBuildingChoices,
  listContracts,
  listLotBuildings,
  listLots,
} from "@/lib/queries/referential";
import { listScenarios } from "@/lib/queries/schedule";
import { Section } from "@/components/ui/card";
import { SourceNote } from "@/components/referential/source-note";
import { AddContractButton, AddLotButton } from "@/components/referential/contract-row-edit";
import { ContractTable } from "@/components/referential/contract-table";

/**
 * Marchés et lots.
 *
 * UN SEUL TABLEAU, les lots sous leur marché. Deux tableaux séparés
 * obligeaient à retrouver « DB-SC » d'une liste à l'autre pour savoir ce que
 * contenait un marché.
 *
 * Deux particularités du projet, visibles à l'écran :
 *   • un marché en gré à gré n'a ni publication ni ouverture des plis. Ce n'est
 *     PAS une donnée manquante : on l'affiche « sans objet » (GAPS 6) ;
 *   • un lot dont les bâtiments ne sont pas affectés le dit explicitement,
 *     plutôt que d'afficher un zéro qui se lirait comme « aucun bâtiment ».
 */
export default async function ContractsPage() {
  const { t, locale } = await getI18n();
  const [contracts, lots, scenarios, buildings, assignments] = await Promise.all([
    listContracts(),
    listLots(),
    listScenarios(),
    listBuildingChoices(),
    listLotBuildings(),
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
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <AddLotButton contracts={contractOptions} />
            <AddContractButton scenarios={scenarioOptions} />
          </span>
        }
      >
        <ContractTable
          contracts={contracts.map((c) => ({
            id: c.id,
            contractCode: c.contractCode,
            contractNumber: c.contractNumber,
            name: c.name,
            contractType: c.contractType,
            competitionType: c.competitionType,
            procedure: c.procedure,
            selectionMethod: c.selectionMethod,
            afdReview: c.afdReview,
            scenarioId: c.scenarioId,
            scenarioCode: c.scenarioCode,
            estimatedAmount: c.estimatedAmount,
            contractor: c.contractor,
            spnPublicationDate: c.spnPublicationDate,
            bidOpeningDate: c.bidOpeningDate,
            signatureDate: c.signatureDate,
            completionDate: c.completionDate,
          }))}
          lots={lots.map((l) => ({
            id: l.id,
            lotCode: l.lotCode,
            lotNumber: l.lotNumber,
            name: l.name,
            contractId: l.contractId,
            contractCode: l.contractCode,
            amountMin: l.amountMin,
            amountMax: l.amountMax,
            turnoverMin: l.turnoverMin,
            turnoverMax: l.turnoverMax,
            contractor: l.contractor,
            buildingCount: l.buildingCount,
          }))}
          scenarios={scenarioOptions}
          locale={locale}
          buildings={buildings}
          assignments={assignments}
        />

        <SourceNote>{t("contracts.numberNote")}</SourceNote>
        <SourceNote>{t("contracts.estimateNote")}</SourceNote>
        {unassignedLots.length > 0 && (
          <SourceNote>
            {t("lots.unassignedSummary", { count: String(unassignedLots.length) })}
          </SourceNote>
        )}
      </Section>

    </div>
  );
}
