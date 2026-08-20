"use client";

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { SiteFormModal, type SiteFormValue } from "./site-form";

export function SiteRowEdit({ site }: { site: SiteFormValue }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("site.write")) return null;

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>
      <SiteFormModal open={open} onClose={() => setOpen(false)} initial={site} />
    </>
  );
}

export function AddSiteButton() {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("site.write")) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("common.add")}
      </Button>
      <SiteFormModal open={open} onClose={() => setOpen(false)} initial={null} />
    </>
  );
}
