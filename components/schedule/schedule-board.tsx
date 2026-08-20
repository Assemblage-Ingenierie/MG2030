"use client";

// ============================================================
// components/schedule/schedule-board.tsx — PLAN DE CHARGE.
//
// La grille de saisie et le diagramme sur UNE page, le Gantt en prolongement
// direct des colonnes éditables. Un seul défilement vertical porte les deux
// volets ; seul l'horizontal du diagramme est indépendant.
//
// « Si la saisie est plus lente que sous Excel, la PIU retournera à Excel. »
// — brief §2. D'où :
//   • navigation entièrement au clavier ;
//   • pas de bouton « enregistrer » : valider une cellule écrit ;
//   • le brouillon de saisie vit DANS la cellule (board-cell.tsx), donc taper
//     ne redessine ni les autres lignes ni le SVG ;
//   • les précédences se saisissent en CODES WBS séparés par des virgules,
//     comme sous MS Project — plus rapide que n'importe quel sélecteur.
// ============================================================

import { useCallback, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button, IconButton } from "@/components/ui/button";
import { formatPlanDate } from "@/lib/i18n/format";
import { daysToWeeks } from "@/lib/schedule/dates";
import { ROW_H } from "@/lib/gantt/layout";
import type { ScaleUnit } from "@/lib/gantt/scale";
import { cn } from "@/lib/cn";
import {
  createTask,
  deleteTask,
  setTaskActivity,
  setTaskAssignment,
  setTaskConstraint,
  setTaskDuration,
  setTaskPredecessors,
  setTaskProgress,
  setTaskSite,
  setTaskStartAnchor,
  type WriteResult,
} from "@/app/(app)/schedule/actions";
import {
  BOARD_COLUMNS,
  COLUMN_WIDTH,
  GRID_WIDTH,
  isCellEditable,
  type BoardColumn,
  type BoardTask,
  type PersonOption,
  type SiteChoice,
} from "./board-types";
import { BoardCell, type CommitDirection } from "./board-cell";
import { GanttPane, HEAD_H } from "./gantt-pane";
import { NewTaskModal } from "./new-task-modal";

interface Cell {
  row: number;
  column: BoardColumn;
}

