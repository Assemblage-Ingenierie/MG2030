// ============================================================
// lib/roadmap/export-rows.ts — la roadmap mise à plat, une fois pour deux.
//
// Le classeur Excel et la page imprimable montrent la MÊME chose : les actions
// filtrées, dans l'ordre de l'écran, groupées par sujet. Écrire deux fois la
// mise à plat, c'est garantir qu'une colonne ajoutée n'apparaîtra que dans
// l'une des deux.
//
// La mise en forme enrichie du détail est APLATIE ici : un classeur ne sait pas
// afficher du gras à l'intérieur d'une cellule qu'on remplit par XML, et des
// astérisques dans un tableau envoyé à l'AFD se liraient comme une coquille.
//
// Pur, donc testé.
// ============================================================

import { richTextToPlain } from "./rich-text";
import type { RoadmapGroup } from "./filter";

export interface ExportRow {
  subject: string;
  action: string;
  detail: string;
  timeline: string;
  status: string;
  priority: string;
  assignees: string;
}

export interface ExportLabels {
  /** Libellé du groupe des actions dont le sujet a été supprimé. */
  noSubject: string;
  /** Rendu du statut, de la priorité et de la date, déjà traduits. */
  status: (value: string | null) => string;
  priority: (value: string | null) => string;
  timeline: (row: { timeline: unknown }) => string;
}

/**
 * Une ligne par action, le sujet répété à chaque ligne.
 *
 * ⚠ LE SUJET EST RÉPÉTÉ, il n'est pas écrit une fois en tête de bloc. Dans un
 * tableur on trie et on filtre : une colonne à trous perd son sens dès le
 * premier tri, et c'est la première chose que fait quiconque reçoit le fichier.
 */
export function toExportRows(
  groups: RoadmapGroup[],
  labels: ExportLabels,
): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const group of groups) {
    for (const action of group.actions) {
      rows.push({
        subject: group.subjectName ?? labels.noSubject,
        action: action.title,
        detail: action.detail ? richTextToPlain(action.detail) : "",
        timeline: labels.timeline(action),
        status: labels.status(action.status),
        priority: labels.priority(action.priority),
        assignees: action.assignees.map((a) => a.label).join(", "),
      });
    }
  }
  return rows;
}
