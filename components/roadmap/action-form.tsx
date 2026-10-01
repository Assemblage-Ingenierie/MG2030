"use client";

// ============================================================
// components/roadmap/action-form.tsx — création et édition d'une action.
//
// ⚠ LA PRÉCISION SE CHOISIT AVANT LA DATE, et c'est tout l'intérêt de l'écran.
//
// Un calendrier seul ne sait dire qu'un jour. Celui qui pense « courant
// octobre » doit alors choisir un 1er, un 15, un 31 — et la roadmap affirme
// ensuite une précision que personne n'a voulue. On demande donc d'abord CE
// QU'ON SAIT (un jour ? une semaine ? un trimestre ? rien ?), puis on n'ouvre
// que le sélecteur correspondant.
//
// L'aperçu sous le sélecteur montre la phrase telle qu'elle apparaîtra dans la
// liste : « Week of 12/10/2026 ». Il rend visible, à la saisie, le fait que le
// jour cliqué ne sera pas celui qu'on affichera.
// ============================================================

import { useState, useTransition } from "react";
import { useI18n, useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { ArchiveIcon, EditIcon, RestoreIcon, TrashIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";
import { AssigneePicker, type PersonOption } from "./assignee-picker";
import {
  TIMELINE_KINDS,
  resolveTimeline,
  timelineLabel,
  type TimelineKind,
} from "@/lib/roadmap/timeline";
import {
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  type RoadmapActionRow,
  type RoadmapPriority,
  type RoadmapStatus,
  type RoadmapSubjectRow,
} from "@/lib/roadmap/types";
import {
  archiveRoadmapAction,
  createRoadmapAction,
  deleteRoadmapAction,
  restoreRoadmapAction,
  updateRoadmapAction,
  type RoadmapInput,
} from "@/app/(app)/roadmap/actions";

interface Draft {
  subjectId: string;
  title: string;
  status: RoadmapStatus | "";
  priority: RoadmapPriority | "";
  kind: TimelineKind | "";
  anchor: string;
  rangeEnd: string;
  comments: string;
  assignees: string[];
}

function draftFrom(action: RoadmapActionRow | null, subjects: RoadmapSubjectRow[]): Draft {
  return {
    subjectId: action?.subjectId ?? subjects[0]?.id ?? "",
    title: action?.title ?? "",
    status: action?.status ?? "",
    priority: action?.priority ?? "",
    kind: action?.timeline.kind ?? "",
    anchor: action?.timeline.start ?? "",
    // La saisie est INCLUSIVE, le stockage exclusif : on retire le jour ajouté.
    rangeEnd:
      action?.timeline.kind === "range" && action.timeline.end
        ? shiftDay(action.timeline.end, -1)
        : "",
    comments: action?.comments ?? "",
    assignees: (action?.assignees ?? []).map((a) => a.label),
  };
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function FormModal({
  open,
  onClose,
  action,
  subjects,
  people,
}: {
  open: boolean;
  onClose: () => void;
  action: RoadmapActionRow | null;
  subjects: RoadmapSubjectRow[];
  people: PersonOption[];
}) {
  const t = useT();
  const { locale } = useI18n();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(action, subjects));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Aperçu de la phrase finale, recalculé à chaque frappe par le MÊME module
  // que la liste — donc jamais décalé d'avec elle.
  const preview = timelineLabel(
    resolveTimeline(draft.kind || null, draft.anchor || null, draft.rangeEnd || null),
    locale,
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: RoadmapInput = {
      subjectId: draft.subjectId,
      title: draft.title,
      status: draft.status || null,
      priority: draft.priority || null,
      timelineKind: draft.kind || null,
      anchor: draft.anchor || null,
      rangeEnd: draft.rangeEnd || null,
      comments: draft.comments || null,
      assignees: draft.assignees,
    };
    start(async () => {
      const result = action
        ? await updateRoadmapAction(action.id, input)
        : await createRoadmapAction(input);
      if (!result.ok) {
        setError(t(`roadmap.error_${result.error}`));
        return;
      }
      onClose();
    });
  }

  /** Intitulé du sélecteur de date : il nomme ce qu'on désigne, pas « date ». */
  const anchorLabel =
    draft.kind === "week"
      ? t("roadmap.anchorWeek")
      : draft.kind === "month"
        ? t("roadmap.anchorMonth")
        : draft.kind === "quarter"
          ? t("roadmap.anchorQuarter")
          : t("roadmap.anchorDay");

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t("common.close")}
      title={action ? t("roadmap.editTitle") : t("roadmap.createTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={t("roadmap.titleField")}
          required
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />

        <div>
          <Label>{t("roadmap.subject")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={draft.subjectId}
            onChange={(e) => set("subjectId", e.target.value)}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label optionalText={t("common.optional")}>{t("roadmap.status")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={draft.status}
              onChange={(e) => set("status", e.target.value as Draft["status"])}
            >
              <option value="">{t("roadmap.notSet")}</option>
              {ROADMAP_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`roadmap.status_${s}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label optionalText={t("common.optional")}>{t("roadmap.priority")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={draft.priority}
              onChange={(e) => set("priority", e.target.value as Draft["priority"])}
            >
              <option value="">{t("roadmap.notSet")}</option>
              {ROADMAP_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {t(`roadmap.priority_${p}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Timeline : la précision, PUIS le sélecteur adapté ───────────── */}
        <div className="rounded-md border border-[var(--border)] p-3">
          <Label>{t("roadmap.timelineKind")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as Draft["kind"];
              // Repasser à « aucune date » efface les dates : les garder en
              // réserve ferait réapparaître une date qu'on vient de retirer.
              setDraft((d) =>
                kind === ""
                  ? { ...d, kind, anchor: "", rangeEnd: "" }
                  : { ...d, kind, rangeEnd: kind === "range" ? d.rangeEnd : "" },
              );
            }}
          >
            <option value="">{t("roadmap.kind_none")}</option>
            {TIMELINE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`roadmap.kind_${k}`)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{t("roadmap.kindHint")}</p>

          {draft.kind !== "" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label={draft.kind === "range" ? t("roadmap.rangeFrom") : anchorLabel}
                type="date"
                required
                value={draft.anchor}
                onChange={(e) => set("anchor", e.target.value)}
              />
              {draft.kind === "range" && (
                <Field
                  label={t("roadmap.rangeTo")}
                  type="date"
                  required
                  value={draft.rangeEnd}
                  onChange={(e) => set("rangeEnd", e.target.value)}
                />
              )}
            </div>
          )}

          {/* Ce que la liste écrira, mot pour mot. */}
          <p className="mt-2 text-sm text-[var(--text)]">
            {t(`roadmap.timeline_${preview.key}`, preview.values)}
          </p>
        </div>

        <AssigneePicker
          people={people}
          value={draft.assignees}
          onChange={(labels) => set("assignees", labels)}
        />

        <Field
          label={t("roadmap.comments")}
          optionalText={t("common.optional")}
          value={draft.comments}
          onChange={(e) => set("comments", e.target.value)}
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

export function AddActionButton({
  subjects,
  people,
}: {
  subjects: RoadmapSubjectRow[];
  people: PersonOption[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("roadmap.write")) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("roadmap.addAction")}
      </Button>
      {open && (
        <FormModal
          open
          onClose={() => setOpen(false)}
          action={null}
          subjects={subjects}
          people={people}
        />
      )}
    </>
  );
}

export function ActionRowActions({
  action,
  subjects,
  people,
  archived = false,
}: {
  action: RoadmapActionRow;
  subjects: RoadmapSubjectRow[];
  people: PersonOption[];
  /** Une ligne archivée se restaure ou se supprime ; elle ne s'édite plus. */
  archived?: boolean;
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (!can("roadmap.write")) return null;

  /* ARCHIVER, PAS SUPPRIMER (01/10/2026). Une action retirée de la roadmap n'a
     pas disparu du projet : elle a été abandonnée, reportée ou absorbée, et
     « pourquoi avait-on arrêté de suivre ça ? » se pose vraiment six mois plus
     tard. L'archivage ne demande donc PAS de confirmation — il est réversible,
     et une question posée à chaque geste courant finit par se cliquer sans
     être lue. La suppression définitive, elle, en demande une, et n'existe que
     sur une ligne déjà archivée. */
  if (archived) {
    return (
      <span className="flex items-center justify-end gap-0.5">
        <IconButton
          label={t("roadmap.restore")}
          disabled={pending}
          onClick={() => start(() => void restoreRoadmapAction(action.id))}
          className="h-7 w-7"
        >
          <RestoreIcon className="h-4 w-4" />
        </IconButton>
        <ConfirmAction
          message={t("roadmap.confirmDelete", { title: action.title })}
          disabled={pending}
          onConfirm={() => start(() => void deleteRoadmapAction(action.id))}
        >
          {(arm) => (
            <IconButton
              label={t("common.delete")}
              disabled={pending}
              onClick={arm}
              className="h-7 w-7"
            >
              <TrashIcon className="h-4 w-4" />
            </IconButton>
          )}
        </ConfirmAction>
      </span>
    );
  }

  /* `IconButton` EXIGE un `label` — l'icône est muette pour un lecteur
     d'écran, le nom de l'action reste donc porté par l'accessibilité et par
     l'infobulle. */
  return (
    <span className="flex items-center justify-end gap-0.5">
      <IconButton label={t("common.edit")} onClick={() => setOpen(true)} className="h-7 w-7">
        <EditIcon className="h-4 w-4" />
      </IconButton>
      <IconButton
        label={t("roadmap.archive")}
        disabled={pending}
        onClick={() => start(() => void archiveRoadmapAction(action.id))}
        className="h-7 w-7"
      >
        <ArchiveIcon className="h-4 w-4" />
      </IconButton>
      {open && (
        <FormModal
          open
          onClose={() => setOpen(false)}
          action={action}
          subjects={subjects}
          people={people}
        />
      )}
    </span>
  );
}