export function ScheduleBoard({
  tasks,
  dependencies,
  people,
  sites,
  scenarioCode,
  planId,
  scale,
  today,
  bufferStart,
  deadline,
  locale,
}: {
  tasks: BoardTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  people: PersonOption[];
  sites: SiteChoice[];
  scenarioCode: string;
  planId: string;
  scale: ScaleUnit;
  today: string;
  bufferStart: string | null;
  deadline: string | null;
  locale: "en" | "sq";
}) {
  const t = useT();
  const { can } = usePermissions();
  const editable = can("task.write");

  const [active, setActive] = useState<Cell | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Retour immédiat : la ligne touchée est marquée pendant l'aller-retour
  // serveur, sans attendre le recalcul complet.
  const [savingId, setSavingId] = useOptimistic<string | null, string | null>(
    null,
    (_, next) => next,
  );

  const byCode = useMemo(() => new Map(tasks.map((task) => [task.wbsCode, task])), [tasks]);

  const handle = useCallback(
    (result: WriteResult) => {
      if (result.ok) {
        setError(null);
        return true;
      }
      const message = t(`schedule.${result.error}`);
      setError(
        result.detail
          ? `${message === `schedule.${result.error}` ? result.error : message} — ${result.detail}`
          : message,
      );
      return false;
    },
    [t],
  );

  /** Déplace le focus après validation. */
  const move = useCallback(
    (from: Cell, direction: CommitDirection) => {
      if (direction === "none") {
        setActive(null);
        return;
      }
      if (direction === "down") {
        for (let i = from.row + 1; i < tasks.length; i++) {
          if (isCellEditable(tasks[i], from.column)) {
            setActive({ row: i, column: from.column });
            return;
          }
        }
        setActive(null);
        return;
      }
      const index = BOARD_COLUMNS.indexOf(from.column);
      const next = BOARD_COLUMNS.slice(index + 1).find((c) =>
        isCellEditable(tasks[from.row], c),
      );
      if (next) {
        setActive({ row: from.row, column: next });
        return;
      }
      for (let i = from.row + 1; i < tasks.length; i++) {
        const first = BOARD_COLUMNS.find((c) => isCellEditable(tasks[i], c));
        if (first) {
          setActive({ row: i, column: first });
          return;
        }
      }
      setActive(null);
    },
    [tasks],
  );

  const commit = useCallback(
    (row: number, column: BoardColumn, value: string | null, direction: CommitDirection) => {
      const task = tasks[row];
      // Annulation : on ne touche à rien.
      if (value === null) {
        if (direction === "none") setActive(null);
        else move({ row, column }, direction);
        return;
      }

      const raw = value.trim();
      const num = raw === "" ? null : Number(raw);

      // Valeur inchangée : ni écriture ni recalcul. Traverser la grille au
      // clavier pour la relire ne doit rien coûter.
      const unchanged =
        (column === "activity" && raw === task.activity) ||
        (column === "duration" && num === task.durationDays) ||
        (column === "progress" && num === task.progressPct) ||
        (column === "start" && (raw || null) === task.startAnchor) ||
        (column === "predecessors" && raw === task.predecessorCodes.join(", "));

      if (unchanged) {
        move({ row, column }, direction);
        return;
      }

      startTransition(async () => {
        setSavingId(task.id);
        let result: WriteResult;

        switch (column) {
          case "activity":
            result = await setTaskActivity(task.id, raw);
            break;
          case "duration":
            if (num !== null && !Number.isInteger(num)) {
              setError(t("schedule.invalidDuration"));
              return;
            }
            result = await setTaskDuration(task.id, scenarioCode, num);
            break;
          case "progress":
            result = await setTaskProgress(task.id, num);
            break;
          case "start":
            result = await setTaskStartAnchor(task.id, scenarioCode, raw || null);
            break;
          case "predecessors":
            result = await setTaskPredecessors(
              task.id,
              scenarioCode,
              raw === "" ? [] : raw.split(/[,;\s]+/),
            );
            break;
          default:
            return;
        }

        if (handle(result)) move({ row, column }, direction);
      });
    },
    [tasks, scenarioCode, move, handle, t, setSavingId],
  );

  const assign = useCallback(
    (task: BoardTask, userId: string | null) => {
      startTransition(async () => {
        setSavingId(task.id);
        handle(await setTaskAssignment(task.id, "owner", userId));
        setActive(null);
      });
    },
    [handle, setSavingId],
  );

  const attachSite = useCallback(
    (task: BoardTask, siteId: string | null) => {
      startTransition(async () => {
        setSavingId(task.id);
        handle(await setTaskSite(task.id, siteId));
        setActive(null);
      });
    },
    [handle, setSavingId],
  );

  const remove = useCallback(
    (task: BoardTask) => {
      startTransition(async () => {
        setSavingId(task.id);
        handle(await deleteTask(task.id, scenarioCode));
      });
    },
    [scenarioCode, handle, setSavingId],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* ── Barre d'action ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-2">
        {editable && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            {t("schedule.addTask")}
          </Button>
        )}
        <span className="text-xs text-[var(--text-muted)]">
          {t("schedule.rowCount", { count: String(tasks.length) })}
        </span>
        {pending && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            {t("common.saving")}
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-2 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      {/* ── Les deux volets, un seul défilement vertical ──────────────── */}
      <div ref={scrollRef} className="flex max-h-[72vh] overflow-y-auto">
        {/* Volet gauche : la grille. `sticky` le maintient visible quand on
            fait défiler le diagramme horizontalement. */}
        <div className="sticky left-0 z-10 shrink-0 bg-[var(--surface)]" style={{ width: GRID_WIDTH }}>
          <GridHeader t={t} />
          {tasks.map((task, row) => (
            <GridRow
              key={task.id}
              task={task}
              row={row}
              active={active}
              editable={editable}
              people={people}
              sites={sites}
              saving={savingId === task.id}
              onActivate={setActive}
              onCommit={commit}
              onAssign={assign}
              onAttachSite={attachSite}
              onDelete={remove}
              t={t}
            />
          ))}
        </div>

        {/* Volet droit : le diagramme, prolongement des colonnes. */}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <GanttPane
            tasks={tasks}
            dependencies={dependencies}
            scale={scale}
            today={today}
            bufferStart={bufferStart}
            deadline={deadline}
            locale={locale}
            labels={{
              buffer: t("gantt.buffer"),
              deadline: t("gantt.deadline"),
              today: t("gantt.today"),
            }}
          />
        </div>
      </div>

      <p className="px-2 pb-1 text-xs text-[var(--text-muted)]">{t("schedule.keyboardHint")}</p>

      {adding && (
        <NewTaskModal
          open={adding}
          onClose={() => setAdding(false)}
          scenarioCode={scenarioCode}
          planId={planId}
          tasks={tasks}
          onCreate={async (input) => {
            const result = await createTask(input);
            handle(result);
            return result.ok;
          }}
        />
      )}
    </div>
  );
}

