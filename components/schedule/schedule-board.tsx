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
//   • le MODÈLE VIT DANS LE NAVIGATEUR (use-board.ts) : un geste s'affiche
//     immédiatement, l'écriture suit sans qu'on l'attende ;
//   • annuler et rétablir au clavier, comme dans un tableur ;
//   • les précédences se saisissent en NUMÉROS DE LIGNE, renumérotés
//     automatiquement — comme sous MS Project ;
//   • pas de bouton « enregistrer » : valider une cellule écrit ;
//   • le brouillon de saisie vit DANS la cellule (board-cell.tsx), donc taper
//     ne redessine ni les autres lignes ni le SVG.
// ============================================================

import { useCallback, useMemo, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button, IconButton } from "@/components/ui/button";
import { formatPlanDate } from "@/lib/i18n/format";
import { daysToWeeks } from "@/lib/schedule/dates";
import { ROW_H } from "@/lib/gantt/layout";
import {
  descendantCount,
  isCollapsible,
  visibleTasks,
  type BoardModel,
} from "@/lib/schedule/board-model";
import type { ScaleUnit } from "@/lib/gantt/scale";
import { cn } from "@/lib/cn";
import { createTask } from "@/app/(app)/schedule/actions";
import {
  COLUMN_WIDTH,
  gridWidth,
  isCellEditable,
  isStartEditable,
  renderOrder,
  RIGHT_ALIGNED,
  visibleColumns,
  type BoardColumn,
  type BoardTask,
  type ContractChoice,
  type PersonOption,
  type SiteChoice,
} from "./board-types";
import { BoardCell, type CommitDirection } from "./board-cell";
import { GanttPane, HEAD_H } from "./gantt-pane";
import { NewTaskModal } from "./new-task-modal";
import { TaskForm } from "./task-form";
import { useBoard } from "./use-board";

interface Cell {
  row: number;
  column: BoardColumn;
}

