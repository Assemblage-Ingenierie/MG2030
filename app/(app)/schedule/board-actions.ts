"use server";

// ============================================================
// app/(app)/schedule/board-actions.ts — persistance du plan de charge.
//
// ⚠ CES ACTIONS NE REVALIDENT PAS LA PAGE, et c'est délibéré.
//
// Le plan de charge tient son propre modèle à jour dans le navigateur et a
// DÉJÀ affiché le résultat quand l'écriture partit. Revalider ferait remplacer
// l'affichage par une version identique venue du serveur : un re-rendu complet
// de la page pour rien, et surtout un écrasement de la cellule en cours de
// saisie. C'était la cause du lag ressenti.
//
// Les deux côtés restent d'accord parce qu'ils exécutent LE MÊME moteur pur :
// le client pour afficher, le serveur pour persister. Le serveur recalcule tout
// de même de son côté — il ne fait pas confiance aux dates que le client lui
// enverrait, et c'est lui qui a raison si deux personnes éditent en même temps.
//
// Un geste = UNE action = UN aller-retour. La forme en union discriminée évite
// une douzaine d'actions presque identiques, et rend l'annulation symétrique :
// annuler, c'est appliquer le changement inverse.
//
// RLS SEULE AUTORITÉ : aucun contrôle d'accès ici.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { recomputeAndPersist, reorderTasks, type WriteResult } from "./actions";

export type BoardChange =
  | { kind: "activity"; taskId: string; value: string }
  | { kind: "duration"; taskId: string; value: number | null }
  | { kind: "progress"; taskId: string; value: number | null }
  | { kind: "startAnchor"; taskId: string; value: string | null }
  | { kind: "owner"; taskId: string; value: string | null }
  | { kind: "site"; taskId: string; value: string | null }
  | { kind: "contract"; taskId: string; value: string | null }
  | { kind: "predecessors"; taskId: string; predecessorIds: string[] }
  | { kind: "order"; order: { id: string; sortOrder: number }[] }
  | { kind: "delete"; taskId: string }
  /** Ressuscite une tâche archivée. Sert à l'annulation d'une suppression. */
  | { kind: "restore"; taskId: string }
  | {
      /** Édition par formulaire : plusieurs champs d'un coup. */
      kind: "fields";
      taskId: string;
      activity: string;
      durationDays: number | null;
      startAnchor: string | null;
      progressPct: number | null;
      ownerId: string | null;
      contractId: string | null;
      siteId: string | null;
    };

/** Colonnes touchées par chaque type de changement simple. */
const COLUMN: Record<string, string> = {
  activity: "activity",
  duration: "duration_days",
  progress: "progress_pct",
  startAnchor: "start_date_input",
  owner: "owner_id",
  site: "site_id",
  contract: "contract_id",
};

/**
 * Faut-il recalculer après ce changement ?
 *
 * Un responsable, un site ou un marché ne déplacent aucune date. Recalculer
 * quand même coûterait une lecture complète du scénario pour rien — sur
 * l'écran dont le brief §2 dit qu'il décide du sort du projet.
 */
function movesDates(kind: BoardChange["kind"]): boolean {
  return (
    kind === "duration" ||
    kind === "startAnchor" ||
    kind === "predecessors" ||
    kind === "order" ||
    kind === "delete" ||
    kind === "restore" ||
    kind === "fields"
  );
}

export async function applyBoardChange(
  scenarioCode: string,
  change: BoardChange,
): Promise<WriteResult> {
  const supabase = await createClient();

  switch (change.kind) {
    case "activity":
    case "duration":
    case "progress":
    case "startAnchor":
    case "owner":
    case "site":
    case "contract": {
      const value =
        change.kind === "activity" ? (change.value as string).trim() : change.value;
      if (change.kind === "activity" && value === "") {
        return { ok: false, error: "emptyActivity" };
      }
      const { error } = await supabase
        .from("mg2030_task")
        .update({ [COLUMN[change.kind]]: value })
        .eq("id", change.taskId);
      if (error) return { ok: false, error: error.message };
      break;
    }

    case "fields": {
      const activity = change.activity.trim();
      if (activity === "") return { ok: false, error: "emptyActivity" };
      const { error } = await supabase
        .from("mg2030_task")
        .update({
          activity,
          duration_days: change.durationDays,
          start_date_input: change.startAnchor,
          progress_pct: change.progressPct,
          owner_id: change.ownerId,
          contract_id: change.contractId,
          site_id: change.siteId,
        })
        .eq("id", change.taskId);
      if (error) return { ok: false, error: error.message };
      break;
    }

    case "predecessors": {
      // Poser une précédence LIBÈRE la date épinglée : l'ancre prime sur les
      // prédécesseurs dans le moteur, donc la garder rendrait le lien sans
      // effet. Même règle que côté client (lib/schedule/board-model.ts).
      if (change.predecessorIds.length > 0) {
        const { error } = await supabase
          .from("mg2030_task")
          .update({ start_date_input: null })
          .eq("id", change.taskId);
        if (error) return { ok: false, error: error.message };
      }

      // Remplacement complet : on supprime puis on repose. Un différentiel
      // demanderait de lire l'état actuel — un aller-retour de plus pour un
      // gain nul à ce volume.
      const { error: del } = await supabase
        .from("mg2030_task_dependency")
        .delete()
        .eq("successor_id", change.taskId);
      if (del) return { ok: false, error: del.message };

      if (change.predecessorIds.length > 0) {
        const { error } = await supabase.from("mg2030_task_dependency").insert(
          change.predecessorIds.map((predecessorId) => ({
            predecessor_id: predecessorId,
            successor_id: change.taskId,
            dependency_type: "FS",
            lag_days: 0,
          })),
        );
        // Le trigger de cycle remonte ici. Le client a déjà refusé le cycle de
        // son côté ; ce garde-fou couvre l'édition concurrente.
        if (error) return { ok: false, error: "cycle", detail: error.message };
      }
      break;
    }

    case "order":
      return reorderTasks(scenarioCode, change.order, false);

    case "delete":
    case "restore": {
      // `archived_at` et non un DELETE : une tâche retirée reste un fait de
      // gestion, et l'annulation doit pouvoir la ressusciter.
      const { error } = await supabase
        .from("mg2030_task")
        .update({
          archived_at: change.kind === "delete" ? new Date().toISOString() : null,
        })
        .eq("id", change.taskId);
      if (error) return { ok: false, error: error.message };
      break;
    }
  }

  if (!movesDates(change.kind)) return { ok: true, changed: 0 };
  return recomputeAndPersist(scenarioCode, false);
}
