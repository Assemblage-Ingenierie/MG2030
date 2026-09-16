"use client";

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button, IconButton } from "@/components/ui/button";
import {
  cancelNoObjection,
  createNoObjection,
  deleteNoObjection,
  markSent,
  recordAnswer,
  updateNoObjection,
  type NoObjectionInput,
} from "@/app/(app)/no-objections/actions";

export interface TargetOption {
  id: string;
  code: string;
  name: string;
}

export interface TaskTarget {
  id: string;
  wbsCode: string;
  activity: string;
  durationDays: number | null;
}

export interface NoObjectionValue extends NoObjectionInput {
  id: string | null;
}

const blank = (): NoObjectionValue => ({
  id: null,
  reference: null,
  subject: "",
  contractId: null,
  lotId: null,
  taskId: null,
  sentDate: null,
  comments: null,
});

function FormModal({
  open,
  onClose,
  initial,
  contracts,
  tasks,
}: {
  open: boolean;
  onClose: () => void;
  initial: NoObjectionValue | null;
  contracts: TargetOption[];
  tasks: TaskTarget[];
}) {
  const t = useT();
  const [value, setValue] = useState<NoObjectionValue>(initial ?? blank());
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
        ? await updateNoObjection(value.id, value)
        : await createNoObjection(value);
      if (!result.ok) {
        const label = t(`noObjections.error_${result.error}`);
        setError(result.detail ? `${label} — ${result.detail}` : label);
        return;
      }
      onClose();
    });
  }

  const linked = tasks.find((task) => task.id === value.taskId) ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={value.id ? t("noObjections.editTitle") : t("noObjections.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={t("noObjections.subject")}
          required
          value={value.subject}
          onChange={(e) => setValue({ ...value, subject: e.target.value })}
        />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={t("noObjections.reference")}
            optionalText={t("common.optional")}
            hint={t("noObjections.referenceHint")}
            value={value.reference ?? ""}
            onChange={(e) => setValue({ ...value, reference: e.target.value })}
          />
          {/* Obligatoire : c'est elle qui fait courir le délai d'instruction.
              Un avis sans date d'envoi occupe une ligne sans qu'on puisse dire
              depuis quand il attend. */}
          <Field
            label={t("noObjections.sentDate")}
            required
            type="date"
            hint={t("noObjections.sentDateHint")}
            value={value.sentDate ?? ""}
            onChange={(e) => setValue({ ...value, sentDate: e.target.value || null })}
          />
        </div>

        {/* Facultatif, et il doit le rester : le plan de passation lui-même
            passe en non-objection sans relever d'aucun marché (migration
            0027). */}
        <div>
          <Label optionalText={t("common.optional")}>{t("noObjections.contract")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.contractId ?? ""}
            onChange={(e) => setValue({ ...value, contractId: e.target.value || null })}
          >
            <option value="">{t("common.none")}</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>{t("noObjections.task")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={value.taskId ?? ""}
            onChange={(e) => setValue({ ...value, taskId: e.target.value || null })}
          >
            <option value="">{t("common.none")}</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.wbsCode} — {task.activity}
                {task.durationDays === null
                  ? ""
                  : ` (${t("noObjections.daysShort", { days: String(task.durationDays) })})`}
              </option>
            ))}
          </select>
          {/* On dit ce que la liaison PRODUIT : sans elle, aucun retard ne peut
              être affirmé, seulement un temps écoulé. */}
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {linked?.durationDays != null
              ? t("noObjections.taskLinked", { days: String(linked.durationDays) })
              : t("noObjections.taskHint")}
          </p>
        </div>

        <Field
          label={t("noObjections.comments")}
          optionalText={t("common.optional")}
          hint={t("noObjections.commentsHint")}
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

type Outcome = "no_objection" | "no_objection_with_comments" | "rejected";

