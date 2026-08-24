"use client";

// ============================================================
// components/referential/contract-table.tsx — marchés et leurs lots.
//
// UN SEUL TABLEAU, les lots sous leur marché. Deux tableaux séparés
// obligeaient à retrouver « DB-SC » d'une liste à l'autre pour savoir ce que
// contenait un marché ; la colonne « marché » de la table des lots ne faisait
// que compenser cette séparation.
//
// Les filtres portent sur les COLONNES et se combinent. Un marché retenu
// entraîne ses lots : filtrer par type de marché ne doit pas décapiter le lot
// de son parent.
// ============================================================

import { useMemo, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatAmount, formatAmountRange, formatPlanDate } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { ContractRowEdit, LotRowEdit } from "./contract-row-edit";

export interface ContractView {
  id: string;
  contractCode: string;
  contractNumber: string;
  name: string;
  contractType: string;
  competitionType: string | null;
  procedure: string;
  selectionMethod: string | null;
  afdReview: string;
  scenarioId: string;
  scenarioCode: string;
  estimatedAmount: number | null;
  contractor: string | null;
  spnPublicationDate: string | null;
  bidOpeningDate: string | null;
  signatureDate: string | null;
  completionDate: string | null;
}

export interface LotView {
  id: string;
  lotCode: string;
  lotNumber: number;
  name: string;
  contractId: string;
  contractCode: string;
  amountMin: number | null;
  amountMax: number | null;
  turnoverMin: number | null;
  turnoverMax: number | null;
  contractor: string | null;
  buildingCount: number;
}

export interface ScenarioOption {
  id: string;
  code: string;
  name: string;
}

interface Filters {
  text: string;
  type: string;
  procedure: string;
  scenario: string;
}

const EMPTY: Filters = { text: "", type: "", procedure: "", scenario: "" };

