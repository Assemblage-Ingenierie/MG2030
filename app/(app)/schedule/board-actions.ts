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
  | {
      kind: "predecessors";
      taskId: string;
      predecessorIds: string[];
      /**
       * Ancres à REPOSER avant de récrire les liens. Sert à l'annulation.
       *
       * Poser une précédence libère la date épinglée du successeur — il le
       * faut, sinon le lien n'aurait aucun effet. Mais l'inverse n'était pas
       * écrit : Ctrl+Z retirait bien le lien et laissait la date épinglée
       * PERDUE. L'annulation prétendait alors rendre l'état d'avant tout en
       * gardant une partie du changement, ce qui est la seule chose qu'un
       * bouton « annuler » n'a pas le droit de faire.
       */
      anchors?: { taskId: string; startAnchor: string | null }[];
    }
  /**
   * Précédences vues DEPUIS L'AMONT : « ces tâches-là me suivent ».
   *
   * Le même graphe, écrit dans l'autre sens. C'est ce qui rend la planification
   * à rebours possible — on part de la date imposée et l'on remonte —, et
   * l'écriture n'est pas symétrique de `predecessors` : ici on remplace les
   * liens PARTANT de la tâche, là ceux qui y arrivent.
   */
  | {
      kind: "successors";
      taskId: string;
      successorIds: string[];
      /** Voir `anchors` ci-dessus : ici ce sont celles des tâches AVAL. */
      anchors?: { taskId: string; startAnchor: string | null }[];
    }
  | { kind: "order"; order: { id: string; sortOrder: number }[] }
  | { kind: "delete"; taskId: string }
  /** Ressuscite une tâche archivée. Sert à l'annulation d'une suppression. */
  | { kind: "restore"; taskId: string }
  /**
   * Sélection multiple. `taskIds` ne contient QUE des racines : une tâche dont
   * un ancêtre est aussi sélectionné part avec lui, sans entrée propre.
   */
  | { kind: "deleteMany"; taskIds: string[] }
  | { kind: "restoreMany"; taskIds: string[] }
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
      /**
       * Contrainte « pas avant ». Vit dans une AUTRE table, mais voyage avec
       * le formulaire : un seul geste de l'utilisateur doit rester un seul
       * aller-retour et une seule entrée d'historique.
       */
      constraintDate: string | null;
      /** Rattachement hiérarchique, et le rang qui l'accompagne. */
      parentId: string | null;
      sortOrder: number;
    }
  | {
      /**
       * Sélection multiple : chaque tâche ne porte QUE les champs modifiés.
       * Un champ absent est laissé tel quel — c'est ce qui permet de changer
       * le parent de tâches aux responsables différents sans les écraser.
       */
      kind: "bulk";
      items: { taskId: string; patch: BulkPatch }[];
    };

export interface BulkPatch {
  activity?: string;
  parentId?: string | null;
  sortOrder?: number;
  ownerId?: string | null;
  contractId?: string | null;
}

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
    kind === "successors" ||
    kind === "order" ||
    kind === "delete" ||
    kind === "restore" ||
    kind === "deleteMany" ||
    kind === "restoreMany" ||
    kind === "fields" ||
    // Retour anticipé dans le `case` si aucun parent ne change.
    kind === "bulk"
  );
}

/**
 * Repose les dates épinglées portées par un changement de précédence.
 *
 * Appelé AVANT la réécriture des liens : si l'on reposait l'ancre après, le
 * code qui libère les ancres des tâches nouvellement reliées l'effacerait
 * aussitôt. L'ordre compte donc, et il n'est pas interchangeable.
 */
async function restoreAnchors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  anchors: { taskId: string; startAnchor: string | null }[] | undefined,
): Promise<string | null> {
  for (const anchor of anchors ?? []) {
    const { error } = await supabase
      .from("mg2030_task")
      .update({ start_date_input: anchor.startAnchor })
      .eq("id", anchor.taskId);
    if (error) return error.message;
  }
  return null;
}

/**
 * Archive (ou ressuscite) une tâche ET ses descendants.
 *
 * `archived_at` et non un DELETE : une tâche retirée reste un fait de
 * gestion, et l'annulation doit pouvoir la ressusciter.
 *
 * LES DESCENDANTS SUIVENT. L'écran retire la tâche ET tout ce qu'elle
 * contient ; la base n'archivait que la tâche, si bien que ses enfants
 * réapparaissaient au rechargement, orphelins. Ils reçoivent désormais le
 * MÊME horodatage : c'est lui qui permet à l'annulation de ne ressusciter
 * que ce geste-là, pas un enfant supprimé auparavant.
 *
 * @returns le message d'erreur, ou `null`.
 */