// ── En-tête de la grille ────────────────────────────────────────────────────

function GridHeader({ t }: { t: (k: string) => string }) {
  const cell =
    "flex items-center border-r border-b border-[var(--border)] px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  return (
    <div
      className="sticky top-0 z-20 flex bg-[var(--app-bg)]"
      style={{ height: HEAD_H }}
    >
      <div className={cell} style={{ width: COLUMN_WIDTH.wbs }}>{t("schedule.wbs")}</div>
      <div className={cell} style={{ width: COLUMN_WIDTH.activity }}>{t("schedule.activity")}</div>
      <div className={cn(cell, "justify-end")} style={{ width: COLUMN_WIDTH.duration }}>{t("schedule.duration")}</div>
      <div className={cn(cell, "justify-end")} style={{ width: COLUMN_WIDTH.start }}>{t("schedule.start")}</div>
      <div className={cn(cell, "justify-end")} style={{ width: COLUMN_WIDTH.end }}>{t("schedule.end")}</div>
      <div className={cell} style={{ width: COLUMN_WIDTH.owner }}>{t("schedule.owner")}</div>
      <div className={cell} style={{ width: COLUMN_WIDTH.predecessors }}>{t("schedule.predecessors")}</div>
      <div className={cell} style={{ width: COLUMN_WIDTH.site }}>{t("schedule.site")}</div>
      <div className={cn(cell, "justify-end")} style={{ width: COLUMN_WIDTH.progress }}>{t("schedule.progress")}</div>
    </div>
  );
}

// ── Une ligne ───────────────────────────────────────────────────────────────