export function ContractTable({
  contracts,
  lots,
  scenarios,
  locale,
}: {
  contracts: ContractView[];
  lots: LotView[];
  scenarios: ScenarioOption[];
  locale: "en" | "sq";
}) {
  const contractOptions = useMemo(
    () => contracts.map((c) => ({ id: c.id, contractCode: c.contractCode, name: c.name })),
    [contracts],
  );
  const t = useT();
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const lotsByContract = useMemo(() => {
    const map = new Map<string, LotView[]>();
    for (const lot of lots) {
      const list = map.get(lot.contractId);
      if (list) list.push(lot);
      else map.set(lot.contractId, [lot]);
    }
    for (const list of map.values()) list.sort((a, b) => a.lotNumber - b.lotNumber);
    return map;
  }, [lots]);

  const types = useMemo(
    () => [...new Set(contracts.map((c) => c.contractType))].sort(),
    [contracts],
  );
  const procedures = useMemo(
    () => [...new Set(contracts.map((c) => c.procedure))].sort(),
    [contracts],
  );

  const visible = useMemo(() => {
    const needle = filters.text.trim().toLowerCase();
    return contracts.filter((c) => {
      if (filters.type && c.contractType !== filters.type) return false;
      if (filters.procedure && c.procedure !== filters.procedure) return false;
      if (filters.scenario && c.scenarioCode !== filters.scenario) return false;
      if (needle === "") return true;

      // La recherche libre porte AUSSI sur les lots : chercher « Lot 3 » doit
      // ramener le marché qui le contient, sinon on ne le trouve nulle part.
      const own = [c.contractCode, c.contractNumber, c.name, c.contractor ?? ""]
        .join(" ")
        .toLowerCase();
      if (own.includes(needle)) return true;
      return (lotsByContract.get(c.id) ?? []).some((lot) =>
        `${lot.lotCode} ${lot.name} ${lot.contractor ?? ""}`.toLowerCase().includes(needle),
      );
    });
  }, [contracts, filters, lotsByContract]);

  const toggle = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const active = Object.values(filters).some((value) => value !== "");
  const shownLots = visible.reduce(
    (sum, c) => sum + (collapsed.has(c.id) ? 0 : (lotsByContract.get(c.id) ?? []).length),
    0,
  );

  const head =
    "border-b border-[var(--border)] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  const cell = "border-b border-[var(--border)] px-3 py-2 align-top";
  const filterInput = "h-7 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-xs";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--text-muted)]">
          {t("contracts.shownCount", {
            contracts: String(visible.length),
            total: String(contracts.length),
            lots: String(shownLots),
          })}
        </span>
        <span className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant="quiet"
            onClick={() => setCollapsed(new Set(contracts.map((c) => c.id)))}
          >
            {t("schedule.collapseAll")}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setCollapsed(new Set())}>
            {t("schedule.expandAll")}
          </Button>
          {active && (
            <Button size="sm" variant="secondary" onClick={() => setFilters(EMPTY)}>
              {t("contracts.clearFilters")}
            </Button>
          )}
        </span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr>
              <th className={head} style={{ width: 190 }}>{t("contracts.code")}</th>
              <th className={head}>{t("contracts.name")}</th>
              <th className={head} style={{ width: 70 }}>{t("contracts.type")}</th>
              <th className={head} style={{ width: 90 }}>{t("contracts.procedure")}</th>
              <th className={head} style={{ width: 110 }}>{t("contracts.scenario")}</th>
              <th className={cn(head, "text-right")} style={{ width: 110 }}>
                {t("contracts.estimate")}
              </th>
              <th className={cn(head, "text-right")} style={{ width: 100 }}>
                {t("contracts.publication")}
              </th>
              <th className={cn(head, "text-right")} style={{ width: 100 }}>
                {t("contracts.signature")}
              </th>
              <th className={cn(head, "text-right")} style={{ width: 100 }}>
                {t("contracts.completion")}
              </th>
              <th className={cn(head, "text-right")} style={{ width: 70 }} />
            </tr>

            {/* Filtres SOUS les en-têtes : chaque contrôle est dans sa colonne,
                donc on n'a pas à deviner sur quoi il porte. */}
            <tr>
              <th className="border-b border-[var(--border)] px-2 py-1" colSpan={2}>
                <input
                  className={filterInput}
                  placeholder={t("contracts.filterText")}
                  aria-label={t("contracts.filterText")}
                  value={filters.text}
                  onChange={(e) => setFilters({ ...filters, text: e.target.value })}
                />
              </th>
              <th className="border-b border-[var(--border)] px-2 py-1">
                <FilterSelect
                  label={t("contracts.type")}
                  value={filters.type}
                  options={types}
                  onChange={(type) => setFilters({ ...filters, type })}
                  allLabel={t("contracts.filterAll")}
                />
              </th>
              <th className="border-b border-[var(--border)] px-2 py-1">
                <FilterSelect
                  label={t("contracts.procedure")}
                  value={filters.procedure}
                  options={procedures}
                  onChange={(procedure) => setFilters({ ...filters, procedure })}
                  allLabel={t("contracts.filterAll")}
                />
              </th>
              <th className="border-b border-[var(--border)] px-2 py-1">
                <FilterSelect
                  label={t("contracts.scenario")}
                  value={filters.scenario}
                  options={scenarios.map((s) => s.code)}
                  onChange={(scenario) => setFilters({ ...filters, scenario })}
                  allLabel={t("contracts.filterAll")}
                />
              </th>
              <th className="border-b border-[var(--border)]" colSpan={5} />
            </tr>
          </thead>

          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-[var(--text-muted)]">
                  {active ? t("contracts.noMatch") : t("common.empty")}
                </td>
              </tr>
            )}

            {visible.map((c) => {
              const contractLots = lotsByContract.get(c.id) ?? [];
              const isCollapsed = collapsed.has(c.id);
              // Gré à gré : l'absence d'avis découle de la procédure, ce n'est
              // pas un trou dans les données (GAPS 6).
              const directContracting = c.procedure === "DC";

              return (
                <FragmentRows
                  key={c.id}
                  contract={c}
                  lots={contractLots}
                  isCollapsed={isCollapsed}
                  onToggle={() => toggle(c.id)}
                  directContracting={directContracting}
                  scenarios={scenarios}
                  contractOptions={contractOptions}
                  locale={locale}
                  cell={cell}
                  t={t}
                />
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  allLabel,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allLabel: string;
}) {
  return (
    <select
      aria-label={label}
      className="h-7 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-1 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function FragmentRows({
  contract: c,
  lots,
  isCollapsed,
  onToggle,
  directContracting,
  scenarios,
  contractOptions,
  locale,
  cell,
  t,
}: {
  contract: ContractView;
  lots: LotView[];
  isCollapsed: boolean;
  onToggle: () => void;
  directContracting: boolean;
  scenarios: ScenarioOption[];
  contractOptions: { id: string; contractCode: string; name: string }[];
  locale: "en" | "sq";
  cell: string;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const notApplicable = (date: string | null) =>
    directContracting && !date ? (
      <span className="text-[var(--text-muted)]" title={t("contracts.notApplicableDirect")}>
        {t("common.notApplicable")}
      </span>
    ) : (
      formatPlanDate(date)
    );

  return (
    <>
      <tr className="bg-[color-mix(in_srgb,var(--app-bg)_35%,transparent)]">
        <td className={cn(cell, "whitespace-nowrap font-medium")}>
          <span className="flex items-center gap-1">
            {lots.length > 0 ? (
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-label={t(isCollapsed ? "schedule.expandRow" : "schedule.collapseRow")}
                onClick={onToggle}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--border)]"
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                  style={{ transform: isCollapsed ? "rotate(-90deg)" : undefined }}
                >
                  <path d="M1 3 L5 7 L9 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            ) : (
              <span className="w-4 shrink-0" aria-hidden="true" />
            )}
            {c.contractCode}
            {lots.length > 0 && (
              <span className="text-[10px] font-normal text-[var(--text-muted)]">
                {t("contracts.lotCount", { count: String(lots.length) })}
              </span>
            )}
          </span>
        </td>
        <td className={cell}>
          <span className="block">{c.name}</span>
          <span className="block font-mono text-[11px] text-[var(--text-muted)]">
            {c.contractNumber}
          </span>
        </td>
        <td className={cell}>
          <Chip>{c.contractType}</Chip>
        </td>
        <td className={cell}>
          <Chip>{c.procedure}</Chip>
        </td>
        <td className={cn(cell, "text-xs text-[var(--text-muted)]")}>{c.scenarioCode}</td>
        <td className={cn(cell, "text-right tabular-nums")}>
          {c.estimatedAmount === null ? (
            <span className="text-[var(--text-muted)]">TBD</span>
          ) : (
            formatAmount(c.estimatedAmount, locale, { compact: true })
          )}
        </td>
        <td className={cn(cell, "text-right tabular-nums")}>
          {notApplicable(c.spnPublicationDate)}
        </td>
        <td className={cn(cell, "text-right tabular-nums")}>
          {formatPlanDate(c.signatureDate)}
        </td>
        <td className={cn(cell, "text-right tabular-nums")}>
          {formatPlanDate(c.completionDate)}
        </td>
        <td className={cn(cell, "text-right")}>
          <ContractRowEdit
            contract={{
              id: c.id,
              contractCode: c.contractCode,
              contractNumber: c.contractNumber,
              name: c.name,
              contractType: c.contractType as "C" | "W" | "G" | "NC" | "DB",
              competitionType: c.competitionType as "NPC" | "IPC" | null,
              procedure: c.procedure as "REOI" | "IB" | "PQL+IB" | "RQ" | "DC",
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
            scenarios={scenarios}
          />
        </td>
      </tr>

      {!isCollapsed &&
        lots.map((lot) => (
          <tr key={lot.id}>
            {/* Indentation par un retrait réel et une barre de rattachement :
                un simple décalage se perd dès qu'on fait défiler. */}
            <td className={cn(cell, "whitespace-nowrap")}>
              <span className="flex items-center gap-2 pl-5">
                <span
                  aria-hidden="true"
                  className="h-3 w-2 border-b border-l border-[var(--border)]"
                />
                <span className="text-xs">{lot.lotCode}</span>
              </span>
            </td>
            <td className={cn(cell, "text-sm")}>{lot.name}</td>
            <td className={cell} colSpan={2}>
              <span className="text-xs text-[var(--text-muted)]">
                {lot.contractor ?? t("lots.noContractor")}
              </span>
            </td>
            <td className={cn(cell, "text-xs text-[var(--text-muted)]")}>
              {lot.buildingCount > 0 ? (
                t("lots.buildingCount", { count: String(lot.buildingCount) })
              ) : (
                /* Zéro bâtiment se lirait comme « lot vide ». Ici la
                   composition n'est simplement pas arrêtée. */
                <span title={t("lots.unassignedNote")}>{t("lots.unassigned")}</span>
              )}
            </td>
            <td className={cn(cell, "text-right tabular-nums text-xs")}>
              {formatAmountRange(lot.amountMin, lot.amountMax, locale)}
            </td>
            <td className={cn(cell, "text-right tabular-nums text-xs")} colSpan={2}>
              <span className="text-[var(--text-muted)]">
                {t("lots.turnover")} {formatAmountRange(lot.turnoverMin, lot.turnoverMax, locale)}
              </span>
            </td>
            <td className={cell} />
            <td className={cn(cell, "text-right")}>
              <LotRowEdit
                lot={{
                  id: lot.id,
                  lotCode: lot.lotCode,
                  lotNumber: lot.lotNumber,
                  name: lot.name,
                  contractId: lot.contractId,
                  amountEurMin: lot.amountMin,
                  amountEurMax: lot.amountMax,
                  minTurnoverEurMin: lot.turnoverMin,
                  minTurnoverEurMax: lot.turnoverMax,
                  contractor: lot.contractor,
                }}
                contracts={contractOptions}
              />
            </td>
          </tr>
        ))}
    </>
  );
}