/**
 * Saisie de la réponse de l'AFD : issue ET date, dans le même geste.
 *
 * L'issue se choisissait auparavant dans une liste déroulante qui écrivait
 * aussitôt, en datant la réponse du jour de la saisie. C'était rapide et faux :
 * une réponse s'enregistre souvent quelques jours après sa réception, si bien
 * que le délai d'instruction mesuré — la seule statistique que cet écran
 * produise — était systématiquement raccourci.
 *
 * La date est donc DEMANDÉE. Elle est pré-remplie au jour même, qui reste le
 * cas le plus fréquent, mais elle est visible et corrigeable avant écriture.
 */
function AnswerModal({
  open,
  onClose,
  noObjectionId,
  sentDate,
}: {
  open: boolean;
  onClose: () => void;
  noObjectionId: string;
  sentDate: string | null;
}) {
  const t = useT();
  const [outcome, setOutcome] = useState<Outcome>("no_objection");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // La base refuse une réponse antérieure à l'envoi (contrainte
    // `no_objection_dates`). On le dit ici, où l'utilisateur peut corriger,
    // plutôt que de laisser remonter un message Postgres.
    if (sentDate && date < sentDate) {
      setError(t("noObjections.error_answerBeforeSent"));
      return;
    }
    startTransition(async () => {
      const result = await recordAnswer(noObjectionId, outcome, date);
      if (!result.ok) {
        const label = t(`noObjections.error_${result.error}`);
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
      title={t("noObjections.recordAnswer")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label>{t("noObjections.outcome")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as Outcome)}
          >
            <option value="no_objection">{t("noObjections.status_no_objection")}</option>
            <option value="no_objection_with_comments">
              {t("noObjections.status_no_objection_with_comments")}
            </option>
            <option value="rejected">{t("noObjections.status_rejected")}</option>
          </select>
        </div>

        <Field
          label={t("noObjections.responseDate")}
          required
          type="date"
          hint={t("noObjections.responseDateHint")}
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
          <Button variant="primary" type="submit" disabled={pending || !date}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function AddNoObjectionButton({
  contracts,
  tasks,
}: {
  contracts: TargetOption[];
  tasks: TaskTarget[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("no_objection.write")) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("noObjections.add")}
      </Button>
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={null}
        contracts={contracts}
        tasks={tasks}
      />
    </>
  );
}

/**
 * Actions de ligne.
 *
 * L'issue de l'avis se choisit dans une liste et non par trois boutons : les
 * trois issues de l'AFD sont exclusives, et « avis avec commentaires » est
 * distinct d'un refus — les confondre changerait la conduite de la passation.
 */
export function NoObjectionRowActions({
  row,
  contracts,
  tasks,
}: {
  row: NoObjectionValue & { status: string };
  contracts: TargetOption[];
  tasks: TaskTarget[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!can("no_objection.write")) return null;
  const id = row.id!;
  const awaitingAnswer = row.status === "draft" || row.status === "sent";

  return (
    <span className="flex flex-wrap items-center justify-end gap-1">
      {row.status === "draft" && (
        <Button
          size="sm"
          variant="quiet"
          disabled={pending}
          title={t("noObjections.markSentHint")}
          onClick={() => startTransition(() => void markSent(id, null))}
        >
          {t("noObjections.markSent")}
        </Button>
      )}

      {awaitingAnswer && (
        <Button size="sm" variant="quiet" disabled={pending} onClick={() => setAnswering(true)}>
          {t("noObjections.recordAnswer")}
        </Button>
      )}

      <AnswerModal
        open={answering}
        onClose={() => setAnswering(false)}
        noObjectionId={id}
        sentDate={row.sentDate}
      />

      {awaitingAnswer && (
        <Button
          size="sm"
          variant="quiet"
          disabled={pending}
          title={t("noObjections.cancelHint")}
          onClick={() => startTransition(() => void cancelNoObjection(id))}
        >
          {t("noObjections.cancelRequest")}
        </Button>
      )}

      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("common.edit")}
      </Button>

      <IconButton
        label={t("common.delete")}
        disabled={pending}
        onClick={() => {
          if (window.confirm(t("noObjections.confirmDelete", { subject: row.subject }))) {
            startTransition(() => void deleteNoObjection(id));
          }
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
      </IconButton>

      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        initial={row}
        contracts={contracts}
        tasks={tasks}
      />
    </span>
  );
}
