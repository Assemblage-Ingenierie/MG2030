// ============================================================
// lib/schedule/topo.ts — tri topologique du graphe de précédence.
//
// Un cycle rend le planning incalculable. On le refuse en NOMMANT les tâches
// en cause : « cycle détecté » sans le chemin oblige l'utilisateur à chercher
// à la main dans un graphe de plusieurs centaines d'arêtes.
// ============================================================

import { ScheduleCycleError } from "./types";

/**
 * Ordonne les nœuds de sorte que chaque prédécesseur précède ses successeurs.
 *
 * Kahn plutôt qu'un parcours en profondeur : l'ordre produit est stable
 * (les nœuds sans prédécesseur sortent dans leur ordre d'entrée), ce qui rend
 * les tests reproductibles et les diagnostics lisibles.
 *
 * @param nodeIds   tous les nœuds, y compris ceux sans arête
 * @param edges     arêtes orientées prédécesseur → successeur
 * @param labelOf   libellé lisible d'un nœud, pour le message d'erreur
 */
export function topologicalOrder(
  nodeIds: string[],
  edges: { predecessorId: string; successorId: string }[],
  labelOf: (id: string) => string = (id) => id,
): string[] {
  const inDegree = new Map<string, number>();
  const successors = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    successors.set(id, []);
  }

  for (const edge of edges) {
    // Une arête vers un nœud inconnu est ignorée : elle peut venir d'une vue
    // filtrée où le prédécesseur est hors périmètre. Le successeur retombe
    // alors sur son ancre ou sur le début de projet.
    if (!inDegree.has(edge.predecessorId) || !inDegree.has(edge.successorId)) continue;
    successors.get(edge.predecessorId)!.push(edge.successorId);
    inDegree.set(edge.successorId, inDegree.get(edge.successorId)! + 1);
  }

  const ready = nodeIds.filter((id) => inDegree.get(id) === 0);
  const order: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of successors.get(id)!) {
      const remaining = inDegree.get(next)! - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) ready.push(next);
    }
  }

  if (order.length !== nodeIds.length) {
    const stuck = nodeIds.filter((id) => inDegree.get(id)! > 0);
    throw new ScheduleCycleError(findCycle(stuck, successors, labelOf));
  }

  return order;
}

/**
 * Extrait un cycle concret parmi les nœuds bloqués, pour le message d'erreur.
 * Parcours en profondeur avec pile : le premier nœud revu ferme le cycle.
 */
function findCycle(
  stuck: string[],
  successors: Map<string, string[]>,
  labelOf: (id: string) => string,
): string[] {
  const blocked = new Set(stuck);
  const state = new Map<string, "visiting" | "done">();
  const stack: string[] = [];

  function walk(id: string): string[] | null {
    state.set(id, "visiting");
    stack.push(id);

    for (const next of successors.get(id) ?? []) {
      if (!blocked.has(next)) continue;
      if (state.get(next) === "visiting") {
        const from = stack.indexOf(next);
        return [...stack.slice(from), next].map(labelOf);
      }
      if (!state.has(next)) {
        const found = walk(next);
        if (found) return found;
      }
    }

    stack.pop();
    state.set(id, "done");
    return null;
  }

  for (const id of stuck) {
    if (state.has(id)) continue;
    const cycle = walk(id);
    if (cycle) return cycle;
  }
  return stuck.map(labelOf);
}
