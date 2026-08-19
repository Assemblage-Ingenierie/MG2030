"use client";

// ============================================================
// components/gantt/gantt-chart.tsx — rendu SVG, sans aucune dépendance.
//
// Décision du 19/08/2026, motivée dans docs/GANTT_ARBITRAGE.md : le filtre de
// licence élimine les quatre bibliothèques les plus complètes (dhtmlx et SVAR
// sont copyleft dans leur version gratuite, Bryntum et Syncfusion payantes), et
// trois concepts du modèle MG2030 n'existent dans aucune d'elles —
// l'intertitre qui n'agrège pas, les scénarios exclusifs, la marge terminale.
//
// Version 1 : LECTURE. L'édition passe par la grille tableur, où se joue le
// critère de succès du brief §2. Le glisser-déposer des barres est différé.
// ============================================================

import { useMemo, useRef } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { GANTT } from "@/lib/tokens";
import { formatPlanDate } from "@/lib/i18n/format";
import {
  BAR_H,
  HEADER_H,
  LABEL_W,
  ROW_H,
  buildLayout,
  type GanttTask,
} from "@/lib/gantt/layout";
import type { ScaleUnit } from "@/lib/gantt/scale";

export function GanttChart({
  tasks,
  dependencies,
  scale,
  today,
  bufferStart,
  deadline,
  locale,
}: {
  tasks: GanttTask[];
  dependencies: { predecessorId: string; successorId: string }[];
  scale: ScaleUnit;
  today: string;
  bufferStart: string | null;
  deadline: string | null;
  locale: "en" | "sq";
}) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);

  const layout = useMemo(
    () => buildLayout({ tasks, dependencies, scale, today, bufferStart, deadline, locale }),
    [tasks, dependencies, scale, today, bufferStart, deadline, locale],
  );

  if (layout.bars.length === 0) {
    return (
      <p className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">
        {t("gantt.noTasks")}
      </p>
    );
  }

  const width = LABEL_W + layout.chartWidth;
  const height = HEADER_H + layout.chartHeight;

  return (
    <div className="overflow-x-auto">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("gantt.title")}
        style={{ background: "var(--surface)", display: "block" }}
      >
        <defs>
          {/* Une seule pointe de flèche, réutilisée par tous les liens. */}
          <marker
            id="mg-arrow"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill={GANTT.muted} />
          </marker>
          {/* Hachures de la marge terminale : elle n'est pas du travail. */}
          <pattern id="mg-buffer" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={GANTT.band} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={GANTT.gridStrong} strokeWidth="2" />
          </pattern>
        </defs>

        {/* ── Bande de la marge terminale, sous tout le reste ─────────── */}
        {layout.bufferX !== null && layout.deadlineX !== null && (
          <rect
            x={LABEL_W + layout.bufferX}
            y={HEADER_H}
            width={Math.max(0, layout.deadlineX - layout.bufferX)}
            height={layout.chartHeight}
            fill="url(#mg-buffer)"
            opacity={0.7}
          >
            <title>{t("gantt.buffer")}</title>
          </rect>
        )}

        {/* ── Grille verticale ────────────────────────────────────────── */}
        {layout.ticks.map((tick) => {
          const x = LABEL_W + tick.offsetDays * layout.pxPerDay;
          return (
            <line
              key={tick.date}
              x1={x}
              y1={HEADER_H}
              x2={x}
              y2={height}
              stroke={tick.major ? GANTT.gridStrong : GANTT.grid}
              strokeWidth={1}
            />
          );
        })}

        {/* ── En-tête d'échelle ───────────────────────────────────────── */}
        <rect x={0} y={0} width={width} height={HEADER_H} fill={GANTT.band} />
        {layout.ticks.map((tick) => {
          const x = LABEL_W + tick.offsetDays * layout.pxPerDay;
          const tickWidth = tick.spanDays * layout.pxPerDay;
          // On n'écrit un libellé que s'il tient : superposer du texte illisible
          // est pire que ne rien écrire.
          if (tickWidth < 22) return null;
          return (
            <text
              key={`l-${tick.date}`}
              x={x + tickWidth / 2}
              y={HEADER_H - 14}
              textAnchor="middle"
              fontSize={10}
              fill={tick.major ? GANTT.text : GANTT.muted}
              fontWeight={tick.major ? 600 : 400}
            >
              {tick.label}
            </text>
          );
        })}
        <line x1={0} y1={HEADER_H} x2={width} y2={HEADER_H} stroke={GANTT.gridStrong} />

        {/* ── Lignes alternées et libellés ────────────────────────────── */}
        {layout.rows.map((row, i) => (
          <g key={row.taskId}>
            {i % 2 === 1 && (
              <rect
                x={0}
                y={HEADER_H + row.y}
                width={width}
                height={ROW_H}
                fill={GANTT.band}
                opacity={0.4}
              />
            )}
            <text
              x={8 + row.depth * 12}
              y={HEADER_H + row.y + ROW_H / 2 + 4}
              fontSize={11}
              fill={row.type === "group_header" ? GANTT.muted : GANTT.text}
              fontWeight={row.type === "summary" || row.type === "group_header" ? 600 : 400}
            >
              {truncate(row.label, LABEL_W - 16 - row.depth * 12)}
              <title>{row.label}</title>
            </text>
          </g>
        ))}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={height} stroke={GANTT.gridStrong} />

        {/* ── Flèches de précédence, SOUS les barres ──────────────────── */}
        {layout.links.map((link) => (
          <polyline
            key={`${link.from}-${link.to}`}
            points={link.points
              .map(([x, y]) => `${LABEL_W + x},${HEADER_H + y}`)
              .join(" ")}
            fill="none"
            stroke={GANTT.muted}
            strokeWidth={1}
            markerEnd="url(#mg-arrow)"
            opacity={0.75}
          />
        ))}

        {/* ── Barres ──────────────────────────────────────────────────── */}
        {layout.bars.map((bar) => {
          const x = LABEL_W + bar.x;
          const y = HEADER_H + bar.y;

          if (bar.diamond) {
            const cy = y + bar.height / 2;
            const r = 6;
            return (
              <polygon
                key={bar.taskId}
                points={`${x},${cy - r} ${x + r},${cy} ${x},${cy + r} ${x - r},${cy}`}
                fill={GANTT.milestone}
                stroke={GANTT.text}
                strokeWidth={0.5}
              >
                <title>{`${bar.wbsCode} — ${bar.label}`}</title>
              </polygon>
            );
          }

          const fill =
            bar.isLate ? "#ea9999"
            : bar.type === "summary" ? GANTT.text
            : "var(--accent)";

          return (
            <g key={bar.taskId}>
              <rect
                x={x}
                y={y}
                width={bar.width}
                height={bar.height}
                rx={bar.type === "summary" ? 1 : 3}
                fill={fill}
                opacity={bar.type === "summary" ? 0.85 : 1}
              >
                <title>{`${bar.wbsCode} — ${bar.label}`}</title>
              </rect>
              {/* Part réalisée : un liseré foncé au bas de la barre, plutôt
                  qu'une seconde couleur qui entrerait en concurrence. */}
              {bar.progressWidth > 0 && (
                <rect
                  x={x}
                  y={y + bar.height - 4}
                  width={bar.progressWidth}
                  height={4}
                  rx={1}
                  fill={GANTT.text}
                  opacity={0.55}
                />
              )}
            </g>
          );
        })}

        {/* ── Repères verticaux, au-dessus de tout ────────────────────── */}
        {layout.deadlineX !== null && (
          <VerticalMark
            x={LABEL_W + layout.deadlineX}
            top={HEADER_H}
            bottom={height}
            color={GANTT.text}
            label={t("gantt.deadline")}
            dashed
          />
        )}
        {layout.todayX !== null && (
          <VerticalMark
            x={LABEL_W + layout.todayX}
            top={HEADER_H}
            bottom={height}
            color={GANTT.today}
            label={`${t("gantt.today")} — ${formatPlanDate(today)}`}
          />
        )}
      </svg>
    </div>
  );
}

function VerticalMark({
  x,
  top,
  bottom,
  color,
  label,
  dashed = false,
}: {
  x: number;
  top: number;
  bottom: number;
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <g>
      <line
        x1={x}
        y1={top}
        x2={x}
        y2={bottom}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "4 3" : undefined}
      >
        <title>{label}</title>
      </line>
      <polygon points={`${x - 4},${top} ${x + 4},${top} ${x},${top + 5}`} fill={color} />
    </g>
  );
}

/** Troncature approchée : ~6 px par caractère à 11 px de corps. */
function truncate(text: string, maxPx: number): string {
  const max = Math.max(4, Math.floor(maxPx / 6));
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
