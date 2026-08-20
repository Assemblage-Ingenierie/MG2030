"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createSite, updateSite, type SiteInput } from "@/app/(app)/sites/actions";

export interface SiteFormValue extends SiteInput {
  id: string | null;
}

const EMPTY: SiteFormValue = {
  id: null,
  siteCode: "",
  subproject: "training_venues",
  name: "",
  beneficiaryInstitution: null,
  siteType: null,
  address: null,
  latitude: null,
  longitude: null,
  grossAreaSqm: null,
  yearOfConstruction: null,
  occupancyStatus: null,
};

export function SiteFormModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  /** `null` = création. */
  initial: SiteFormValue | null;
}) {
  const t = useT();
  const [value, setValue] = useState<SiteFormValue>(initial ?? EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reposer la valeur initiale à chaque ouverture : sinon un second clic sur
  // « ajouter » réafficherait le brouillon du site précédemment édité.
  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? EMPTY);
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id
        ? await updateSite(value.id, value)
        : await createSite(value);
      if (!result.ok) {
        setError(t(`sites.error_${result.error}`) || result.error || "");
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
      title={value.id ? t("sites.editTitle") : t("sites.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!value.id && (
          <Field
            label={t("sites.code")}
            required
            value={value.siteCode}
            onChange={(e) => setValue({ ...value, siteCode: e.target.value })}
          />
        )}

        <Field
          label={t("sites.name")}
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />

        <div>
          <Label>{t("sites.subproject")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.subproject}
            onChange={(e) =>
              setValue({ ...value, subproject: e.target.value as SiteInput["subproject"] })
            }
          >
            <option value="athletes_village">{t("sites.athletes_village")}</option>
            <option value="training_venues">{t("sites.training_venues")}</option>
          </select>
        </div>

        <Field
          label={t("sites.beneficiary")}
          optionalText={t("common.optional")}
          value={value.beneficiaryInstitution ?? ""}
          onChange={(e) => setValue({ ...value, beneficiaryInstitution: e.target.value })}
        />

        <Field
          label={t("sites.address")}
          optionalText={t("common.optional")}
          hint={t("sites.missingGeo")}
          value={value.address ?? ""}
          onChange={(e) => setValue({ ...value, address: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("sites.latitude")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.latitude ?? ""}
            onChange={(e) => setValue({ ...value, latitude: num(e.target.value) })}
          />
          <Field
            label={t("sites.longitude")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.longitude ?? ""}
            onChange={(e) => setValue({ ...value, longitude: num(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("sites.area")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.grossAreaSqm ?? ""}
            onChange={(e) => setValue({ ...value, grossAreaSqm: num(e.target.value) })}
          />
          <Field
            label={t("sites.built")}
            optionalText={t("common.optional")}
            inputMode="numeric"
            value={value.yearOfConstruction ?? ""}
            onChange={(e) => setValue({ ...value, yearOfConstruction: num(e.target.value) })}
          />
        </div>

        <Field
          label={t("sites.occupancy")}
          optionalText={t("common.optional")}
          value={value.occupancyStatus ?? ""}
          onChange={(e) => setValue({ ...value, occupancyStatus: e.target.value })}
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
