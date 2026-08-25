"use client";

// ============================================================
// components/schedule/use-board.ts — état du plan de charge.
//
// Trois responsabilités, et une seule idée qui les relie : LE MODÈLE VIT ICI,
// dans le navigateur.
//
//  1. AFFICHER SANS ATTENDRE. Chaque geste applique l'opération au modèle et
//     recalcule tout le planning localement — le moteur est pur, il tourne
//     aussi bien ici qu'au serveur. L'écriture part ensuite, sans qu'on
//     l'attende. C'était la cause du lag : on attendait un aller-retour vers
//     Paris, une écriture, un recalcul serveur, puis un re-rendu complet de la
//     page Next, pour voir une date bouger.
//
//  2. ANNULER ET RÉTABLIR. Puisque chaque geste produit un état, il suffit de
//     les empiler. Chaque entrée porte son changement ET son inverse, de sorte
//     qu'annuler écrive vraiment en base plutôt que de mentir à l'écran.
//
//  3. REVENIR EN ARRIÈRE SI LA BASE REFUSE. Un refus — cycle, droits, réseau —
//     restaure l'état précédent et affiche le motif. Sans cela, l'affichage
//     optimiste deviendrait un affichage faux.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  isDrivenByPredecessor,
  moveTask,
  moveTaskTo,
  ordered,
  predecessorRows,
  removeTask,
  rowNumbers,
  setField,
  setPredecessorRows,
  type BoardModel,
  type ModelTask,
} from "@/lib/schedule/board-model";
import { applyBoardChange, type BoardChange } from "@/app/(app)/schedule/board-actions";
import type { ContractChoice, PersonOption } from "./board-types";

/** Une entrée de l'historique : l'état d'avant, celui d'après, et les deux écritures. */
interface Entry {
  before: BoardModel;
  after: BoardModel;
  redo: BoardChange;
  undo: BoardChange;
}

export interface BoardError {
  code: string;
  detail?: string;
}

const orderOf = (model: BoardModel) =>
  ordered(model.tasks).map((t, i) => ({ id: t.id, sortOrder: i * 10 }));

const predecessorIdsOf = (model: BoardModel, taskId: string) =>
  model.dependencies.filter((d) => d.successorId === taskId).map((d) => d.predecessorId);