export function ScheduleBoard({
  initial,
  people,
  sites,
  contracts,
  scenarioCode,
  planId,
  scale,
  today,
  bufferStart,
  deadline,
  locale,
  compact,
  visibleIds,
}: {
  initial: BoardModel;
  people: PersonOption[];
  sites: SiteChoice[];
  contracts: ContractChoice[];
  scenarioCode: string;
  planId: string;
  scale: ScaleUnit;
  today: string;
  bufferStart: string | null;
  deadline: string | null;
  locale: "en" | "sq";
  compact: boolean;
  /**
   * Identifiants retenus par les filtres de la barre d'outils, ou `null` si
   * aucun filtre n'est posé.
   *
   * Le filtre est une affaire d'AFFICHAGE, pas de modèle : le modèle porte
   * toujours le plan entier. Sinon les numéros de ligne se renuméroteraient
   * selon le filtre — le numéro 3 ne désignerait plus la même tâche d'une vue
   * à l'autre — et les précédences pointant hors du filtre disparaîtraient de
   * la saisie.
   */
  visibleIds: string[] | null;
}) {
  const t = useT();
  const { can } = usePermissions();
  const editable = can("task.write");

  const board = useBoard({ initial, scenarioCode, editable });

  const [active, setActive] = useState<Cell | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<string | null>(null);

  const columns = useMemo(() => visibleColumns(compact), [compact]);

  // La corbeille et le crayon vivent dans une colonne d'actions propre : les
  // glisser dans la colonne d'avancement les faisait disparaître avec elle.
  const actionsWidth = editable ? 52 : 0;
  const paneWidth = useMemo(() => gridWidth(columns, actionsWidth), [columns, actionsWidth]);

  /** Lignes affichées : l'ordre du modèle, moins le replié, moins le filtré. */
  const tasks = useMemo(() => {
    const open = visibleTasks(board.model.tasks, collapsed);
    if (visibleIds === null) return open;
    const keep = new Set(visibleIds);
    return open.filter((task) => keep.has(task.id));
  }, [board.model.tasks, collapsed, visibleIds]);

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsed(
      new Set(
        board.model.tasks
          .filter((task) => isCollapsible(board.model.tasks, task))
          .map((task) => task.id),
      ),
    );
  }, [board.model.tasks]);

  /** Déplace le focus après validation, en sautant les cellules non éditables. */
  const move = useCallback(
    (from: Cell, direction: CommitDirection) => {
      if (direction === "none") {
        setActive(null);
        return;
      }
      const editableAt = (row: number, column: BoardColumn) =>
        column === "start"
          ? isStartEditable(tasks[row], board.hasPredecessor(tasks[row].id))
          : isCellEditable(tasks[row], column);

      if (direction === "down") {
        for (let i = from.row + 1; i < tasks.length; i++) {
          if (editableAt(i, from.column)) {
            setActive({ row: i, column: from.column });
            return;
          }
        }
        setActive(null);
        return;
      }
      const index = columns.indexOf(from.column);
      const next = columns.slice(index + 1).find((c) => editableAt(from.row, c));
      if (next) {
        setActive({ row: from.row, column: next });
        return;
      }
      for (let i = from.row + 1; i < tasks.length; i++) {
        const first = columns.find((c) => editableAt(i, c));
        if (first) {
          setActive({ row: i, column: first });
          return;
        }
      }
      setActive(null);
    },
    [tasks, columns, board],
  );

  const commitCell = useCallback(
    (row: number, column: BoardColumn, value: string | null, direction: CommitDirection) => {
      const task = tasks[row];
      if (value === null) {
        if (direction === "none") setActive(null);
        else move({ row, column }, direction);
        return;
      }
      if (board.editCell(task.id, column, value)) move({ row, column }, direction);
    },
    [tasks, board, move],
  );

  const errorText = board.error
    ? (() => {
        const label = t(`schedule.${board.error.code}`);
        const text = label === `schedule.${board.error.code}` ? board.error.code : label;
        return board.error.detail ? `${text} — ${board.error.detail}` : text;
      })()
    : null;

  const editingTask = editing ? board.model.tasks.find((task) => task.id === editing) : null;

  // Une flèche dont une extrémité est repliée ou filtrée n'a nulle part où
  // aboutir : on ne la dessine pas plutôt que de la faire pointer dans le vide.
  const links = useMemo(() => {
    const shownIds = new Set(tasks.map((task) => task.id));
    return board.model.dependencies.filter(
      (d) => shownIds.has(d.predecessorId) && shownIds.has(d.successorId),
    );
  }, [tasks, board.model.dependencies]);

  return (
    <div className="flex flex-col gap-2">
      {/* ── Barre d'action ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] p-2">
        {editable && (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            {t("schedule.addTask")}
          </Button>
        )}

        {editable && (
          <span className="inline-flex items-center gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={!board.canUndo}
              title={t("schedule.undoHint")}
              onClick={board.undo}
            >
              {t("schedule.undo")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!board.canRedo}
              title={t("schedule.redoHint")}
              onClick={board.redo}
            >
              {t("schedule.redo")}
            </Button>
          </span>
        )}

        <span className="inline-flex items-center gap-1">
          <Button size="sm" variant="quiet" onClick={collapseAll}>
            {t("schedule.collapseAll")}
          </Button>
          <Button size="sm" variant="quiet" onClick={() => setCollapsed(new Set())}>
            {t("schedule.expandAll")}
          </Button>
        </span>

        <span className="text-xs text-[var(--text-muted)]">
          {tasks.length === board.model.tasks.length
            ? t("schedule.rowCount", { count: String(tasks.length) })
            : t("schedule.rowCountPartial", {
                count: String(tasks.length),
                total: String(board.model.tasks.length),
              })}
        </span>

        {board.pending && (
          <span className="text-xs" style={{ color: "var(--accent)" }}>
            {t("common.saving")}
          </span>
        )}
      </div>

      {/* Un cycle rend le planning incalculable : on le dit, on ne vide pas. */}
      {board.model.cycle !== null && (
        <p
          role="alert"
          className="mx-2 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {t("schedule.cycleNotice")}
        </p>
      )}

      {errorText && (
        <p
          role="alert"
          className="mx-2 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          <span>{errorText}</span>
          <button type="button" onClick={board.clearError} className="shrink-0 underline">
            {t("common.close")}
          </button>
        </p>
      )}

      {/* ── Les deux volets, un seul défilement vertical ──────────────── */}
      <div className="flex max-h-[72vh] overflow-y-auto">
        <div
          className="sticky left-0 z-10 shrink-0 bg-[var(--surface)]"
          style={{ width: paneWidth }}
        >
          <GridHeader t={t} columns={columns} actionsWidth={actionsWidth} />
          {tasks.map((task, row) => (
            <GridRow
              key={task.id}
              task={task}
              row={row}
              rowNumber={board.rows.get(task.id) ?? row + 1}
              active={active}
              editable={editable}
              columns={columns}
              actionsWidth={actionsWidth}
              people={people}
              sites={sites}
              contracts={contracts}
              predecessorLabel={board.predecessorLabel(task.id)}
              hasPredecessor={board.hasPredecessor(task.id)}
              collapsible={isCollapsible(board.model.tasks, task)}
              collapsed={collapsed.has(task.id)}
              hiddenCount={
                collapsed.has(task.id) ? descendantCount(board.model.tasks, task.id) : 0
              }
              saving={board.savingId === task.id}
              dragging={dragging === task.id}
              onToggleCollapse={toggleCollapse}
              onActivate={setActive}
              onCommit={commitCell}
              onAssign={board.assign}
              onMove={board.move}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onDrop={(beforeId) => {
                if (dragging && dragging !== beforeId) board.dropOn(dragging, beforeId);
                setDragging(null);
              }}
              onEdit={setEditing}
              t={t}
            />
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-x-auto">
          <GanttPane
            tasks={tasks}
            dependencies={links}
            scale={scale}
            today={today}
            bufferStart={bufferStart}
            deadline={deadline}
            locale={locale}
            labels={{
              buffer: t("gantt.buffer"),
              deadline: t("gantt.deadline"),
              today: t("gantt.today"),
              unreported: t("gantt.unreported"),
              late: t("gantt.late"),
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
          tasks={board.model.tasks}
          onCreate={async (input) => {
            const result = await createTask(input);
            return result.ok;
          }}
        />
      )}

      {editingTask && (
        <TaskForm
          task={editingTask}
          rowNumber={board.rows.get(editingTask.id) ?? 0}
          predecessorLabel={board.predecessorLabel(editingTask.id)}
          hasPredecessor={board.hasPredecessor(editingTask.id)}
          people={people}
          sites={sites}
          contracts={contracts}
          onClose={() => setEditing(null)}
          onSave={(fields) => board.saveFields(editingTask.id, fields)}
          onDelete={() => board.remove(editingTask.id)}
        />
      )}
    </div>
  );
}

// ── En-tête de la grille ────────────────────────────────────────────────────

function GridHeader({
  t,
  columns,
  actionsWidth,
}: {
  t: (k: string) => string;
  columns: BoardColumn[];
  actionsWidth: number;
}) {
  const cell =
    "flex shrink-0 items-center border-r border-b border-[var(--border)] px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]";
  return (
    <div className="sticky top-0 z-20 flex bg-[var(--app-bg)]" style={{ height: HEAD_H }}>
      <div
        className={cn(cell, "justify-end")}
        style={{ width: COLUMN_WIDTH.rowNo }}
        title={t("schedule.rowNoHint")}
      >
        #
      </div>
      {renderOrder(columns).map((column) => (
        <div
          key={column}
          className={cn(cell, RIGHT_ALIGNED.has(column) && "justify-end")}
          style={{ width: COLUMN_WIDTH[column] }}
        >
          {t(`schedule.${column}`)}
        </div>
      ))}
      {actionsWidth > 0 && (
        <div className={cell} style={{ width: actionsWidth }} aria-hidden="true" />
      )}
    </div>
  );
}

// ── Une ligne ───────────────────────────────────────────────────────────────

interface RowProps {
  task: BoardTask;
  row: number;
  rowNumber: number;
  active: Cell | null;
  editable: boolean;
  columns: BoardColumn[];
  actionsWidth: number;
  people: PersonOption[];
  sites: SiteChoice[];
  contracts: ContractChoice[];
  predecessorLabel: string;
  hasPredecessor: boolean;
  collapsible: boolean;
  collapsed: boolean;
  hiddenCount: number;
  saving: boolean;
  dragging: boolean;
  onToggleCollapse: (taskId: string) => void;
  onActivate: (cell: Cell) => void;
  onCommit: (
    row: number,
    column: BoardColumn,
    value: string | null,
    direction: CommitDirection,
  ) => void;
  onAssign: (
    taskId: string,
    field: "ownerId" | "siteId" | "contractId",
    value: string | null,
  ) => void;
  onMove: (taskId: string, direction: -1 | 1) => void;
  onDragStart: (taskId: string) => void;
  onDragEnd: () => void;
  onDrop: (beforeTaskId: string) => void;
  onEdit: (taskId: string) => void;
  t: (key: string, values?: Record<string, string>) => string;
}

function GridRow(props: RowProps) {
  const {
    task,
    row,
    rowNumber,
    active,
    editable,
    columns,
    actionsWidth,
    people,
    sites,
    contracts,
    predecessorLabel,
    hasPredecessor,
    collapsible,
    collapsed,
    hiddenCount,
    saving,
    dragging,
    onToggleCollapse,
    onActivate,
    onCommit,
    onAssign,
    onMove,
    onDragStart,
    onDragEnd,
    onDrop,
    onEdit,
    t,
  } = props;

  const isActive = (column: BoardColumn) => active?.row === row && active.column === column;
  const shown = (column: BoardColumn) => columns.includes(column);
  const cellEditable = (column: BoardColumn) =>
    editable &&
    (column === "start"
      ? isStartEditable(task, hasPredecessor)
      : isCellEditable(task, column));

  const selectEditor = (
    value: string | null,
    field: "ownerId" | "siteId" | "contractId",
    options: { id: string; label: string }[],
    emptyLabel: string,
    small = false,
  ) => (
    <select
      className={cn(
        "h-full w-full rounded-sm border bg-[var(--surface)] px-1 outline-none",
        small ? "text-xs" : "text-sm",
      )}
      style={{ borderColor: "var(--focus)" }}
      value={value ?? ""}
      onChange={(e) => onAssign(task.id, field, e.target.value || null)}
    >
      <option value="">{emptyLabel}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <div
      className={cn(
        "flex",
        task.type === "group_header" && "bg-[var(--app-bg)]",
        row % 2 === 1 && task.type !== "group_header" && "bg-[color-mix(in_srgb,var(--app-bg)_45%,transparent)]",
        saving && "opacity-60",
        dragging && "opacity-40",
      )}
      style={{ height: ROW_H }}
      /* Glisser-déposer natif : aucune dépendance, et le clavier garde ses
         propres boutons de déplacement pour ceux qui ne peuvent pas glisser. */
      draggable={editable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        if (editable) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(task.id);
      }}
    >
      {/* Numéro de ligne — renuméroté automatiquement, c'est la clé des
          précédences. Lecture seule : il DÉRIVE de l'ordre. */}
      <div
        className="flex shrink-0 items-center justify-end border-r border-b border-[var(--border)] px-2 text-[11px] tabular-nums text-[var(--text-muted)]"
        style={{ width: COLUMN_WIDTH.rowNo }}
        title={task.wbsCode}
      >
        {rowNumber}
      </div>

      <BoardCell
        width={COLUMN_WIDTH.activity}
        editable={cellEditable("activity")}
        active={isActive("activity")}
        raw={task.activity}
        display={
          <span
            className="flex items-center gap-1"
            style={{ paddingLeft: task.depth * 12 }}
          >
            {/* Chevron de repliement : seulement là où il masque quelque chose. */}
            {collapsible ? (
              <button
                type="button"
                aria-expanded={!collapsed}
                aria-label={t(collapsed ? "schedule.expandRow" : "schedule.collapseRow")}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(task.id);
                }}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--border)]"
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  aria-hidden="true"
                  style={{
                    transform: collapsed ? "rotate(-90deg)" : undefined,
                    transition: "transform 120ms",
                  }}
                >
                  <path d="M1 3 L5 7 L9 3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            ) : (
              <span className="w-4 shrink-0" aria-hidden="true" />
            )}
            <span
              className={cn(
                "truncate",
                (task.type === "summary" || task.type === "group_header") && "font-semibold",
                task.type === "group_header" &&
                  "text-[11px] uppercase tracking-wide text-[var(--text-muted)]",
              )}
            >
              {task.activity}
            </span>
            {hiddenCount > 0 && (
              <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                {t("schedule.hiddenCount", { count: String(hiddenCount) })}
              </span>
            )}
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

      {/* Début — éditable SEULEMENT sans prédécesseur. Avec un lien fin-début,
          la date est un résultat : la maillon suivant commence où le précédent
          finit, automatiquement. */}
      <BoardCell
        width={COLUMN_WIDTH.start}
        align="right"
        type="date"
        editable={cellEditable("start")}
        active={isActive("start")}
        raw={task.startAnchor ?? task.start ?? ""}
        title={
          hasPredecessor
            ? t("schedule.startDrivenBy", { rows: predecessorLabel })
            : driverHint(task, t)
        }
        display={
          <span className="tabular-nums">
            {hasPredecessor && (
              <span className="text-[var(--text-muted)]" aria-hidden="true">
                ⇥{" "}
              </span>
            )}
            {task.startAnchor && !hasPredecessor && (
              <span style={{ color: "var(--accent-2)" }} title={t("schedule.driverInput")}>
                ⚲{" "}
              </span>
            )}
            {formatPlanDate(task.start)}
          </span>
        }
        onActivate={() => onActivate({ row, column: "start" })}
        onCommit={(v, d) => onCommit(row, "start", v, d)}
      />

      {/* Fin — jamais éditable : c'est début + durée, un résultat. */}
      <div
        className="flex shrink-0 items-center justify-end border-r border-b border-[var(--border)] px-2 text-sm tabular-nums"
        style={{ width: COLUMN_WIDTH.end }}
      >
        {formatPlanDate(task.end)}
      </div>

      {shown("predecessors") && (
        <BoardCell
          width={COLUMN_WIDTH.predecessors}
          editable={cellEditable("predecessors")}
          active={isActive("predecessors")}
          raw={predecessorLabel}
          title={t("schedule.predecessorsHint")}
          display={
            predecessorLabel === "" ? (
              <span className="text-[var(--text-muted)]">—</span>
            ) : (
              <span className="truncate tabular-nums text-[12px]">{predecessorLabel}</span>
            )
          }
          onActivate={() => onActivate({ row, column: "predecessors" })}
          onCommit={(v, d) => onCommit(row, "predecessors", v, d)}
        />
      )}

      {shown("owner") && (
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
          renderEditor={() =>
            selectEditor(
              task.ownerId,
              "ownerId",
              people.map((p) => ({ id: p.id, label: `${p.fullName} — ${p.roleCode}` })),
              t("schedule.unassigned"),
            )
          }
        />
      )}

      {shown("contract") && (
        <BoardCell
          width={COLUMN_WIDTH.contract}
          editable={cellEditable("contract")}
          active={isActive("contract")}
          raw={task.contractId ?? ""}
          title={t("schedule.contractHint")}
          display={
            task.contractCode ? (
              <span className="truncate font-mono text-[11px]">{task.contractCode}</span>
            ) : (
              <span className="text-[var(--text-muted)]">—</span>
            )
          }
          onActivate={() => onActivate({ row, column: "contract" })}
          onCommit={() => onActivate({ row, column: "contract" })}
          renderEditor={() =>
            selectEditor(
              task.contractId,
              "contractId",
              contracts.map((c) => ({ id: c.id, label: `${c.contractCode} — ${c.name}` })),
              t("common.none"),
              true,
            )
          }
        />
      )}

      {shown("site") && (
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
          renderEditor={() =>
            selectEditor(
              task.siteId,
              "siteId",
              sites
                .filter((s) => task.subproject === null || s.subproject === task.subproject)
                .map((s) => ({ id: s.id, label: `${s.siteCode} — ${s.name}` })),
              t("schedule.allSites"),
              true,
            )
          }
        />
      )}

      {shown("progress") && (
        <BoardCell
          width={COLUMN_WIDTH.progress}
          align="right"
          inputMode="numeric"
          editable={cellEditable("progress")}
          active={isActive("progress")}
          raw={task.progressPct === null ? "" : String(task.progressPct)}
          title={t("schedule.progressHint")}
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
      )}

      {/* Actions : monter, descendre, ouvrir le formulaire. */}
      {actionsWidth > 0 && (
        <div
          className="flex shrink-0 items-center border-b border-[var(--border)]"
          style={{ width: actionsWidth }}
        >
          <span className="flex flex-col">
            <button
              type="button"
              aria-label={t("schedule.moveUp")}
              onClick={() => onMove(task.id, -1)}
              className="flex h-[13px] w-4 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <svg width="8" height="6" viewBox="0 0 10 6" aria-hidden="true">
                <path d="M1 5 L5 1 L9 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label={t("schedule.moveDown")}
              onClick={() => onMove(task.id, 1)}
              className="flex h-[13px] w-4 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              <svg width="8" height="6" viewBox="0 0 10 6" aria-hidden="true">
                <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </span>
          <IconButton
            label={t("schedule.editTaskLabel")}
            className="h-6 w-6 shrink-0"
            onClick={() => onEdit(task.id)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 20h4l10-10-4-4L4 16v4z" />
            </svg>
          </IconButton>
        </div>
      )}
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
