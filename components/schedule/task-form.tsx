"use client";

// ============================================================
// components/schedule/task-form.tsx — édition d'une tâche par formulaire.
//
// La grille sert la saisie RAPIDE, colonne par colonne, au clavier. Le
// formulaire sert l'autre besoin : voir et régler tous les champs d'une tâche
// d'un coup, sans traverser huit colonnes. Les deux écrivent le même modèle.
//
// La date de début n'est proposée QUE si la tâche n'a pas de prédécesseur :
// sinon elle vaut la fin de celui-ci, et l'offrir en saisie donnerait un plan
// où le lien affiché ne correspond plus au calcul.
// ============================================================

import { useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { formatPlanDate } from "@/lib/i18n/format";
import type { ModelTask } from "@/lib/schedule/board-model";
import type { ContractChoice, PersonOption, SiteChoice } from "./board-types";

export function TaskForm({
  task,
  rowNumber,
  predecessorLabel,
  hasPredecessor,
  people,
  sites,
  contracts,
  onClose,
  onSave,
}: {
  task: ModelTask;
  rowNumber: number;
  predecessorLabel: string;
  hasPredecessor: boolean;
  people: PersonOption[];
  sites: SiteChoice[];
  contracts: ContractChoice[];
  onClose: () => void;
  onSave: (fields: Partial<ModelTask>) => boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState({
    activity: task.activity,
    durationDays: task.durationDays,
    startAnchor: task.startAnchor,
    progressPct: task.progressPct,
    ownerId: task.ownerId,
    contractId: task.contractId,
    siteId: task.siteId,
  });

  const isHeader = task.type === "group_header";
  const isSummary = task.type === "summary";
  const isMilestone = task.type === "milestone";

  const num = (raw: string) => (raw.trim() === "" ? null : Number(raw));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (onSave(draft)) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("schedule.editTask", { row: String(rowNumber) })}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {/* Ce que la tâche EST, et qu'on ne change pas ici : le type gouverne
            quels champs ont un sens, et le changer relève d'une autre décision. */}
        <p className="text-xs text-[var(--text-muted)]">
          {t("schedule.formIdentity", {
            wbs: task.wbsCode,
            type: t(`schedule.type_${task.type}`),
          })}
        </p>

        <Field
          label={t("schedule.activity")}
          required
          value={draft.activity}
          onChange={(e) => setDraft({ ...draft, activity: e.target.value })}
        />

        {!isHeader && !isSummary && (
          <div className="grid grid-cols-2 gap-4">
            <Field
              label={t("schedule.durationLabel")}
              type="number"
              min={0}
              disabled={isMilestone}
              hint={isMilestone ? t("schedule.milestoneZero") : t("schedule.durationHint")}
              value={draft.durationDays === null ? "" : String(draft.durationDays)}
              onChange={(e) => setDraft({ ...draft, durationDays: num(e.target.value) })}
            />
            <Field
              label={t("schedule.progress")}
              type="number"
              min={0}
              max={100}
              hint={t("schedule.progressHint")}
              value={draft.progressPct === null ? "" : String(draft.progressPct)}
              onChange={(e) => setDraft({ ...draft, progressPct: num(e.target.value) })}
            />
          </div>
        )}

        {!isHeader && (
          <div className="grid grid-cols-2 gap-4">
            {hasPredecessor ? (
              /* Piloté par la précédence : on montre la date, on ne l'offre pas.
                 Dire POURQUOI vaut mieux qu'un champ grisé sans explication. */
              <div>
                <Label>{t("schedule.start")}</Label>
                <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
                  {formatPlanDate(task.start)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--accent-2)" }}>
                  {t("schedule.startDrivenBy", { rows: predecessorLabel })}
                </p>
              </div>
            ) : (
              <Field
                label={t("schedule.startAnchorLabel")}
                type="date"
                optionalText={t("common.optional")}
                hint={t("schedule.startAnchorHint")}
                value={draft.startAnchor ?? ""}
                onChange={(e) => setDraft({ ...draft, startAnchor: e.target.value || null })}
              />
            )}
            <div>
              <Label>{t("schedule.end")}</Label>
              <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
                {formatPlanDate(task.end)}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{t("schedule.endHint")}</p>
            </div>
          </div>
        )}

        <div>
          <Label>{t("schedule.predecessors")}</Label>
          <p className="mt-1 text-sm tabular-nums text-[var(--text)]">
            {predecessorLabel === "" ? "—" : predecessorLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {t("schedule.predecessorsFormHint")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("schedule.owner")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={draft.ownerId ?? ""}
              onChange={(e) => setDraft({ ...draft, ownerId: e.target.value || null })}
            >
              <option value="">{t("schedule.unassigned")}</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} — {p.roleCode}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t("schedule.contract")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={draft.contractId ?? ""}
              onChange={(e) => setDraft({ ...draft, contractId: e.target.value || null })}
            >
              <option value="">{t("common.none")}</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>{t("schedule.site")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={draft.siteId ?? ""}
            onChange={(e) => setDraft({ ...draft, siteId: e.target.value || null })}
          >
            <option value="">{t("schedule.allSites")}</option>
            {sites
              .filter((s) => task.subproject === null || s.subproject === task.subproject)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.siteCode} — {s.name}
                </option>
              ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{t("schedule.siteHint")}</p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
