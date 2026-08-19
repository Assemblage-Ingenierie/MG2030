"use client";

// ============================================================
// components/schedule/task-grid.tsx — grille de saisie de type tableur.
//
// ⚠ C'EST L'ÉCRAN QUI DÉCIDE DU SORT DU PROJET.
//
// « Si la saisie est plus lente que sous Excel, la PIU retournera à Excel.
//   L'ergonomie de saisie du planning primera toujours sur l'esthétique des
//   restitutions. » — brief §2
//
// D'où les partis pris :
//   • navigation ENTIÈREMENT au clavier — flèches, Tab, Entrée, Échap ;
//   • une cellule en lecture est un <button>, pas un <input> : 27 champs de
//     saisie montés en permanence coûteraient cher et voleraient le focus ;
//   • pas de bouton « enregistrer » : la validation d'une cellule écrit ;
//   • Échap annule et rend la valeur d'origine, toujours ;
//   • la ligne modifiée reste visible pendant le recalcul, jamais de saut.
//
// Patron repris du dépôt de charte (docs/UI_TOKENS.md §6, cellule éditable).
// ============================================================

import { useCallback, useRef, useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { formatPlanDate } from "@/lib/i18n/format";
import { daysToWeeks } from "@/lib/schedule/dates";
import { cn } from "@/lib/cn";
import { setTaskActivity, setTaskDuration, setTaskProgress } from "@/app/(app)/schedule/actions";

export interface GridTask {
  id: string;
  wbsCode: string;
  type: "task" | "summary" | "milestone" | "group_header";
  activity: string;
  durationDays: number | null;
  start: string | null;
  end: string | null;
  progressPct: number | null;
  contractCode: string | null;
  depth: number;
  drifted: boolean;
  driver: string | null;
  drivingPredecessor: string | null;
}

/** Colonnes éditables, dans l'ordre de tabulation. */
type Column = "activity" | "duration" | "progress";
const COLUMNS: Column[] = ["activity", "duration", "progress"];

interface Cell {
  row: number;
  column: Column;
}

export function TaskGrid({
  tasks,
  scenarioCode,
}: {
  tasks: GridTask[];
  scenarioCode: string;
}) {
  const t = useT();
  const { can } = usePermissions();
  const editable = can("task.write");

  const [editing, setEditing] = useState<Cell | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  /** Un intertitre ne porte ni durée ni avancement : il n'est pas éditable. */
  const cellEditable = useCallback(
    (task: GridTask, column: Column): boolean => {
      if (!editable) return false;
      if (task.type === "group_header") return column === "activity";
      if (task.type === "summary" || task.type === "milestone") {
        // Un récapitulatif tient ses dates de ses enfants : sa durée n'est pas
        // une entrée. La modifier n'aurait aucun effet, donc on ne la propose pas.
        return column === "activity";
      }
      return true;
    },
    [editable],
  );

  const currentValue = (task: GridTask, column: Column): string => {
    if (column === "activity") return task.activity;
    if (column === "duration") return task.durationDays === null ? "" : String(task.durationDays);
    return task.progressPct === null ? "" : String(task.progressPct);
  };

  function beginEdit(row: number, column: Column) {
    const task = tasks[row];
    if (!task || !cellEditable(task, column)) return;
    setEditing({ row, column });
    setDraft(currentValue(task, column));
    setError(null);
    // Le focus est posé après le rendu de l'<input>.
    requestAnimationFrame(() => inputRef.current?.select());
  }

  function cancelEdit() {
    setEditing(null);
    setDraft("");
    setError(null);
  }

  /** Valide, écrit, puis déplace le focus selon la touche utilisée. */
  function commit(next: "down" | "right" | "none") {
    if (!editing) return;
    const task = tasks[editing.row];
    const column = editing.column;
    const value = draft;
    const unchanged = value === currentValue(task, column);

    const move = () => {
      if (next === "down") {
        const target = nextEditableRow(tasks, editing.row, column, cellEditable);
        if (target !== null) beginEdit(target, column);
        else setEditing(null);
      } else if (next === "right") {
        const idx = COLUMNS.indexOf(column);
        const following = COLUMNS.slice(idx + 1).find((c) => cellEditable(task, c));
        if (following) beginEdit(editing.row, following);
        else {
          const target = nextEditableRow(tasks, editing.row, COLUMNS[0], cellEditable);
          if (target !== null) beginEdit(target, COLUMNS[0]);
          else setEditing(null);
        }
      } else {
        setEditing(null);
      }
    };

    // Valeur inchangée : on ne déclenche NI écriture NI recalcul. Traverser la
    // grille au clavier pour la relire ne doit rien coûter.
    if (unchanged) {
      move();
      return;
    }

    startTransition(async () => {
      let result;
      if (column === "activity") {
        result = await setTaskActivity(task.id, value);
      } else if (column === "duration") {
        const parsed = value.trim() === "" ? null : Number(value);
        if (parsed !== null && !Number.isInteger(parsed)) {
          setError(t("schedule.invalidDuration"));
          return;
        }
        result = await setTaskDuration(task.id, scenarioCode, parsed);
      } else {
        const parsed = value.trim() === "" ? null : Number(value);
        result = await setTaskProgress(task.id, parsed);
      }

      if (!result.ok) {
        setError(t(`schedule.${result.error}`, {}) || result.error || "");
        return;
      }
      setError(null);
      move();
    });
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (!editing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commit("down");
    } else if (event.key === "Tab") {
      event.preventDefault();
      commit("right");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      <div className={cn("overflow-x-auto", pending && "opacity-70")}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--app-bg)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              <th scope="col" className="px-3 py-2 w-24">{t("schedule.wbs")}</th>
              <th scope="col" className="px-3 py-2">{t("schedule.activity")}</th>
              <th scope="col" className="px-3 py-2 text-right w-28">{t("schedule.duration")}</th>
              <th scope="col" className="px-3 py-2 text-right w-28">{t("schedule.start")}</th>
              <th scope="col" className="px-3 py-2 text-right w-28">{t("schedule.end")}</th>
              <th scope="col" className="px-3 py-2 text-right w-24">{t("schedule.progress")}</th>
              <th scope="col" className="px-3 py-2 w-24">{t("schedule.contract")}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, row) => {
              const isHeader = task.type === "group_header";
              const isSummary = task.type === "summary";
              return (
                <tr
                  key={task.id}
                  className={cn(
                    "border-b border-[var(--border)]",
                    isHeader && "bg-[var(--app-bg)]",
                    !isHeader && "hover:bg-[var(--app-bg)]",
                  )}
                >
                  <td className="px-3 py-1.5 font-mono text-xs text-[var(--text-muted)]">
                    {task.wbsCode}
                  </td>

                  <EditableCell
                    active={editing?.row === row && editing.column === "activity"}
                    editable={cellEditable(task, "activity")}
                    onBegin={() => beginEdit(row, "activity")}
                    inputRef={inputRef}
                    draft={draft}
                    setDraft={setDraft}
                    onKeyDown={onKeyDown}
                    onBlur={() => commit("none")}
                  >
                    <span
                      /* L'indentation rend la hiérarchie lisible sans colonne
                         supplémentaire. 16 px par niveau, comme un explorateur. */
                      style={{ paddingLeft: `${task.depth * 16}px` }}
                      className={cn(
                        "block",
                        (isHeader || isSummary) && "font-semibold",
                        isHeader && "uppercase text-xs tracking-wide text-[var(--text-muted)]",
                      )}
                    >
                      {task.activity}
                    </span>
                  </EditableCell>

                  <EditableCell
                    align="right"
                    active={editing?.row === row && editing.column === "duration"}
                    editable={cellEditable(task, "duration")}
                    onBegin={() => beginEdit(row, "duration")}
                    inputRef={inputRef}
                    draft={draft}
                    setDraft={setDraft}
                    onKeyDown={onKeyDown}
                    onBlur={() => commit("none")}
                    inputMode="numeric"
                  >
                    {task.durationDays === null ? (
                      <span className="text-[var(--text-muted)]">—</span>
                    ) : (
                      <span className="tabular-nums">
                        {task.durationDays}
                        {/* La conversion jours = semaines x 7 est la convention
                            du fichier Excel : on montre les deux, la PIU
                            raisonne en semaines. */}
                        <span className="ml-1 text-[11px] text-[var(--text-muted)]">
                          {`(${daysToWeeks(task.durationDays)} w)`}
                        </span>
                      </span>
                    )}
                  </EditableCell>

                  <td
                    className="px-3 py-1.5 text-right tabular-nums"
                    title={driverHint(task, t)}
                  >
                    {formatPlanDate(task.start)}
                    {task.drifted && (
                      <span
                        className="ml-1"
                        style={{ color: "var(--accent-2)" }}
                        title={t("schedule.driftNote")}
                      >
                        ●
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatPlanDate(task.end)}
                  </td>

                  <EditableCell
                    align="right"
                    active={editing?.row === row && editing.column === "progress"}
                    editable={cellEditable(task, "progress")}
                    onBegin={() => beginEdit(row, "progress")}
                    inputRef={inputRef}
                    draft={draft}
                    setDraft={setDraft}
                    onKeyDown={onKeyDown}
                    onBlur={() => commit("none")}
                    inputMode="numeric"
                  >
                    {task.progressPct === null ? (
                      <span className="text-[var(--text-muted)]">—</span>
                    ) : (
                      <span className="tabular-nums">{`${task.progressPct}%`}</span>
                    )}
                  </EditableCell>

                  <td className="px-3 py-1.5 text-xs text-[var(--text-muted)]">
                    {task.contractCode ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-1 text-xs text-[var(--text-muted)]">{t("schedule.keyboardHint")}</p>
    </div>
  );
}

/** Cellule : `<button>` en lecture, `<input>` en édition. */
function EditableCell({
  active,
  editable,
  onBegin,
  inputRef,
  draft,
  setDraft,
  onKeyDown,
  onBlur,
  align = "left",
  inputMode,
  children,
}: {
  active: boolean;
  editable: boolean;
  onBegin: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  draft: string;
  setDraft: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  align?: "left" | "right";
  inputMode?: "numeric" | "text";
  children: React.ReactNode;
}) {
  if (active) {
    return (
      <td className="px-1 py-0.5">
        <input
          ref={inputRef}
          value={draft}
          inputMode={inputMode}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn(
            "block w-full rounded-sm border bg-[var(--surface)] px-2 py-1 text-sm outline-none",
            align === "right" && "text-right tabular-nums",
          )}
          style={{ borderColor: "var(--focus)" }}
        />
      </td>
    );
  }

  if (!editable) {
    return (
      <td className={cn("px-3 py-1.5", align === "right" && "text-right")}>{children}</td>
    );
  }

  return (
    <td className={cn("p-0", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onBegin}
        onFocus={onBegin}
        className={cn(
          "block w-full cursor-text px-3 py-1.5 text-sm transition-colors hover:bg-[var(--border)]",
          align === "right" ? "text-right" : "text-left",
        )}
      >
        {children}
      </button>
    </td>
  );
}

/** Ligne éditable suivante sur la même colonne. `null` si on est en bas. */
function nextEditableRow(
  tasks: GridTask[],
  from: number,
  column: Column,
  editable: (task: GridTask, column: Column) => boolean,
): number | null {
  for (let i = from + 1; i < tasks.length; i++) {
    if (editable(tasks[i], column)) return i;
  }
  return null;
}

/** Explique d'où vient la date de début. Rend le calcul lisible sans le déplier. */
function driverHint(task: GridTask, t: (k: string, v?: Record<string, string>) => string): string {
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
