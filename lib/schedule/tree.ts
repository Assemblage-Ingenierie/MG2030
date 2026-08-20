// ============================================================
// lib/schedule/tree.ts — filtrage d'une liste hiérarchique.
//
// Pur, générique, sans React : il vit dans lib/ pour être testable, et non
// dans les composants où il servait d'abord.
// ============================================================

/** Le strict minimum pour remonter une hiérarchie. */
export interface TreeNode {
  id: string;
  parentId: string | null;
}

/**
 * Filtre en CONSERVANT LES ASCENDANTS des lignes retenues.
 *
 * Un filtre plat sur une liste hiérarchique casse la lecture : les enfants
 * restent indentés sous un parent disparu, et les récapitulatifs — qui ne
 * portent ni marché ni site — s'évanouissent alors qu'ils donnent le total.
 * C'est le comportement de MS Project, et la seule façon que l'indentation
 * garde un sens.
 *
 * Un ascendant conservé N'EST PAS retenu par le prédicat : il est là pour le
 * contexte. C'est voulu — masquer « Detail Design » parce qu'il ne porte pas
 * de marché rendrait ses sept enfants illisibles.
 *
 * La garde à 50 protège d'un cycle parent/enfant introduit en base : la
 * fonction rend une liste tronquée plutôt que de boucler indéfiniment.
 */
export function filterKeepingAncestors<T extends TreeNode>(
  nodes: T[],
  keep: (node: T) => boolean,
): T[] {
  const retained = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));

  for (const node of nodes) {
    if (!keep(node)) continue;
    let cursor: T | undefined = node;
    let guard = 0;
    while (cursor && guard++ < 50) {
      if (retained.has(cursor.id)) break;
      retained.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
  }

  return nodes.filter((node) => retained.has(node.id));
}