async function archiveTree(
  supabase: Awaited<ReturnType<typeof createClient>>,
  taskId: string,
  mode: "delete" | "restore",
): Promise<string | null> {
  const { data: self, error: readSelf } = await supabase
    .from("mg2030_task")
    .select("scenario_id, archived_at")
    .eq("id", taskId)
    .maybeSingle();
  if (readSelf || !self) return readSelf?.message ?? "writeFailed";

  const { data: all, error: readAll } = await supabase
    .from("mg2030_task")
    .select("id, parent_id, archived_at")
    .eq("scenario_id", self.scenario_id);
  if (readAll) return readAll.message;

  const doomed = new Set<string>([taskId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const t of all ?? []) {
      if (t.parent_id && doomed.has(t.parent_id) && !doomed.has(t.id)) {
        doomed.add(t.id);
        grew = true;
      }
    }
  }

  const stamp = mode === "delete" ? new Date().toISOString() : null;
  const targets = (all ?? [])
    .filter((t) => doomed.has(t.id))
    .filter((t) =>
      mode === "delete"
        ? t.id === taskId || t.archived_at === null
        : t.id === taskId || t.archived_at === self.archived_at,
    )
    .map((t) => t.id);

  const { error } = await supabase
    .from("mg2030_task")
    .update({ archived_at: stamp })
    .in("id", targets);
  return error ? error.message : null;
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
          parent_id: change.parentId,
          sort_order: change.sortOrder,
        })
        .eq("id", change.taskId);
      if (error) return { ok: false, error: error.message };

      // La contrainte est dans une table séparée : deux écritures, un seul
      // geste. Vider le champ retire la contrainte plutôt que d'en poser une
      // vide, qui n'aurait aucun sens.
      if (change.constraintDate === null) {
        const { error: del } = await supabase
          .from("mg2030_task_constraint")
          .delete()
          .eq("task_id", change.taskId)
          .eq("kind", "start_no_earlier_than");
        if (del) return { ok: false, error: del.message };
      } else {
        const { error: up } = await supabase.from("mg2030_task_constraint").upsert(
          {
            task_id: change.taskId,
            kind: "start_no_earlier_than",
            constraint_date: change.constraintDate,
          },
          { onConflict: "task_id,kind" },
        );
        if (up) return { ok: false, error: up.message };
      }
      break;
    }

    case "predecessors": {
      const failed = await restoreAnchors(supabase, change.anchors);
      if (failed) return { ok: false, error: failed };

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

    case "successors": {
      const failedAnchors = await restoreAnchors(supabase, change.anchors);
      if (failedAnchors) return { ok: false, error: failedAnchors };

      // Chaque successeur perd son ancre, pour la raison exposée ci-dessus :
      // l'ancre prime sur les prédécesseurs, donc la garder rendrait le lien
      // décoratif. Ce sont les tâches AVAL qu'on libère ici, pas la tâche
      // éditée — c'est toute la différence avec le cas précédent.
      if (change.successorIds.length > 0) {
        const { error } = await supabase
          .from("mg2030_task")
          .update({ start_date_input: null })
          .in("id", change.successorIds);
        if (error) return { ok: false, error: error.message };
      }

      // On ne retire QUE les liens partant de cette tâche. Un successeur qui
      // attend aussi quelqu'un d'autre conserve cette autre attente : effacer
      // au passage les précédences d'un tiers détruirait son plan en silence.
      const { error: del } = await supabase
        .from("mg2030_task_dependency")
        .delete()
        .eq("predecessor_id", change.taskId);
      if (del) return { ok: false, error: del.message };

      if (change.successorIds.length > 0) {
        const { error } = await supabase.from("mg2030_task_dependency").insert(
          change.successorIds.map((successorId) => ({
            predecessor_id: change.taskId,
            successor_id: successorId,
            dependency_type: "FS",
            lag_days: 0,
          })),
        );
        if (error) return { ok: false, error: "cycle", detail: error.message };
      }
      break;
    }

    case "order":
      return reorderTasks(scenarioCode, change.order, false);

    case "bulk": {
      for (const { taskId, patch } of change.items) {
        const row: Record<string, unknown> = {};
        if (patch.activity !== undefined) {
          const activity = patch.activity.trim();
          if (activity === "") return { ok: false, error: "emptyActivity" };
          row.activity = activity;
        }
        if (patch.parentId !== undefined) row.parent_id = patch.parentId;
        if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
        if (patch.ownerId !== undefined) row.owner_id = patch.ownerId;
        if (patch.contractId !== undefined) row.contract_id = patch.contractId;
        if (Object.keys(row).length === 0) continue;
        const { error } = await supabase.from("mg2030_task").update(row).eq("id", taskId);
        if (error) return { ok: false, error: error.message };
      }
      // Seul un changement de parent déplace des dates (étendue des
      // récapitulatifs) ; un libellé, un responsable ou un marché, non.
      if (!change.items.some((i) => i.patch.parentId !== undefined)) {
        return { ok: true, changed: 0 };
      }
      break;
    }

    case "delete":
    case "restore": {
      const failed = await archiveTree(supabase, change.taskId, change.kind);
      if (failed) return { ok: false, error: failed };
      break;
    }

    case "deleteMany":
    case "restoreMany": {
      const mode = change.kind === "deleteMany" ? "delete" : "restore";
      for (const taskId of change.taskIds) {
        const failed = await archiveTree(supabase, taskId, mode);
        if (failed) return { ok: false, error: failed };
      }
      break;
    }
  }

  if (!movesDates(change.kind)) return { ok: true, changed: 0 };
  return recomputeAndPersist(scenarioCode, false);
}
