"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ContractFormModal, type ContractFormValue, type ScenarioOption } from "./contract-form";
import { LotFormModal, type LotFormValue, type ContractOption } from "./lot-form";

export function ContractRowEdit({
  contract,
  scenarios,
}: {
  contract: ContractFormValue;
  scenarios: ScenarioOption[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("contract.write")) return null;

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>
      <ContractFormModal open={open} onClose={() => setOpen(false)} initial={contract} scenarios={scenarios} />
    </>
  );
}

export function AddContractButton({ scenarios }: { scenarios: ScenarioOption[] }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("contract.write") || scenarios.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("common.add")}
      </Button>
      <ContractFormModal open={open} onClose={() => setOpen(false)} initial={null} scenarios={scenarios} />
    </>
  );
}

export function LotRowEdit({
  lot,
  contracts,
}: {
  lot: LotFormValue;
  contracts: ContractOption[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("contract.write")) return null;

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>
      <LotFormModal open={open} onClose={() => setOpen(false)} initial={lot} contracts={contracts} />
    </>
  );
}

export function AddLotButton({ contracts }: { contracts: ContractOption[] }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("contract.write") || contracts.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("common.add")}
      </Button>
      <LotFormModal open={open} onClose={() => setOpen(false)} initial={null} contracts={contracts} />
    </>
  );
}
