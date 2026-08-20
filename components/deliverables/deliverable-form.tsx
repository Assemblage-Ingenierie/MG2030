"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button, IconButton } from "@/components/ui/button";
import {
  createDeliverable,
  deleteDeliverable,
  markSubmitted,
  setDeliverableVisa,
  updateDeliverable,
  type DeliverableInput,
  type DeliverableStatus,
} from "@/app/(app)/deliverables/actions";

export interface DeliverableFormValue extends DeliverableInput {
  id: string | null;
}

export interface OriginOption {
  id: string;
  code: string;
  name: string;
}

const STATUSES: DeliverableStatus[] = [
  "expected",
  "submitted",
  "under_review",
  "approved",
  "approved_with_comments",
  "rejected",
];

const empty = (contractId: string): DeliverableFormValue => ({
  id: null,
  title: "",
  issuer: null,
  contractId,
  lotId: null,
  contractualDate: null,
  actualSubmissionDate: null,
  status: "expected",
  comments: null,
});

function DeliverableFormModal({
  open,
  onClose,
  initial,
  contracts,
}: {
  open: boolean;
  onClose: () => void;
  initial: DeliverableFormValue | null;
  contracts: OriginOption[];
}) {
  const t = useT();
  const [value, setValue] = useState<DeliverableFormValue>(
    initial ?? empty(contracts[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? empty(contracts[0]?.id ?? ""));
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id
        ? await updateDeliverable(value.id, value)
        : await createDeliverable(value);
      if (!result.ok) {
        setError(t(`deliverables.error_${result.error}`) || result.error || "");
        return;
      }
      onClose();
    });
  }

  const dateOrNull = (raw: string) => (raw === "" ? null : raw);

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={value.id ? t("deliverables.editTitle") : t("deliverables.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={t("deliverables.deliverable")}
          required
          value={value.title}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
        />

        <div>
          <Label>{t("deliverables.contract")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.contractId ?? ""}
            onChange={(e) => setValue({ ...value, contractId: e.target.value || null })}
          >
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <Field
          label={t("deliverables.issuer")}
          optionalText={t("common.optional")}
          hint={t("deliverables.issuerHint")}
          value={value.issuer ?? ""}
          onChange={(e) => setValue({ ...value, issuer: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("deliverables.due")}
            optionalText={t("common.optional")}
            type="date"
            value={value.contractualDate ?? ""}
            onChange={(e) => setValue({ ...value, contractualDate: dateOrNull(e.target.value) })}
          />
          <Field
            label={t("deliverables.submitted")}
            optionalText={t("common.optional")}
            type="date"
            value={value.actualSubmissionDate ?? ""}
            onChange={(e) =>
              setValue({ ...value, actualSubmissionDate: dateOrNull(e.target.value) })
            }
          />
        </div>

        <div>
          <Label>{t("deliverables.status")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.status}
            onChange={(e) => setValue({ ...value, status: e.target.value as DeliverableStatus })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`deliverables.${s}`)}
              </option>
            ))}
          </select>
        </div>

        <Field
          label={t("deliverables.comments")}
          optionalText={t("common.optional")}
          value={value.comments ?? ""}
          onChange={(e) => setValue({ ...value, comments: e.target.value })}
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

export function AddDeliverableButton({ contracts }: { contracts: OriginOption[] }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("deliverable.write") || contracts.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("common.add")}
      </Button>
      <DeliverableFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={null}
        contracts={contracts}
      />
    </>
  );
}

/**
 * Actions de ligne.
 *
 * « Remis » est un bouton distinct de l'édition : c'est le geste le plus
 * fréquent du suivi, et il ne doit pas coûter l'ouverture d'un formulaire.
 */
export function DeliverableRowActions({
  deliverable,
  contracts,
  hasVisa,
}: {
  deliverable: DeliverableFormValue;
  contracts: OriginOption[];
  hasVisa: boolean;
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!can("deliverable.write")) return null;

  return (
    <span className="flex items-center justify-end gap-1">
      {!deliverable.actualSubmissionDate && (
        <Button
          size="sm"
          variant="quiet"
          disabled={pending}
          title={t("deliverables.markSubmittedHint")}
          onClick={() => startTransition(() => void markSubmitted(deliverable.id!, null))}
        >
          {t("deliverables.markSubmitted")}
        </Button>
      )}

      <Button
        size="sm"
        variant="quiet"
        disabled={pending}
        title={hasVisa ? t("deliverables.removeVisaHint") : t("deliverables.visaHint")}
        onClick={() => startTransition(() => void setDeliverableVisa(deliverable.id!, !hasVisa))}
      >
        {hasVisa ? t("deliverables.removeVisa") : t("deliverables.visa")}
      </Button>

      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>

      <IconButton
        label={t("common.delete")}
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("deliverables.confirmDelete", { title: deliverable.title }))) {
            startTransition(() => void deleteDeliverable(deliverable.id!));
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </IconButton>

      <DeliverableFormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={deliverable}
        contracts={contracts}
      />
    </span>
  );
}
