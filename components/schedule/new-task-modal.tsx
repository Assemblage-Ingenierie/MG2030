"use client";

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import type { CreateTaskInput } from "@/app/(app)/schedule/actions";
import type { BoardTask } from "./board-types";

const TYPES: CreateTaskInput["taskType"][] = ["task", "summary", "milestone", "group_header"];

export function NewTaskModal({
  open,
  onClose,
  scenarioCode,
  planId,
  tasks,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  scenarioCode: string;
  planId: string;
  tasks: BoardTask[];
  onCreate: (input: CreateTaskInput) => Promise<boolean>;
}) {
  const t = useT();
  const [pending, startTransition] = useTransition();

  const [activity, setActivity] = useState("");
  const [taskType, setTaskType] = useState<CreateTaskInput["taskType"]>("task");
  const [parentId, setParentId] = useState<string>("");
  const [durationDays, setDurationDays] = useState("");

  // Parents possibles : seuls un récapitulatif ou un intertitre peuvent
  // accueillir des enfants. Proposer une tâche feuille comme parent créerait
  // une hiérarchie que le moteur n'agrège pas.
  const parents = useMemo(
    () => tasks.filter((task) => task.type === "summary" || task.type === "group_header"),
    [tasks],
  );

  const carriesDuration = taskType === "task" || taskType === "summary";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const ok = await onCreate({
        scenarioCode,
        planId,
        activity,
        taskType,
        parentId: parentId || null,
        durationDays: carriesDuration && durationDays ? Number(durationDays) : null,
        // Nouvelle tâche en fin de liste : la déplacer se fait ensuite, et
        // l'insérer au milieu obligerait à renuméroter tout le reste.
        sortOrder: tasks.length,
      });
      if (ok) {
        setActivity("");
        setDurationDays("");
        onClose();
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} closeLabel={t("common.close")} title={t("schedule.addTask")}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("schedule.taskType")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={taskType}
              onChange={(e) => setTaskType(e.target.value as CreateTaskInput["taskType"])}
            >
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`schedule.type_${type}`)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t(`schedule.typeHint_${taskType}`)}
            </p>
          </div>
        </div>

        <Field
          label={t("schedule.activity")}
          required
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>{t("schedule.parent")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">{t("schedule.noParent")}</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.wbsCode} — {p.activity}
                </option>
              ))}
            </select>
          </div>

          {carriesDuration && (
            <Field
              label={t("schedule.duration")}
              optionalText={t("common.optional")}
              inputMode="numeric"
              hint={t("schedule.durationHint")}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
            />
          )}
        </div>

        <p className="rounded-md bg-[var(--app-bg)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {t("schedule.createNote")}
        </p>

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.add")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