export function useBoard({
  initial,
  scenarioCode,
  editable,
  people,
  contracts,
}: {
  initial: BoardModel;
  scenarioCode: string;
  editable: boolean;
  /**
   * Pour dériver `ownerName` / `contractCode` À L'AFFECTATION, sans
   * aller-retour serveur. Le modèle ne porte que les IDENTIFIANTS
   * (`ownerId`, `contractId`) ; les libellés affichés sont des champs à part,
   * et rien ne les mettait à jour quand on choisissait un responsable ou un
   * marché — la grille affichait donc l'ANCIENNE valeur jusqu'au rechargement.
   */
  people: PersonOption[];
  contracts: ContractChoice[];
}) {
  const [model, setModel] = useState(initial);
  const [past, setPast] = useState<Entry[]>([]);
  const [future, setFuture] = useState<Entry[]>([]);
  const [error, setError] = useState<BoardError | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Le modèle initial change quand on bascule de scénario ou de filtre : on
  // repart de zéro, historique compris. Rétablir un geste posé sur un autre
  // périmètre n'aurait aucun sens.
  const initialRef = useRef(initial);
  useEffect(() => {
    if (initialRef.current !== initial) {
      initialRef.current = initial;
      setModel(initial);
      setPast([]);
      setFuture([]);
      setError(null);
    }
  }, [initial]);

  const rows = useMemo(() => rowNumbers(model.tasks), [model.tasks]);

  /**
   * Applique un geste : affichage immédiat, écriture en arrière-plan.
   *
   * `undo` est calculé AVANT l'opération, depuis l'état d'origine — c'est le
   * seul moment où l'ancienne valeur est encore disponible.
   */
  const commit = useCallback(
    (next: BoardModel, redo: BoardChange, undo: BoardChange, touchedId: string | null) => {
      const before = model;
      setModel(next);
      setPast((p) => [...p, { before, after: next, redo, undo }]);
      setFuture([]);
      setError(null);

      startTransition(async () => {
        setSavingId(touchedId);
        const result = await applyBoardChange(scenarioCode, redo);
        setSavingId(null);
        if (!result.ok) {
          // La base a refusé : on revient à l'état d'avant plutôt que de laisser
          // l'écran affirmer une chose que la base ignore.
          setModel(before);
          setPast((p) => p.slice(0, -1));
          setError({ code: result.error ?? "writeFailed", detail: result.detail });
        }
      });
    },
    [model, scenarioCode],
  );

  // ── Édition d'une cellule ─────────────────────────────────────────────────

  const editCell = useCallback(
    (taskId: string, column: string, raw: string): boolean => {
      if (!editable) return false;
      const task = model.tasks.find((t) => t.id === taskId);
      if (!task) return false;

      const text = raw.trim();
      const num = text === "" ? null : Number(text);

      switch (column) {
        case "activity": {
          if (text === "") {
            setError({ code: "emptyActivity" });
            return false;
          }
          if (text === task.activity) return true;
          commit(
            setField(model, taskId, { activity: text }),
            { kind: "activity", taskId, value: text },
            { kind: "activity", taskId, value: task.activity },
            taskId,
          );
          return true;
        }

        case "duration": {
          if (num !== null && (!Number.isInteger(num) || num < 0)) {
            setError({ code: "invalidDuration" });
            return false;
          }
          if (num === task.durationDays) return true;
          commit(
            setField(model, taskId, { durationDays: num }),
            { kind: "duration", taskId, value: num },
            { kind: "duration", taskId, value: task.durationDays },
            taskId,
          );
          return true;
        }

        case "progress": {
          if (num !== null && (num < 0 || num > 100)) {
            setError({ code: "invalidProgress" });
            return false;
          }
          if (num === task.progressPct) return true;
          commit(
            setField(model, taskId, { progressPct: num }),
            { kind: "progress", taskId, value: num },
            { kind: "progress", taskId, value: task.progressPct },
            taskId,
          );
          return true;
        }

        case "start": {
          const value = text === "" ? null : text;
          if (value === task.startAnchor) return true;
          commit(
            setField(model, taskId, { startAnchor: value }),
            { kind: "startAnchor", taskId, value },
            { kind: "startAnchor", taskId, value: task.startAnchor },
            taskId,
          );
          return true;
        }

        case "predecessors": {
          const wanted =
            text === ""
              ? []
              : text
                  .split(/[,;\s]+/)
                  .filter(Boolean)
                  .map((piece) => Number(piece.replace(/^#/, "")));
          const current = predecessorRows(model, taskId, rows);
          if (wanted.length === current.length && wanted.every((n, i) => n === current[i])) {
            return true;
          }
          const result = setPredecessorRows(model, taskId, wanted);
          if (!result.ok) {
            setError({ code: result.error, detail: result.detail });
            return false;
          }
          commit(
            result.model,
            {
              kind: "predecessors",
              taskId,
              predecessorIds: predecessorIdsOf(result.model, taskId),
            },
            { kind: "predecessors", taskId, predecessorIds: predecessorIdsOf(model, taskId) },
            taskId,
          );
          return true;
        }

        default:
          return false;
      }
    },
    [model, rows, editable, commit],
  );

  // ── Sélecteurs ────────────────────────────────────────────────────────────

  const assign = useCallback(
    (taskId: string, field: "ownerId" | "siteId" | "contractId", value: string | null) => {
      if (!editable) return;
      const task = model.tasks.find((t) => t.id === taskId);
      if (!task || task[field] === value) return;

      // Le champ affiché n'est pas celui qu'on écrit : `ownerName` et
      // `contractCode` sont dérivés ICI, depuis les listes déjà en mémoire,
      // pour que la cellule change sans attendre un recalcul serveur.
      const patch: Partial<ModelTask> = { [field]: value };
      if (field === "ownerId") {
        patch.ownerName = value ? people.find((p) => p.id === value)?.fullName ?? null : null;
      } else if (field === "contractId") {
        patch.contractCode = value
          ? contracts.find((c) => c.id === value)?.contractCode ?? null
          : null;
      }

      const kind = field === "ownerId" ? "owner" : field === "siteId" ? "site" : "contract";
      commit(
        setField(model, taskId, patch),
        { kind, taskId, value } as BoardChange,
        { kind, taskId, value: task[field] } as BoardChange,
        taskId,
      );
    },
    [model, editable, commit, people, contracts],
  );

  // ── Déplacement ───────────────────────────────────────────────────────────

  const move = useCallback(
    (taskId: string, direction: -1 | 1) => {
      if (!editable) return;
      const next = moveTask(model, taskId, direction);
      if (!next) return;
      commit(
        next,
        { kind: "order", order: orderOf(next) },
        { kind: "order", order: orderOf(model) },
        taskId,
      );
    },
    [model, editable, commit],
  );

  const dropOn = useCallback(
    (taskId: string, beforeTaskId: string) => {
      if (!editable) return;
      const next = moveTaskTo(model, taskId, beforeTaskId);
      if (!next) {
        setError({ code: "cannotReparent" });
        return;
      }
      commit(
        next,
        { kind: "order", order: orderOf(next) },
        { kind: "order", order: orderOf(model) },
        taskId,
      );
    },
    [model, editable, commit],
  );

  // ── Suppression et formulaire ─────────────────────────────────────────────

  const remove = useCallback(
    (taskId: string) => {
      if (!editable) return;
      commit(
        removeTask(model, taskId),
        { kind: "delete", taskId },
        { kind: "restore", taskId },
        taskId,
      );
    },
    [model, editable, commit],
  );

  const saveFields = useCallback(
    (taskId: string, fields: Partial<ModelTask>): boolean => {
      if (!editable) return false;
      const task = model.tasks.find((t) => t.id === taskId);
      if (!task) return false;
      const merged = { ...task, ...fields };
      if (merged.activity.trim() === "") {
        setError({ code: "emptyActivity" });
        return false;
      }

      const asChange = (t: ModelTask): BoardChange => ({
        kind: "fields",
        taskId,
        activity: t.activity,
        durationDays: t.durationDays,
        startAnchor: t.startAnchor,
        progressPct: t.progressPct,
        ownerId: t.ownerId,
        contractId: t.contractId,
        siteId: t.siteId,
        constraintDate: t.constraintDate,
      });

      commit(setField(model, taskId, fields), asChange(merged), asChange(task), taskId);
      return true;
    },
    [model, editable, commit],
  );

  // ── Annuler / rétablir ────────────────────────────────────────────────────

  const undo = useCallback(() => {
    const entry = past[past.length - 1];
    if (!entry) return;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [entry, ...f]);
    setModel(entry.before);
    setError(null);
    startTransition(async () => {
      const result = await applyBoardChange(scenarioCode, entry.undo);
      // Une annulation refusée est plus grave qu'un geste refusé : on remet
      // l'état d'après, sinon l'écran et la base divergent durablement.
      if (!result.ok) {
        setModel(entry.after);
        setFuture((f) => f.slice(1));
        setPast((p) => [...p, entry]);
        setError({ code: result.error ?? "writeFailed", detail: result.detail });
      }
    });
  }, [past, scenarioCode]);

  const redo = useCallback(() => {
    const entry = future[0];
    if (!entry) return;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, entry]);
    setModel(entry.after);
    setError(null);
    startTransition(async () => {
      const result = await applyBoardChange(scenarioCode, entry.redo);
      if (!result.ok) {
        setModel(entry.before);
        setPast((p) => p.slice(0, -1));
        setFuture((f) => [entry, ...f]);
        setError({ code: result.error ?? "writeFailed", detail: result.detail });
      }
    });
  }, [future, scenarioCode]);

  /**
   * Raccourcis clavier.
   *
   * On s'abstient DANS un champ de saisie : Ctrl+Z doit y annuler la frappe, pas
   * le geste précédent. C'est ce qu'attend quiconque a déjà tapé dans un
   * tableur.
   */
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (target?.isContentEditable) return;

      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, editable]);

  return {
    model,
    rows,
    error,
    clearError: useCallback(() => setError(null), []),
    pending,
    savingId,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    undoCount: past.length,
    undo,
    redo,
    editCell,
    assign,
    move,
    dropOn,
    remove,
    saveFields,
    hasPredecessor: useCallback(
      (taskId: string) => isDrivenByPredecessor(model, taskId),
      [model],
    ),
    predecessorLabel: useCallback(
      (taskId: string) => predecessorRows(model, taskId, rows).join(", "),
      [model, rows],
    ),
  };
}
