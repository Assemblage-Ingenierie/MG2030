"use client";

// ============================================================
// components/roadmap/timeline-row.tsx — la colonne de gauche de la frise,
// vivante.
//
// Elle n'écrivait que l'intitulé, en lecture seule. On y passe pourtant le plus
// clair d'une revue : on lit une barre, on veut corriger le nom de l'action ou
// changer qui la porte — et il fallait basculer en liste, retrouver la ligne,
// la modifier, revenir. Demandé le 01/10/2026.
//
// Les cellules d'édition sont EXACTEMENT celles de la liste (`inline-cell`) :
// un second jeu de champs aurait dérivé, et la frise aurait fini par écrire
// autrement que le tableau.
// ============================================================

import { InlineAssignees, InlineTitle } from "./inline-cell";
import type { PersonOption } from "./assignee-picker";

export function TimelineRow({
  actionId,
  title,
  assignees,
  people,
  notSetLabel,
  shortNames,
}: {
  actionId: string;
  title: string;
  assignees: { label: string }[];
  people: PersonOption[];
  notSetLabel: string;
  shortNames: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* L'intitulé prend la place qu'il peut, les assignataires gardent la
          leur : sans `min-w-0` sur le premier, un titre long pousse les
          assignataires hors de la colonne au lieu de se tronquer. */}
      <span className="min-w-0 flex-1 truncate">
        <InlineTitle actionId={actionId} value={title} />
      </span>
      <span className="shrink-0">
        <InlineAssignees
          actionId={actionId}
          value={assignees}
          people={people}
          notSetLabel={notSetLabel}
          shortNames={shortNames}
        />
      </span>
    </span>
  );
}
