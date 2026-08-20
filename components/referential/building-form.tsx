"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createBuilding, updateBuilding, type BuildingInput } from "@/app/(app)/buildings/actions";

export interface BuildingFormValue extends BuildingInput {
  id: string | null;
}

export interface SiteOption {
  id: string;
  siteCode: string;
  name: string;
}

const empty = (siteId: string): BuildingFormValue => ({
  id: null,
  buildingCode: "",
  siteId,
  name: "",
  zone: null,
  typology: null,
  interventionType: "renovation",
  netAreaSqm: null,
  grossAreaSqm: null,
  unitCostEurSqm: null,
  worksEstimateEur: null,
  yearOfConstruction: null,
  constructionType: null,
});

const INTERVENTIONS: BuildingInput["interventionType"][] = [
  "renovation",
  "demolition",
  "extension",
  "new_construction",
];

export function BuildingFormModal({
  open,
  onClose,
  initial,
  sites,
}: {
  open: boolean;
  onClose: () => void;
  /** `null` = création. */
  initial: BuildingFormValue | null;
  sites: SiteOption[];
}) {
  const t = useT();
  const [value, setValue] = useState<BuildingFormValue>(initial ?? empty(sites[0]?.id ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? empty(sites[0]?.id ?? ""));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id
        ? await updateBuilding(value.id, value)
        : await createBuilding(value);
      if (!result.ok) {
        setError(t(`buildings.error_${result.error}`) || result.error || "");
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
      title={value.id ? t("buildings.editTitle") : t("buildings.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!value.id && (
          <>
            <Field
              label={t("buildings.code")}
              required
              value={value.buildingCode}
              onChange={(e) => setValue({ ...value, buildingCode: e.target.value })}
            />
            <div>
              <Label>{t("buildings.site")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={value.siteId}
                onChange={(e) => setValue({ ...value, siteId: e.target.value })}
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.siteCode} — {s.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <Field
          label={t("buildings.name")}
          required
          value={value.name}
          onChange={(e) => setValue({ ...value, name: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("buildings.zone")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.zone ?? ""}
              onChange={(e) =>
                setValue({
                  ...value,
                  zone: (e.target.value || null) as BuildingInput["zone"],
                })
              }
            >
              <option value="">{t("common.notApplicable")}</option>
              <option value="residential">{t("buildings.residential")}</option>
              <option value="services_and_sports">{t("buildings.services_and_sports")}</option>
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t("buildings.zoneNote")}</p>
          </div>

          <div>
            <Label>{t("buildings.intervention")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.interventionType}
              onChange={(e) =>
                setValue({
                  ...value,
                  interventionType: e.target.value as BuildingInput["interventionType"],
                })
              }
            >
              {INTERVENTIONS.map((i) => (
                <option key={i} value={i}>
                  {t(`buildings.${i}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Field
          label={t("buildings.typology")}
          optionalText={t("common.optional")}
          value={value.typology ?? ""}
          onChange={(e) => setValue({ ...value, typology: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("buildings.netArea")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.netAreaSqm ?? ""}
            onChange={(e) => setValue({ ...value, netAreaSqm: num(e.target.value) })}
          />
          <Field
            label={t("buildings.grossArea")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            hint={t("buildings.areaNote")}
            value={value.grossAreaSqm ?? ""}
            onChange={(e) => setValue({ ...value, grossAreaSqm: num(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("buildings.unitCost")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.unitCostEurSqm ?? ""}
            onChange={(e) => setValue({ ...value, unitCostEurSqm: num(e.target.value) })}
          />
          <Field
            label={t("buildings.estimate")}
            optionalText={t("common.optional")}
            inputMode="decimal"
            value={value.worksEstimateEur ?? ""}
            onChange={(e) => setValue({ ...value, worksEstimateEur: num(e.target.value) })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("buildings.built")}
            optionalText={t("common.optional")}
            inputMode="numeric"
            value={value.yearOfConstruction ?? ""}
            onChange={(e) => setValue({ ...value, yearOfConstruction: num(e.target.value) })}
          />
          <Field
            label={t("buildings.constructionType")}
            optionalText={t("common.optional")}
            value={value.constructionType ?? ""}
            onChange={(e) => setValue({ ...value, constructionType: e.target.value })}
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
