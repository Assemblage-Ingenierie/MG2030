"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { BuildingFormModal, type BuildingFormValue, type SiteOption } from "./building-form";

export function BuildingRowEdit({
  building,
  sites,
}: {
  building: BuildingFormValue;
  sites: SiteOption[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("building.write")) return null;

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>
      <BuildingFormModal open={open} onClose={() => setOpen(false)} initial={building} sites={sites} />
    </>
  );
}

export function AddBuildingButton({ sites }: { sites: SiteOption[] }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("building.write") || sites.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("common.add")}
      </Button>
      <BuildingFormModal open={open} onClose={() => setOpen(false)} initial={null} sites={sites} />
    </>
  );
}