function GridRow({
  task,
  row,
  active,
  editable,
  people,
  sites,
  saving,
  onActivate,
  onCommit,
  onAssign,
  onAttachSite,
  onDelete,
  t,
}: {
  task: BoardTask;
  row: number;
  active: Cell | null;
  editable: boolean;
  people: PersonOption[];
  sites: SiteChoice[];
  saving: boolean;
  onActivate: (cell: Cell) => void;
  onCommit: (row: number, column: BoardColumn, value: string | null, direction: CommitDirection) => void;
  onAssign: (task: BoardTask, userId: string | null) => void;
  onAttachSite: (task: BoardTask, siteId: string | null) => void;
  onDelete: (task: BoardTask) => void;
  t: (key: string, values?: Record<string, string>) => string;
}) {
  const isActive = (column: BoardColumn) => active?.row === row && active.column === column;
  const cellEditable = (column: BoardColumn) => editable && isCellEditable(task, column);

  return (
    <div
      className={cn(
        "flex",
        task.type === "group_header" && "bg-[var(--app-bg)]",
        row % 2 === 1 && task.type !== "group_header" && "bg-[color-mix(in_srgb,var(--app-bg)_45%,transparent)]",
        saving && "opacity-60",
      )}
      style={{ height: ROW_H }}
    >
      {/* WBS — lecture seule, c'est la clé fonctionnelle */}
      <div
        className="flex items-center border-r border-b border-[var(--border)] px-2 font-mono text-[11px] text-[var(--text-muted)]"
        style={{ width: COLUMN_WIDTH.wbs }}
      >
        <span className="truncate">{task.wbsCode}</span>
      </div>

      <BoardCell
        width={COLUMN_WIDTH.activity}
        editable={cellEditable("activity")}
        active={isActive("activity")}
        raw={task.activity}
        display={
          <span
            /* L'indentation rend la hiérarchie lisible sans colonne dédiée. */
            style={{ paddingLeft: task.depth * 14 }}
            className={cn(
              "block truncate",
              (task.type === "summary" || task.type === "group_header") && "font-semibold",
              task.type === "group_header" &&
                "text-[11px] uppercase tracking-wide text-[var(--text-muted)]",
            )}
          >
            {task.activity}
          </span>
        }
        onActivate={() => onActivate({ row, column: "activity" })}
        onCommit={(v, d) => onCommit(row, "activity", v, d)}
      />

      <BoardCell
        width={COLUMN_WIDTH.duration}
        align="right"
        inputMode="numeric"
        editable={cellEditable("duration")}
        active={isActive("duration")}
        raw={task.durationDays === null ? "" : String(task.durationDays)}
        title={
          task.durationDays === null
            ? undefined
            : t("schedule.durationTooltip", { weeks: String(daysToWeeks(task.durationDays)) })
        }
        display={
          task.durationDays === null ? (
            <span className="text-[var(--text-muted)]">—</span>
          ) : (
            <span className="tabular-nums">{task.durationDays}</span>
          )
        }
        onActivate={() => onActivate({ row, column: "duration" })}
        onCommit={(v, d) => onCommit(row, "duration", v, d)}
      />

      {/* Début — éditable en tant qu'ANCRE. Une valeur figée porte une épingle ;
          la vider rend la tâche à ses précédences. */}
      <BoardCell
        width={COLUMN_WIDTH.start}
        align="right"
        type="date"
        editable={cellEditable("start")}
        active={isActive("start")}
        raw={task.startAnchor ?? task.start ?? ""}
        title={driverHint(task, t)}
        display={
          <span className="tabular-nums">
            {task.startAnchor && (
              <span style={{ color: "var(--accent-2)" }} title={t("schedule.driverInput")}>
                ⚲{" "}
              </span>
            )}
            {formatPlanDate(task.start)}
            {task.drifted && (
              <span style={{ color: "var(--accent-2)" }} title={t("schedule.driftNote")}>
                {" "}●
              </span>
            )}
          </span>
        }
        onActivate={() => onActivate({ row, column: "start" })}
        onCommit={(v, d) => onCommit(row, "start", v, d)}
      />

      {/* Fin — jamais éditable : c'est début + durée, un résultat. */}
      <div
        className="flex items-center justify-end border-r border-b border-[var(--border)] px-2 text-sm tabular-nums"
        style={{ width: COLUMN_WIDTH.end }}
      >
        {formatPlanDate(task.end)}
      </div>

      <BoardCell
        width={COLUMN_WIDTH.owner}
        editable={cellEditable("owner")}
        active={isActive("owner")}
        raw={task.ownerId ?? ""}
        display={
          task.ownerName ? (
            <span className="truncate">{task.ownerName}</span>
          ) : (
            <span className="text-[var(--text-muted)]">{t("schedule.unassigned")}</span>
          )
        }
        onActivate={() => onActivate({ row, column: "owner" })}
        onCommit={() => onActivate({ row, column: "owner" })}
        renderEditor={({ close }) => (
          <select
            autoFocus
            className="h-full w-full rounded-sm border bg-[var(--surface)] px-1 text-sm outline-none"
            style={{ borderColor: "var(--focus)" }}
            value={task.ownerId ?? ""}
            onChange={(e) => onAssign(task, e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close("none");
            }}
            onBlur={() => close("none")}
          >
            <option value="">{t("schedule.unassigned")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName} — {p.roleCode}
              </option>
            ))}
          </select>
        )}
      />

      <BoardCell
        width={COLUMN_WIDTH.predecessors}
        editable={cellEditable("predecessors")}
        active={isActive("predecessors")}
        raw={task.predecessorCodes.join(", ")}
        title={t("schedule.predecessorsHint")}
        display={
          task.predecessorCodes.length === 0 ? (
            <span className="text-[var(--text-muted)]">—</span>
          ) : (
            <span className="truncate font-mono text-[11px]">
              {task.predecessorCodes.join(", ")}
            </span>
          )
        }
        onActivate={() => onActivate({ row, column: "predecessors" })}
        onCommit={(v, d) => onCommit(row, "predecessors", v, d)}
      />

      {/* Site — VIDE au chargement, et c'est correct : le planning source est
          au niveau sous-projet. On n'offre que les sites du sous-projet de la
          tâche, sinon on proposerait de rattacher un hall à l'autre projet. */}
      <BoardCell
        width={COLUMN_WIDTH.site}
        editable={cellEditable("site")}
        active={isActive("site")}
        raw={task.siteId ?? ""}
        title={task.siteCode === null ? t("schedule.siteHint") : undefined}
        display={
          task.siteCode ? (
            <span className="truncate font-mono text-[11px]">{task.siteCode}</span>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">
              {task.subproject ? t(`schedule.sub_${task.subproject}`) : "—"}
            </span>
          )
        }
        onActivate={() => onActivate({ row, column: "site" })}
        onCommit={() => onActivate({ row, column: "site" })}
        renderEditor={({ close }) => (
          <select
            autoFocus
            className="h-full w-full rounded-sm border bg-[var(--surface)] px-1 text-xs outline-none"
            style={{ borderColor: "var(--focus)" }}
            value={task.siteId ?? ""}
            onChange={(e) => onAttachSite(task, e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") close("none");
            }}
            onBlur={() => close("none")}
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
        )}
      />

      <div className="flex items-center" style={{ width: COLUMN_WIDTH.progress }}>
        <BoardCell
          width={COLUMN_WIDTH.progress - 26}
          align="right"
          inputMode="numeric"
          editable={cellEditable("progress")}
          active={isActive("progress")}
          raw={task.progressPct === null ? "" : String(task.progressPct)}
          display={
            task.progressPct === null ? (
              <span className="text-[var(--text-muted)]">—</span>
            ) : (
              <span className="tabular-nums">{`${task.progressPct}%`}</span>
            )
          }
          onActivate={() => onActivate({ row, column: "progress" })}
          onCommit={(v, d) => onCommit(row, "progress", v, d)}
        />
        {editable && (
          <IconButton
            label={t("schedule.deleteTask")}
            className="h-6 w-6 shrink-0 border-b border-[var(--border)]"
            onClick={() => {
              if (window.confirm(t("schedule.confirmDelete", { wbs: task.wbsCode }))) {
                onDelete(task);
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </IconButton>
        )}
      </div>
    </div>
  );
}

/** Explique d'où vient la date de début, sans obliger à déplier le calcul. */
function driverHint(
  task: BoardTask,
  t: (key: string, values?: Record<string, string>) => string,
): string {
  switch (task.driver) {
    case "predecessor":
      return t("schedule.driverPredecessor", { wbs: task.drivingPredecessor ?? "" });
    case "constraint":
      return t("schedule.driverConstraint");
    case "input":
      return t("schedule.driverInput");
    case "children":
      return t("schedule.driverChildren");
    case "project-start":
      return t("schedule.driverProjectStart");
    default:
      return "";
  }
}
