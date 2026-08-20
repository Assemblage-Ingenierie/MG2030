"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createLot, updateLot, type LotInput } from "@/app/(app)/contracts/actions";

export interface LotFormValue extends LotInput {
  id: string | null;
}

export interface ContractOption {
  id: string;
  contractCode: string;
  name: string;
}

const empty = (contractId: string): LotFormValue => ({
  id: null,
  lotCode: "",
  contractId,
  lotNumber: 1,
  name: "",
  amountEurMin: null,
  amountEurMax: null,
  minTurnoverEurMin: null,
  minTurnoverEurMax: null,
  contractor: null,
});

export function LotFormModal({
  open,
  onClose,
  initial,
  contracts,
}: {
  open: boolean;
  onClose: () => void;
  initial: LotFormValue | null;
  contracts: ContractOption[];
}) {
  const t = useT();
  const [value, setValue] = useState<LotFormValue>(initial ?? empty(contracts[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? empty(contracts[0]?.id ?? ""));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id ? await updateLot(value.id, value) : await createLot(value);
      if (!result.ok) {
        setError(t(`lots.error_${result.error}`) || result.error || "");
        return;
      }
      onClose();
    });
  }

  const num = (raw: string): number | null => (raw.trim() === "" ? null : Number(raw));

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={value.id ? t("lots.editTitle") : t("lots.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!value.id && (
          <>
            <Field
              label={t("lots.code")}
              required
              value={value.lotCode}
              onChange={(e) => setValue({ ...value, lotCode: e.target.value })}
            />
            <div>
              <Label>{t("lots.contract")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={value.contractId}
                onChange={(e) => setValue({ ...value, contractId: e.target.value })}
              >
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contractCode} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              label={t("lots.number")}
              required
              inputMode="numeric"
              value={value.lotNumber}
              onChange={(e) => setValue({ ...value, lotNumber: Number(e.target.value) || 1 })}
            />
          </>
        )}

        <Field
          label={t("lots.name")}
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={`${t("lots.amount")} — min`}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.amountEurMin ?? ""}
            onChange={(e) => setValue({ ...value, amountEurMin: num(e.target.value) })}
          />
          <Field
            label={`${t("lots.amount")} — max`}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.amountEurMax ?? ""}
            onChange={(e) => setValue({ ...value, amountEurMax: num(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={`${t("lots.turnover")} — min`}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.minTurnoverEurMin ?? ""}
            onChange={(e) => setValue({ ...value, minTurnoverEurMin: num(e.target.value) })}
          />
          <Field
            label={`${t("lots.turnover")} — max`}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.minTurnoverEurMax ?? ""}
            onChange={(e) => setValue({ ...value, minTurnoverEurMax: num(e.target.value) })}
          />
        </div>

        <Field
          label={t("lots.contractor")}
          optionalText={t("common.optional")}
          value={value.contractor ?? ""}
          onChange={(e) => setValue({ ...value, contractor: e.target.value })}
        />

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
