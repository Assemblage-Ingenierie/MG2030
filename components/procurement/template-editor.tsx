"use client";

// ============================================================
// components/procurement/template-editor.tsx — gabarits et étapes.
//
// Les étapes se saisissent DANS le tableau, sans modale : un gabarit se règle
// en ajustant une dizaine de durées d'affilée, et ouvrir une fenêtre par
// durée serait absurde. Le gabarit lui-même passe par une modale, car ses
// champs sont des choix contraints qu'on ne touche qu'une fois.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button, IconButton } from "@/components/ui/button";
import {
  addStep,
  createTemplate,
  deleteStep,
  deleteTemplate,
  seedObservedTemplates,
  updateStep,
  updateTemplate,
  type StepInput,
  type TemplateInput,
} from "@/app/(app)/procurement/actions";

const PROCEDURES = ["REOI", "IB", "PQL+IB", "RQ", "DC"];
const CONTRACT_TYPES = ["C", "W", "G", "NC", "DB"];
const SELECTION_METHODS = ["QCBS", "QBS", "FBS", "LCS", "lowest_evaluated_compliant_bid"];
const ANCHORS = [
  "spn_publication_date",
  "bid_opening_date",
  "signature_date",
  "completion_date",
];

export interface TemplateValue extends TemplateInput {
  id: string | null;
}

const blank = (): TemplateValue => ({
  id: null,
  code: "",
  name: "",
  procedure: "REOI",
  contractType: null,
  selectionMethod: null,
  description: null,
  isActive: true,
});

function TemplateModal({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: TemplateValue | null;
}) {
  const t = useT();
  const [value, setValue] = useState<TemplateValue>(initial ?? blank());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (open && value.id !== (initial?.id ?? null) && !pending) {
    setValue(initial ?? blank());
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = value.id
        ? await updateTemplate(value.id, value)
        : await createTemplate(value);
      if (!result.ok) {
        const label = t(`procurement.error_${result.error}`);
        setError(result.detail ? `${label} — ${result.detail}` : label);
        return;
      }
      onClose();
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={value.id ? t("procurement.editTemplate") : t("procurement.createTemplate")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("procurement.code")}
            required
            value={value.code}
            onChange={(e) => setValue({ ...value, code: e.target.value })}
          />
          <Field
            label={t("procurement.templateName")}
            required
            value={value.name}
            onChange={(e) => setValue({ ...value, name: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>{t("procurement.procedure")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.procedure}
              onChange={(e) => setValue({ ...value, procedure: e.target.value })}
            >
              {PROCEDURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("procurement.contractType")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.contractType ?? ""}
              onChange={(e) => setValue({ ...value, contractType: e.target.value || null })}
            >
              <option value="">{t("common.none")}</option>
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("procurement.selectionMethod")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={value.selectionMethod ?? ""}
              onChange={(e) => setValue({ ...value, selectionMethod: e.target.value || null })}
            >
              <option value="">{t("common.none")}</option>
              {SELECTION_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Field
          label={t("procurement.description")}
          optionalText={t("common.optional")}
          value={value.description ?? ""}
          onChange={(e) => setValue({ ...value, description: e.target.value })}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.isActive}
            onChange={(e) => setValue({ ...value, isActive: e.target.checked })}
          />
          {t("procurement.isActive")}
        </label>

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

export function TemplateToolbar({ hasObserved }: { hasObserved: boolean }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!can("procurement.admin")) return null;

  return (
    <span className="flex items-center gap-2">
      {/* Le bouton disparaît une fois les gabarits créés. Il reste sans danger
          s'il est cliqué deux fois : l'action ignore un code déjà pris. */}
      {!hasObserved && (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          title={t("procurement.seedObservedHint")}
          onClick={() => startTransition(() => void seedObservedTemplates())}
        >
          {t("procurement.seedObserved")}
        </Button>
      )}
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("procurement.createTemplate")}
      </Button>
      <TemplateModal open={open} onClose={() => setOpen(false)} initial={null} />
    </span>
  );
}

export function TemplateRowActions({ template }: { template: TemplateValue }) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!can("procurement.admin")) return null;

  return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>
      <IconButton
        label={t("common.delete")}
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("procurement.confirmDeleteTemplate", { code: template.code }))) {
            startTransition(() => void deleteTemplate(template.id!));
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </IconButton>
      <TemplateModal open={open} onClose={() => setOpen(false)} initial={template} />
    </span>
  );
}

// ── Étapes, éditées en ligne ────────────────────────────────────────────────

export interface StepValue extends StepInput {
  id: string | null;
}

/**
 * Une étape en édition directe.
 *
 * Le brouillon est LOCAL à la ligne : régler dix durées d'affilée ne doit pas
 * redessiner les neuf autres à chaque frappe. Même raison que dans la grille
 * du plan de charge.
 */
