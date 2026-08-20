import { getI18n } from "@/lib/i18n/server";
import { listContractAnchors, listTemplates } from "@/lib/queries/procurement";
import { listScenarios, loadSchedule } from "@/lib/queries/schedule";
import { Card, Section } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
import {
  StepTable,
  TemplateRowActions,
  TemplateToolbar,
} from "@/components/procurement/template-editor";
import { InstantiatePanel } from "@/components/procurement/instantiate-panel";

/**
 * GABARITS DE PASSATION.
 *
 * « Créer un contrat instancie le gabarit et génère les tâches associées »
 * (brief §7). Le moteur existait et était testé ; il n'avait aucun écran pour
 * l'appeler, donc la fonction n'existait pas pour la PIU.
 *
 * AUCUN GABARIT N'EST UNE DONNÉE PROJET (GAPS 10) : les sources n'en
 * contiennent pas. Les deux séquences proposées ont leurs durées RELEVÉES sur
 * les chaînes réelles du planning — C-TV-DD pour la sélection de consultant,
 * TV.3.1 pour l'appel d'offres travaux. Elles sont donc créées INACTIVES, et
 * l'écran le répète : une durée relevée n'est pas une durée validée.
 */
export default async function ProcurementPage() {
  const { t } = await getI18n();

  const scenarios = await listScenarios();
  const active =
    scenarios.find((s) => s.isActive && s.isSchedulable) ??
    scenarios.find((s) => s.isSchedulable) ??
    null;

  const [templates, contracts, schedule] = await Promise.all([
    listTemplates(),
    listContractAnchors(),
    active ? loadSchedule(active.code, scenarios) : Promise.resolve(null),
  ]);

  // Le plan d'accueil des tâches générées : celui du scénario affiché.
  const planId = schedule?.tasks[0]?.planId ?? "";
  const hasObserved = templates.some((tpl) => tpl.code.startsWith("OBS-"));

  const canGenerate = active !== null && planId !== "" && templates.length > 0;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Section
        title={t("procurement.title")}
        description={t("procurement.intro")}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {canGenerate && (
              <InstantiatePanel
                scenarioCode={active.code}
                planId={planId}
                templates={templates.map((tpl) => ({
                  id: tpl.id,
                  code: tpl.code,
                  name: tpl.name,
                  stepCount: tpl.steps.length,
                  isActive: tpl.isActive,
                }))}
                contracts={contracts.map((c) => ({
                  id: c.id,
                  contractCode: c.contractCode,
                  name: c.name,
                  hasAnchor:
                    c.spnPublicationDate !== null ||
                    c.bidOpeningDate !== null ||
                    c.signatureDate !== null ||
                    c.completionDate !== null,
                  generatedTaskCount: c.generatedTaskCount,
                }))}
              />
            )}
            <TemplateToolbar hasObserved={hasObserved} />
          </span>
        }
      >
        {templates.length === 0 && (
          <>
            <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
              {t("procurement.empty")}
            </Card>
            <SourceNote>{t("procurement.emptyNote")}</SourceNote>
          </>
        )}

        {templates.map((tpl) => (
          <Card key={tpl.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <Chip>{tpl.code}</Chip>
              <span className="font-medium text-[var(--text)]">{tpl.name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {t("procurement.procedure")} {tpl.procedure}
                {tpl.contractType ? ` · ${tpl.contractType}` : ""}
                {tpl.selectionMethod ? ` · ${tpl.selectionMethod}` : ""}
              </span>
              {!tpl.isActive && (
                <span className="text-xs font-medium" style={{ color: "var(--accent-2)" }}>
                  {t("procurement.inactive")}
                </span>
              )}
              <span className="ml-auto flex items-center gap-3">
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  {t("procurement.totalDays", {
                    steps: String(tpl.steps.length),
                    days: String(tpl.totalDays),
                  })}
                </span>
                <TemplateRowActions
                  template={{
                    id: tpl.id,
                    code: tpl.code,
                    name: tpl.name,
                    procedure: tpl.procedure,
                    contractType: tpl.contractType,
                    selectionMethod: tpl.selectionMethod,
                    description: tpl.description,
                    isActive: tpl.isActive,
                  }}
                />
              </span>
            </div>

            {tpl.description && (
              <p className="text-xs text-[var(--text-muted)]">{tpl.description}</p>
            )}

            <StepTable
              templateId={tpl.id}
              steps={tpl.steps.map((s) => ({
                id: s.id,
                stepNo: s.stepNo,
                name: s.name,
                defaultDurationDays: s.defaultDurationDays,
                isAfdNoObjection: s.isAfdNoObjection,
                contractDateAnchor: s.contractDateAnchor,
              }))}
            />
          </Card>
        ))}
      </Section>

      {/* Les jalons contractuels décident des dates générées : les montrer ici
          évite d'ouvrir la fiche marché pour comprendre une prévisualisation. */}
      <Section title={t("procurement.anchorsTitle")} description={t("procurement.anchorsIntro")}>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                <th className="px-3 py-2 font-semibold">{t("procurement.contract")}</th>
                <th className="px-3 py-2 font-semibold">{t("procurement.anchor_spn_publication_date")}</th>
                <th className="px-3 py-2 font-semibold">{t("procurement.anchor_bid_opening_date")}</th>
                <th className="px-3 py-2 font-semibold">{t("procurement.anchor_signature_date")}</th>
                <th className="px-3 py-2 font-semibold">{t("procurement.anchor_completion_date")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("procurement.existingTasks")}</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)]">
                  <td className="px-3 py-2">
                    <Chip>{c.contractCode}</Chip>
                    <span className="ml-2 text-[var(--text-muted)]">{c.name}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.spnPublicationDate ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.bidOpeningDate ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.signatureDate ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{c.completionDate ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.generatedTaskCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
