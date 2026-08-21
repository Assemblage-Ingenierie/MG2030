"use client";

// ============================================================
// components/schedule/gantt-pane.tsx — volet droit du plan de charge.
//
// C'est le Gantt SANS sa colonne de libellés : la grille de gauche les porte
// déjà, et le diagramme en est le PROLONGEMENT. L'alignement ligne à ligne
// tient à une seule chose — les deux volets rendent la même liste, dans le même
// ordre, avec la même hauteur de ligne (ROW_H).
//
// `memo` : ce volet ne dépend pas de la cellule en cours d'édition. Sans lui,
// chaque frappe dans la grille redessinerait le SVG entier.
// ============================================================

import { memo, useMemo } from "react";
import { GANTT } from "@/lib/tokens";
import { buildLayout, ROW_H } from "@/lib/gantt/layout";
import type { ScaleUnit } from "@/lib/gantt/scale";
import type { BoardTask } from "./board-types";

export const HEAD_H = 44;

export const GanttPane = memo(function GanttPane({
  tasks,
  dependencies,
  scale,
  today,
  bufferStart,
  deadline,
  locale,
  labels,
}: {
  tasks: BoardTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  scale: ScaleUnit;
  today: string;
  bufferStart: string | null;
  deadline: string | null;
  locale: "en" | "sq";
  labels: { buffer: string; deadline: string; today: string; unreported: string; late: string };
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
  const height = HEAD_H + tasks.length * ROW_H;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", background: "var(--surface)" }}
      aria-hidden="true"
    >
      <defs>
        <marker id="mg-arrow-b" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={GANTT.muted} />
        </marker>
        {/* La marge terminale n'est pas du travail : hachures, pas une barre. */}
        <pattern
          id="mg-buffer-b"
          width="6"
          height="6"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="6" height="6" fill={GANTT.band} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={GANTT.gridStrong} strokeWidth="2" />
        </pattern>
      </defs>

      {/* Marge terminale, sous tout le reste */}
      {layout.bufferX !== null && layout.deadlineX !== null && (
        <rect
          x={layout.bufferX}
          y={HEAD_H}
          width={Math.max(0, layout.deadlineX - layout.bufferX)}
          height={height - HEAD_H}
          fill="url(#mg-buffer-b)"
          opacity={0.7}
        >
          <title>{labels.buffer}</title>
        </rect>
      )}

      {/* Grille verticale */}
      {layout.ticks.map((tick) => {
        const x = tick.offsetDays * layout.pxPerDay;
        return (
          <line
            key={tick.date}
            x1={x}
            y1={HEAD_H}
            x2={x}
            y2={height}
            stroke={tick.major ? GANTT.gridStrong : GANTT.grid}
          />
        );
      })}

      {/* En-tête d'échelle */}
      <rect x={0} y={0} width={width} height={HEAD_H} fill={GANTT.band} />
      {layout.ticks.map((tick) => {
        const x = tick.offsetDays * layout.pxPerDay;
        const w = tick.spanDays * layout.pxPerDay;
        // On n'écrit un libellé que s'il tient : du texte superposé illisible
        // est pire que pas de texte.
        if (w < 24) return null;
        return (
          <text
            key={`l-${tick.date}`}
            x={x + w / 2}
            y={HEAD_H - 15}
            textAnchor="middle"
            fontSize={10}
            fill={tick.major ? GANTT.text : GANTT.muted}
            fontWeight={tick.major ? 600 : 400}
          >
            {tick.label}
          </text>
        );
      })}
      <line x1={0} y1={HEAD_H} x2={width} y2={HEAD_H} stroke={GANTT.gridStrong} />

      {/* Lignes alternées — mêmes rangs que la grille de gauche */}
      {tasks.map((task, i) =>
        i % 2 === 1 ? (
          <rect
            key={task.id}
            x={0}
            y={HEAD_H + i * ROW_H}
            width={width}
            height={ROW_H}
            fill={GANTT.band}
            opacity={0.35}
          />
        ) : null,
      )}

      {/* Flèches de précédence, SOUS les barres */}
      {layout.links.map((link) => (
        <polyline
          key={`${link.from}-${link.to}`}
          points={link.points.map(([x, y]) => `${x},${HEAD_H + y}`).join(" ")}
          fill="none"
          stroke={GANTT.muted}
          strokeWidth={1}
          markerEnd="url(#mg-arrow-b)"
          opacity={0.75}
        />
      ))}

      {/* Barres */}
      {layout.bars.map((bar) => {
        const y = HEAD_H + bar.y;

        if (bar.diamond) {
          const cy = y + bar.height / 2;
          const r = 6;
          return (
            <polygon
              key={bar.taskId}
              points={`${bar.x},${cy - r} ${bar.x + r},${cy} ${bar.x},${cy + r} ${bar.x - r},${cy}`}
              fill={GANTT.milestone}
              stroke={GANTT.text}
              strokeWidth={0.5}
            >
              <title>{`${bar.wbsCode} — ${bar.label}`}</title>
            </polygon>
          );
        }

        // Quatre états, et la nuance décisive est « non renseigné » : une
        // tâche dont la fin est passée sans avancement saisi n'est PAS en
        // retard — on n'en sait rien. La dire en rose serait affirmer un fait
        // que personne n'a constaté.
        const fill =
          bar.status === "late"
            ? "#ea9999"
            : bar.type === "summary"
              ? GANTT.text
              : "var(--accent)";

        const unreported = bar.status === "unreported";
        const tip =
          `${bar.wbsCode} — ${bar.label}` +
          (unreported ? ` · ${labels.unreported}` : "") +
          (bar.status === "late" ? ` · ${labels.late}` : "");

        return (
          <g key={bar.taskId}>
            <rect
              x={bar.x}
              y={y}
              width={bar.width}
              height={bar.height}
              rx={bar.type === "summary" ? 1 : 3}
              fill={unreported ? "var(--surface)" : fill}
              /* Non renseigné : contour tireté, barre creuse. On voit qu'il y a
                 une tâche, et qu'il n'y a pas d'information. */
              stroke={unreported ? "var(--accent-2)" : undefined}
              strokeWidth={unreported ? 1.2 : 0}
              strokeDasharray={unreported ? "3 2" : undefined}
              opacity={bar.type === "summary" ? 0.85 : 1}
            >
              <title>{tip}</title>
            </rect>
            {/* Avancement : remplissage INTÉRIEUR, comme sous MS Project. Une
                bande de 4 px au bas de la barre se lisait comme une ombre. */}
            {bar.progressWidth > 0 && (
              <rect
                x={bar.x}
                y={y + 3}
                width={bar.progressWidth}
                height={bar.height - 6}
                rx={1}
                fill={GANTT.text}
                opacity={0.5}
              >
                <title>{tip}</title>
              </rect>
            )}
          </g>
        );
      })}

      {/* Repères verticaux, au-dessus de tout */}
      {layout.deadlineX !== null && (
        <g>
          <line
            x1={layout.deadlineX}
            y1={HEAD_H}
            x2={layout.deadlineX}
            y2={height}
            stroke={GANTT.text}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          >
            <title>{labels.deadline}</title>
          </line>
        </g>
      )}
      {layout.todayX !== null && (
        <g>
          <line
            x1={layout.todayX}
            y1={HEAD_H}
            x2={layout.todayX}
            y2={height}
            stroke={GANTT.today}
            strokeWidth={1.5}
          >
            <title>{labels.today}</title>
          </line>
          <polygon
            points={`${layout.todayX - 4},${HEAD_H} ${layout.todayX + 4},${HEAD_H} ${layout.todayX},${HEAD_H + 5}`}
            fill={GANTT.today}
          />
        </g>
      )}
    </svg>
  );
});