function StepRow({
  templateId,
  step,
  onError,
}: {
  templateId: string;
  step: StepValue;
  onError: (message: string | null) => void;
}) {
  const t = useT();
  const { can } = usePermissions();
  const editable = can("procurement.admin");
  const [draft, setDraft] = useState<StepValue>(step);
  const [pending, startTransition] = useTransition();

  const dirty =
    draft.name !== step.name ||
    draft.stepNo !== step.stepNo ||
    draft.defaultDurationDays !== step.defaultDurationDays ||
    draft.isAfdNoObjection !== step.isAfdNoObjection ||
    draft.contractDateAnchor !== step.contractDateAnchor;

  function save() {
    if (!dirty) return;
    startTransition(async () => {
      const result = draft.id
        ? await updateStep(draft.id, draft)
        : await addStep(templateId, draft);
      if (!result.ok) {
        const label = t(`procurement.error_${result.error}`);
        onError(result.detail ? `${label} — ${result.detail}` : label);
        return;
      }
      onError(null);
      if (!draft.id) setDraft({ ...blankStep(), stepNo: draft.stepNo + 1 });
    });
  }

  const input = "h-7 rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 text-sm";

  return (
    <tr className="border-b border-[var(--border)]">
      <td className="px-2 py-1">
        {/* Chaque champ porte son propre libellé : l'en-tête de colonne ne
            nomme pas un champ pour un lecteur d'écran, et le texte d'invite
            n'est pas un libellé. Constaté à l'audit : la colonne « Step » se
            lisait « New step… ». */}
        <input
          type="number"
          min={1}
          disabled={!editable}
          aria-label={t("procurement.stepNo")}
          className={input + " w-14 text-right tabular-nums"}
          value={draft.stepNo}
          onChange={(e) => setDraft({ ...draft, stepNo: Number(e.target.value) })}
          onBlur={save}
        />
      </td>
      <td className="px-2 py-1">
        <input
          disabled={!editable}
          aria-label={t("procurement.stepName")}
          className={input + " w-full"}
          placeholder={t("procurement.stepNamePlaceholder")}
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={save}
        />
      </td>
      <td className="px-2 py-1">
        <input
          type="number"
          min={0}
          disabled={!editable}
          aria-label={t("procurement.duration")}
          className={input + " w-16 text-right tabular-nums"}
          value={draft.defaultDurationDays}
          onChange={(e) => setDraft({ ...draft, defaultDurationDays: Number(e.target.value) })}
          onBlur={save}
        />
      </td>
      <td className="px-2 py-1">
        <select
          disabled={!editable}
          aria-label={t("procurement.anchor")}
          className={input + " w-44"}
          value={draft.contractDateAnchor ?? ""}
          onChange={(e) => {
            const next = { ...draft, contractDateAnchor: e.target.value || null };
            setDraft(next);
            if (next.id) startTransition(() => void updateStep(next.id!, next));
          }}
        >
          <option value="">{t("procurement.anchorNone")}</option>
          {ANCHORS.map((a) => (
            <option key={a} value={a}>
              {t(`procurement.anchor_${a}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1 text-center">
        <input
          type="checkbox"
          disabled={!editable}
          aria-label={t("procurement.isNoObjectionLabel")}
          checked={draft.isAfdNoObjection}
          onChange={(e) => {
            const next = { ...draft, isAfdNoObjection: e.target.checked };
            setDraft(next);
            if (next.id) startTransition(() => void updateStep(next.id!, next));
          }}
        />
      </td>
      <td className="px-2 py-1 text-right">
        {editable && draft.id && (
          <IconButton
            label={t("common.delete")}
            disabled={pending}
            onClick={() => startTransition(() => void deleteStep(draft.id!))}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </IconButton>
        )}
        {editable && !draft.id && (
          <Button size="sm" variant="quiet" disabled={pending || !dirty} onClick={save}>
            {t("common.add")}
          </Button>
        )}
      </td>
    </tr>
  );
}

const blankStep = (): StepValue => ({
  id: null,
  stepNo: 1,
  name: "",
  defaultDurationDays: 0,
  isAfdNoObjection: false,
  contractDateAnchor: null,
});

export function StepTable({
  templateId,
  steps,
}: {
  templateId: string;
  steps: StepValue[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [error, setError] = useState<string | null>(null);

  const nextNo = steps.reduce((max, s) => Math.max(max, s.stepNo), 0) + 1;

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
            <th className="px-2 py-1 font-semibold">{t("procurement.stepNo")}</th>
            <th className="px-2 py-1 font-semibold">{t("procurement.stepName")}</th>
            <th className="px-2 py-1 font-semibold">{t("procurement.duration")}</th>
            <th className="px-2 py-1 font-semibold">{t("procurement.anchor")}</th>
            <th className="px-2 py-1 text-center font-semibold">{t("procurement.isNoObjection")}</th>
            <th className="px-2 py-1" />
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => (
            <StepRow key={step.id} templateId={templateId} step={step} onError={setError} />
          ))}
          {can("procurement.admin") && (
            <StepRow
              key={`new-${nextNo}`}
              templateId={templateId}
              step={{ ...blankStep(), stepNo: nextNo }}
              onError={setError}
            />
          )}
        </tbody>
      </table>
      <p className="text-xs text-[var(--text-muted)]">{t("procurement.stepHint")}</p>
    </div>
  );
}
