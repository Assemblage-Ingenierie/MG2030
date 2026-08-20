"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createContract, updateContract, type ContractInput } from "@/app/(app)/contracts/actions";

export interface ContractFormValue extends ContractInput {
  id: string | null;
}

export interface ScenarioOption {
  id: string;
  code: string;
  name: string;
}

const empty = (scenarioId: string): ContractFormValue => ({
  id: null,
  contractCode: "",
  contractNumber: "",
  name: "",
  contractType: "C",
  competitionType: null,
  procedure: "REOI",
  selectionMethod: null,
  afdReview: "prior",
  scenarioId,
  estimatedAmountEur: null,
  contractor: null,
  spnPublicationDate: null,
  bidOpeningDate: null,
  signatureDate: null,
  completionDate: null,
});

const CONTRACT_TYPES: ContractInput["contractType"][] = ["C", "W", "G", "NC", "DB"];
const PROCEDURES: ContractInput["procedure"][] = ["REOI", "IB", "PQL+IB", "RQ", "DC"];
const SELECTIONS: NonNullable<ContractInput["selectionMethod"]>[] = [
  "QCBS",
  "QBS",
  "FBS",
  "LCS",
  "lowest_evaluated_compliant_bid",
];

export function ContractFormModal({
  open,
  onClose,
  initial,
  scenarios,
}: {
  open: boolean;
  onClose: () => void;
  initial: ContractFormValue | null;
  scenarios: ScenarioOption[];
}) {
  const t = useT();
  const [value, setValue] = useState<ContractFormValue>(
    initial ?? empty(scenarios[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? empty(scenarios[0]?.id ?? ""));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id
        ? await updateContract(value.id, value)
        : await createContract(value);
      if (!result.ok) {
        setError(t(`contracts.error_${result.error}`) || result.error || "");
        return;
      }
      onClose();
    });
  }

  const num = (raw: string): number | null => (raw.trim() === "" ? null : Number(raw));
  const dateOrNull = (raw: string): string | null => (raw === "" ? null : raw);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={value.id ? t("contracts.editTitle") : t("contracts.createTitle")}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          {!value.id && (
            <Field
              label={t("contracts.code")}
              required
              value={value.contractCode}
              onChange={(e) => setValue({ ...value, contractCode: e.target.value })}
            />
          )}
          <Field
            label={t("contracts.number")}
            required
            hint={t("contracts.numberFormatHint")}
            value={value.contractNumber}
            onChange={(e) => setValue({ ...value, contractNumber: e.target.value })}
          />
        </div>

        <Field
          label={t("contracts.name")}
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{t("contracts.type")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.contractType}
              onChange={(e) =>
                setValue({ ...value, contractType: e.target.value as ContractInput["contractType"] })
              }
            >
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("contracts.competition")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.competitionType ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  competitionType: (e.target.value || null) as ContractInput["competitionType"],
                })
              }
            >
              <option value="">{t("common.notApplicable")}</option>
              <option value="NPC">NPC</option>
              <option value="IPC">IPC</option>
            </select>
          </div>
          <div>
            <Label>{t("contracts.review")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.afdReview}
              onChange={(e) =>
                setValue({ ...value, afdReview: e.target.value as ContractInput["afdReview"] })
              }
            >
              <option value="prior">{t("contracts.reviewPrior")}</option>
              <option value="post">{t("contracts.reviewPost")}</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("contracts.procedure")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.procedure}
              onChange={(e) =>
                setValue({ ...value, procedure: e.target.value as ContractInput["procedure"] })
              }
            >
              {PROCEDURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("contracts.selection")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.selectionMethod ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  selectionMethod: (e.target.value || null) as ContractInput["selectionMethod"],
                })
              }
            >
              <option value="">{t("common.notApplicable")}</option>
              {SELECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>{t("contracts.scenario")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.scenarioId}
            onChange={(e) => setValue({ ...value, scenarioId: e.target.value })}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("contracts.estimate")}
            optionalText={t("common.optional")}
            hint={t("contracts.estimateHint")}
            inputMode="decimal"
            value={value.estimatedAmountEur ?? ""}
            onChange={(e) => setValue({ ...value, estimatedAmountEur: num(e.target.value) })}
          />
          <Field
            label={t("contracts.contractor")}
            optionalText={t("common.optional")}
            value={value.contractor ?? ""}
            onChange={(e) => setValue({ ...value, contractor: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("contracts.publication")}
            optionalText={t("common.optional")}
            type="date"
            value={value.spnPublicationDate ?? ""}
            onChange={(e) => setValue({ ...value, spnPublicationDate: dateOrNull(e.target.value) })}
          />
          <Field
            label={t("contracts.opening")}
            optionalText={t("common.optional")}
            type="date"
            value={value.bidOpeningDate ?? ""}
            onChange={(e) => setValue({ ...value, bidOpeningDate: dateOrNull(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("contracts.signature")}
            optionalText={t("common.optional")}
            type="date"
            value={value.signatureDate ?? ""}
            onChange={(e) => setValue({ ...value, signatureDate: dateOrNull(e.target.value) })}
          />
          <Field
            label={t("contracts.completion")}
            optionalText={t("common.optional")}
            type="date"
            value={value.completionDate ?? ""}
            onChange={(e) => setValue({ ...value, completionDate: dateOrNull(e.target.value) })}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
