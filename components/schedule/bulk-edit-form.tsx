"use client";

// ============================================================
// components/schedule/bulk-edit-form.tsx — modifier plusieurs tâches d'un coup.
//
// SEULS LES CHAMPS RENSEIGNÉS S'APPLIQUENT. Chaque liste s'ouvre sur « ne pas
// modifier », et un libellé laissé vide ne touche à rien : on peut ainsi
// changer le parent de tâches aux responsables différents sans les uniformiser.
// Pour VIDER un responsable ou un marché, on choisit explicitement « non
// affecté » / « aucun » — distinct de « ne pas modifier ».
// ============================================================

import { useMemo, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import type { ModelTask } from "@/lib/schedule/board-model";
import type { BulkPatch } from "@/app/(app)/schedule/board-actions";
import type { ContractChoice, PersonOption } from "./board-types";

/** Valeur de liste « laisser tel quel ». Jamais un identifiant réel. */
const KEEP = "__keep__";

export function BulkEditForm({
  selectedIds,
  tasks,
  people,
  contracts,
  onClose,
  onSave,
  onDelete,
}: {
  selectedIds: string[];
  tasks: ModelTask[];
  people: PersonOption[];
  contracts: ContractChoice[];
  onClose: () => void;
  onSave: (fields: BulkPatch) => boolean;
  /** Supprime toute la sélection, sous-tâches comprises. */
  onDelete: () => void;
}) {
  const t = useT();
  const [activity, setActivity] = useState("");
  const [parent, setParent] = useState(KEEP);
  const [owner, setOwner] = useState(KEEP);
  const [contract, setContract] = useState(KEEP);

  // La sélection ET ses descendants. Deux usages : ces tâches ne peuvent pas
  // servir de parent (ce serait une boucle), et ce sont elles que la
  // suppression emporte.
  const subtree = useMemo(() => {
    const children = new Map<string, string[]>();
    for (const x of tasks) {
      if (x.parentId) children.set(x.parentId, [...(children.get(x.parentId) ?? []), x.id]);
    }
    const found = new Set<string>();
    const stack = [...selectedIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (found.has(id)) continue;
      found.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    return found;
  }, [tasks, selectedIds]);

  const parents = useMemo(
    () =>
      tasks.filter(
        (x) => (x.type === "summary" || x.type === "group_header") && !subtree.has(x.id),
      ),
    [tasks, subtree],
  );
  const doomedCount = subtree.size;

  const fromSelect = (value: string): string | null | undefined =>
    value === KEEP ? undefined : value === "" ? null : value;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const fields: BulkPatch = {
      activity: activity.trim() === "" ? undefined : activity.trim(),
      parentId: fromSelect(parent),
      ownerId: fromSelect(owner),
      contractId: fromSelect(contract),
    };
    if (onSave(fields)) onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("schedule.bulkTitle", { count: String(selectedIds.length) })}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-xs text-[var(--text-muted)]">{t("schedule.bulkIntro")}</p>

        <Field
          label={t("schedule.activity")}
          optionalText={t("common.optional")}
          placeholder={t("schedule.bulkKeepText")}
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />

        <div>
          <Label>{t("schedule.parent")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={parent}
            onChange={(e) => setParent(e.target.value)}
          >
            <option value={KEEP}>{t("schedule.bulkKeep")}</option>
            <option value="">{t("schedule.noParent")}</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.wbsCode} — {p.activity}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("schedule.owner")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value={KEEP}>{t("schedule.bulkKeep")}</option>
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
              value={contract}
              onChange={(e) => setContract(e.target.value)}
            >
              <option value={KEEP}>{t("schedule.bulkKeep")}</option>
              <option value="">{t("common.none")}</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractCode} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-4">
          {/* Suppression de TOUTE la sélection, sous-tâches comprises. Même
              confirmation dans la page que pour une tâche seule, et Ctrl+Z la
              défait d'un coup. */}
          <ConfirmAction
            message={
              doomedCount > selectedIds.length
                ? t("schedule.bulkConfirmDeleteWithChildren", {
                    count: String(selectedIds.length),
                    total: String(doomedCount),
                  })
                : t("schedule.bulkConfirmDelete", { count: String(selectedIds.length) })
            }
            onConfirm={() => {
              onDelete();
              onClose();
            }}
          >
            {(arm) => (
              <Button variant="danger" size="sm" type="button" onClick={arm}>
                {t("schedule.bulkDelete", { count: String(selectedIds.length) })}
              </Button>
            )}
          </ConfirmAction>
          <span className="ml-auto" />
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit">
            {t("schedule.bulkApply", { count: String(selectedIds.length) })}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
