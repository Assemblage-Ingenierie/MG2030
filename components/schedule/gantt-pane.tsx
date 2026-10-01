"use client";

// ============================================================
// components/schedule/gantt-pane.tsx — volet droit du plan de charge.
//
// C'est le Gantt SANS sa colonne de libellés : la grille de gauche les porte
// déjà, et le diagramme en est le PROLONGEMENT. L'alignement ligne à ligne
// tient à une seule chose — les deux volets rendent la même liste, dans le même
// ordre, avec la même hauteur de ligne (ROW_H).
//
// Le DESSIN lui-même vit dans `components/gantt/chart.tsx`, partagé avec la
// page d'impression : il n'y a qu'un seul jeu de barres, de losanges et de
// flèches à corriger. Ce fichier ne garde que ce qui est propre à l'écran —
// le calcul de la mise en page, et l'échelle de temps rendue `sticky`.
//
// ⚠ DEUX SVG, PAS UN. Un SVG unique défilait en entier : l'en-tête de la
// grille de gauche restait collé pendant que l'échelle de droite s'échappait
// vers le haut, et les deux volets ne se lisaient plus sur la même ligne.
// C'est le bug d'affichage signalé le 16/09/2026 (« les lignes ne défilent pas
// de manière homogène »).
//
// `memo` : ce volet ne dépend pas de la cellule en cours d'édition. Sans lui,
// chaque frappe dans la grille redessinerait le SVG entier.
// ============================================================

import { memo, useMemo } from "react";
import { buildLayout } from "@/lib/gantt/layout";
import { ChartBody, TimeAxis, HEAD_H, type ChartLabels } from "@/components/gantt/chart";
import type { ScaleUnit } from "@/lib/gantt/scale";
import type { BoardTask } from "./board-types";

export { HEAD_H };

export const GanttPane = memo(function GanttPane({
  tasks,
  dependencies,
  scale,
  today,
  bufferStart,
  deadline,
  locale,
  labels,
  showNames,
}: {
  tasks: BoardTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  scale: ScaleUnit;
  today: string;
  bufferStart: string | null;
  deadline: string | null;
  locale: "en" | "sq";
  labels: ChartLabels;
  /** Écrire le nom de la tâche sur sa barre. */
  showNames: boolean;
}) {
  const layout = useMemo(
    () =>
      buildLayout({
        tasks: tasks.map((t) => ({
          id: t.id,
          wbsCode: t.wbsCode,
          activity: t.activity,
          type: t.type,
          start: t.start,
          end: t.end,
          progressPct: t.progressPct,
          depth: t.depth,
          contractCode: t.contractCode,
          ownerOrgCode: t.ownerOrgCode ?? null,
        })),
        dependencies,
        scale,
        today,
        bufferStart,
        deadline,
        locale,
      }),
    [tasks, dependencies, scale, today, bufferStart, deadline, locale],
  );

  const width = Math.max(layout.chartWidth, 320);

  return (
    <div style={{ width }}>
      <TimeAxis layout={layout} width={width} className="sticky top-0 z-[5]" />
      <ChartBody
        layout={layout}
        width={width}
        rowCount={tasks.length}
        labels={labels}
        showNames={showNames}
      />
    </div>
  );
});
