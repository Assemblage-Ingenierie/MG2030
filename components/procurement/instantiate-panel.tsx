"use client";

// ============================================================
// components/procurement/instantiate-panel.tsx — générer un planning de
// passation depuis un gabarit.
//
// PRÉVISUALISER PUIS APPLIQUER, jamais l'inverse. Une génération d'une
// douzaine de tâches qu'on découvre après coup est pénible à défaire ; la
// voir avant coûte un clic. C'est la raison d'être du moteur pur.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPlanDate } from "@/lib/i18n/format";
import {
  applyTemplate,
  previewInstantiation,
  type PreviewRow,
} from "@/app/(app)/procurement/actions";

export interface TemplateChoice {
  id: string;
  code: string;
  name: string;
  stepCount: number;
  isActive: boolean;
}

export interface ContractChoice {
  id: string;
  contractCode: string;
  name: string;
  hasAnchor: boolean;
  generatedTaskCount: number;
}

export function InstantiatePanel({
  templates,
  contracts,
  scenarioCode,
  planId,
}: {
  templates: TemplateChoice[];
  contracts: ContractChoice[];
  scenarioCode: string;
  planId: string;
}) {
  const t = useT();
  const { can } = usePermissions();

  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [contractId, setContractId] = useState(contracts[0]?.id ?? "");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [anchored, setAnchored] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; skipped: number } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!can("procurement.admin")) return null;
  if (templates.length === 0 || contracts.length === 0) return null;

  function reset() {
    setRows(null);
    setError(null);
    setDone(null);
  }

  function preview() {
    startTransition(async () => {
      reset();
      const result = await previewInstantiation(templateId, contractId, scenarioCode);
      if (!result.ok) {
        const label = t(`procurement.error_${result.error}`);
        setError(result.detail ? `${label} — ${result.detail}` : label);
        return;
      }
      setRows(result.rows);
      setAnchored(result.anchored);
    });
  }

  function apply() {
    startTransition(async () => {
      const result = await applyTemplate(templateId, contractId, scenarioCode, planId);
      if (!result.ok) {
        const label = t(`procurement.error_${result.error}`);
        setError(result.detail ? `${label} — ${result.detail}` : label);
        return;
      }
      setRows(null);
      setDone({ created: result.created ?? 0, skipped: result.skipped ?? 0 });
    });
  }

  const newRows = rows?.filter((r) => !r.alreadyExists) ?? [];
  const skipped = (rows?.length ?? 0) - newRows.length;
  const contract = contracts.find((c) => c.id === contractId) ?? null;

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        {t("procurement.generate")}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={t("common.close")}
        title={t("procurement.generateTitle")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[var(--text-muted)]">{t("procurement.generateIntro")}</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("procurement.template")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={templateId}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  reset();
                }}
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.code} — {tpl.name}
                    {tpl.isActive ? "" : ` (${t("procurement.inactive")})`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t("procurement.contract")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={contractId}
                onChange={(e) => {
                  setContractId(e.target.value);
                  reset();
                }}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractCode} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Un marché qui porte déjà des tâches : on le dit AVANT, pas après. */}
          {contract && contract.generatedTaskCount > 0 && (
            <p className="text-xs" style={{ color: "var(--accent-2)" }}>
              {t("procurement.contractHasTasks", {
                count: String(contract.generatedTaskCount),
              })}
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          {done && (
            <p className="text-sm" style={{ color: "var(--accent)" }}>
              {t("procurement.applied", {
                created: String(done.created),
                skipped: String(done.skipped),
              })}
            </p>
          )}

          {rows !== null && (
            <div className="flex flex-col gap-2">
              {/* Sans jalon contractuel, les dates viennent d'un repli sur
                  aujourd'hui. Le taire produirait un planning faux d'apparence
                  crédible — c'est exactement ce qu'il faut éviter. */}
              {!anchored && (
                <p
                  className="rounded-md px-3 py-2 text-xs"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--accent-2) 12%, transparent)",
                    color: "var(--accent-2)",
                  }}
                >
                  {t("procurement.noAnchorWarning")}
                </p>
              )}

              <div className="max-h-80 overflow-y-auto rounded-md border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--app-bg)]">
                    <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                      <th className="px-2 py-1 font-semibold">{t("schedule.wbs")}</th>
                      <th className="px-2 py-1 font-semibold">{t("schedule.activity")}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t("schedule.duration")}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t("schedule.start")}</th>
                      <th className="px-2 py-1 text-right font-semibold">{t("schedule.end")}</th>
                      <th className="px-2 py-1 font-semibold">{t("procurement.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.wbsCode}
                        className="border-t border-[var(--border)]"
                        style={r.alreadyExists ? { opacity: 0.45 } : undefined}
                      >
                        <td className="px-2 py-1 font-mono text-xs">{r.wbsCode}</td>
                        <td className="px-2 py-1">{r.activity}</td>
                        <td className="px-2 py-1 text-right tabular-nums">{r.durationDays}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatPlanDate(r.previewStart)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatPlanDate(r.previewEnd)}
                        </td>
                        <td className="px-2 py-1">
                          <span className="flex flex-wrap gap-1">
                            {r.alreadyExists && (
                              <Badge tone="upcoming">{t("procurement.willSkip")}</Badge>
                            )}
                            {r.anchored && (
                              <Badge tone="running">{t("procurement.anchoredOnContract")}</Badge>
                            )}
                            {r.createsNoObjection && (
                              <Badge tone="late">{t("procurement.createsNon")}</Badge>
                            )}
                            {/* Écart entre le plan de passation et l'enchaînement
                                des durées (GAPS 13). L'ancre fait foi, mais
                                l'écart se montre — il ne s'absorbe pas. */}
                            {r.conflictDays > 0 && (
                              <span
                                className="text-[11px] font-medium"
                                style={{ color: "var(--danger)" }}
                                title={t("procurement.conflictTooltip")}
                              >
                                {t("procurement.overlap", { days: String(r.conflictDays) })}
                              </span>
                            )}
                            {r.slackDays > 0 && (
                              <span
                                className="text-[11px] text-[var(--text-muted)]"
                                title={t("procurement.slackTooltip")}
                              >
                                {t("procurement.slack", { days: String(r.slackDays) })}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {newRows.some((r) => r.conflictDays > 0) && (
                <p
                  className="rounded-md px-3 py-2 text-xs"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                    color: "var(--danger)",
                  }}
                >
                  {t("procurement.conflictWarning", {
                    count: String(newRows.filter((r) => r.conflictDays > 0).length),
                  })}
                </p>
              )}

              <p className="text-xs text-[var(--text-muted)]">
                {t("procurement.previewSummary", {
                  create: String(newRows.length),
                  skip: String(skipped),
                  nons: String(newRows.filter((r) => r.createsNoObjection).length),
                })}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.close")}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={preview}>
              {pending ? t("common.loading") : t("procurement.preview")}
            </Button>
            {/* Appliquer n'est offert QU'APRÈS prévisualisation, et seulement
                s'il reste quelque chose à créer. */}
            <Button
              variant="primary"
              disabled={pending || rows === null || newRows.length === 0}
              onClick={apply}
            >
              {t("procurement.apply")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
