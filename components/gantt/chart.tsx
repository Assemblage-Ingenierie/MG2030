// ============================================================
// components/gantt/chart.tsx — le DESSIN du diagramme, et rien d'autre.
//
// Extrait de `components/schedule/gantt-pane.tsx` le 01/10/2026, quand la page
// d'impression a eu besoin des mêmes barres. Le volet de l'écran et la feuille
// de papier ne diffèrent que par trois choses — la densité en pixels par jour,
// le collant de l'échelle, et la fenêtre de lignes rendue — et aucune ne
// justifiait un second jeu de barres, de losanges et de flèches qu'il aurait
// fallu corriger deux fois.
//
// ⚠ DEUX SVG, PAS UN. L'échelle de temps est séparée du corps : à l'écran elle
// est rendue `sticky` par l'appelant. Un SVG unique défilait en entier, et les
// deux volets ne se lisaient plus sur la même ligne — bug du 16/09/2026.
//
// Aucun état, aucun `use client` : ces composants se rendent aussi bien sur le
// serveur (page d'impression) que dans le navigateur (plan de charge).
// ============================================================

import { ENTITY_COLOR, GANTT } from "@/lib/tokens";
import { ROW_H, type GanttLayout } from "@/lib/gantt/layout";

export const HEAD_H = 44;

export interface ChartLabels {
  buffer: string;
  deadline: string;
  today: string;
  unreported: string;
  late: string;
}

/**
 * Une fenêtre de lignes : `from` et `count` en NUMÉROS DE LIGNE.
 *
 * Elle ne découpe pas le calcul — le tracé reste celui du plan entier — elle
 * n'en montre qu'une tranche, par le `viewBox`. C'est ce qui permet à une
 * impression de plusieurs pages de partager exactement le même axe de temps et
 * les mêmes repères : il n'y a qu'une mise en page.
 */
export interface RowWindow {
  from: number;
  count: number;
}

/** L'échelle de temps, sur fond bleu nuit, prolongeant l'en-tête de la grille. */
export function TimeAxis({
  layout,
  width,
  className,
}: {
  layout: GanttLayout;
  width: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={HEAD_H}
      viewBox={`0 0 ${width} ${HEAD_H}`}
      className={className}
      style={{ display: "block", background: "var(--table-head-bg)" }}
      aria-hidden="true"
    >
      <rect x={0} y={0} width={width} height={HEAD_H} fill="var(--table-head-bg)" />
      {layout.ticks.map((tick) => {
        const x = tick.offsetDays * layout.pxPerDay;
        const w = tick.spanDays * layout.pxPerDay;
        // On n'écrit un libellé que s'il tient : du texte superposé illisible
        // est pire que pas de texte. C'est aussi ce qui laisse l'impression
        // resserrer l'échelle sans produire de bouillie.
        if (w < 24) return null;
        return (
          <text
            key={`l-${tick.date}`}
            x={x + w / 2}
            y={HEAD_H - 15}
            textAnchor="middle"
            fontSize={10}
            fill="var(--table-head-text)"
            fillOpacity={tick.major ? 1 : 0.75}
            fontWeight={tick.major ? 600 : 400}
          >
            {tick.label}
          </text>
        );
      })}
      <line
        x1={0}
        y1={HEAD_H - 0.5}
        x2={width}
        y2={HEAD_H - 0.5}
        stroke="var(--table-head-border)"
      />
    </svg>
  );
}

export function ChartBody({
  layout,
  width,
  rowCount,
  labels,
  showNames,
  window: win,
  idSuffix = "b",
}: {
  layout: GanttLayout;
  width: number;
  /** Nombre total de lignes du plan, qui donne la hauteur des repères. */
  rowCount: number;
  labels: ChartLabels;
  showNames: boolean;
  /** Tranche affichée. Absente : tout le plan. */
  window?: RowWindow;
  /**
   * Suffixe des identifiants de `defs`. Deux diagrammes sur la même page
   * (l'impression en a un par feuille) partageraient sinon un `id`, et le
   * second verrait ses hachures tirées du premier.
   */
  idSuffix?: string;
}) {
  const fullH = Math.max(rowCount * ROW_H, ROW_H);
  const from = win ? win.from * ROW_H : 0;
  const height = win ? Math.min(win.count, rowCount - win.from) * ROW_H : fullH;

  const arrowId = `mg-arrow-${idSuffix}`;
  const bufferId = `mg-buffer-${idSuffix}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 ${from} ${width} ${height}`}
      style={{ display: "block", background: "var(--surface)" }}
      aria-hidden="true"
    >
      <defs>
        <marker id={arrowId} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill={GANTT.muted} />
        </marker>
        {/* La marge terminale n'est pas du travail : hachures, pas une barre. */}
        <pattern
          id={bufferId}
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
          y={0}
          width={Math.max(0, layout.deadlineX - layout.bufferX)}
          height={fullH}
          fill={`url(#${bufferId})`}
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
            y1={0}
            x2={x}
            y2={fullH}
            stroke={tick.major ? GANTT.gridStrong : GANTT.grid}
          />
        );
      })}

      {/* Lignes alternées — mêmes rangs que la grille de gauche */}
      {layout.rows.map((row, i) =>
        i % 2 === 1 ? (
          <rect
            key={row.taskId}
            x={0}
            y={i * ROW_H}
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
          points={link.points.map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke={GANTT.muted}
          strokeWidth={1}
          markerEnd={`url(#${arrowId})`}
          opacity={0.75}
        />
      ))}

      {/* Barres */}
      {layout.bars.map((bar) => {
        const y = bar.y;

        if (bar.diamond) {
          const cy = y + bar.height / 2;
          const r = 6;
          return (
            <g key={bar.taskId}>
              <polygon
                points={`${bar.x},${cy - r} ${bar.x + r},${cy} ${bar.x},${cy + r} ${bar.x - r},${cy}`}
                fill={GANTT.milestone}
                stroke={GANTT.text}
                strokeWidth={0.5}
              >
                <title>{bar.label}</title>
              </polygon>
              {showNames && (
                <text
                  x={bar.x + r + 5}
                  y={cy + 3.5}
                  fontSize={10}
                  fill={GANTT.text}
                  style={{ pointerEvents: "none" }}
                >
                  {bar.label}
                </text>
              )}
            </g>
          );
        }

        // Quatre états, et la nuance décisive est « non renseigné » : une
        // tâche dont la fin est passée sans avancement saisi n'est PAS en
        // retard — on n'en sait rien. La dire en rose serait affirmer un fait
        // que personne n'a constaté.
        //
        // ORDRE DE PRÉCÉDENCE DES COULEURS, et il n'est pas arbitraire :
        //   1. le RETARD prime sur tout. Savoir qu'une tâche dérape importe
        //      plus que savoir à qui elle incombe ;
        //   2. un récapitulatif garde sa couleur de structure (jaune de la
        //      charte) : il n'est responsable de rien, il agrège ;
        //   3. sinon, l'ENTITÉ RESPONSABLE, quand un responsable est nommé ;
        //   4. à défaut, l'accent : la majorité des tâches du plan n'ont pas
        //      encore de responsable, et les peindre d'une couleur d'entité
        //      arbitraire affirmerait une attribution qui n'existe pas.
        const entityColor = bar.ownerOrgCode ? ENTITY_COLOR[bar.ownerOrgCode] : undefined;
        const fill =
          bar.status === "late"
            ? "#ea9999"
            : bar.type === "summary"
              ? GANTT.summary
              : (entityColor ?? "var(--accent)");

        const unreported = bar.status === "unreported";
        const tip =
          bar.label +
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
            {/* Avancement : remplissage INTÉRIEUR, comme sous MS Project.
                EN CLAIR sur la barre, et non en sombre : la barre est déjà d'un
                bleu profond, si bien qu'un gris foncé à demi transparent y
                disparaissait. Le contraste doit venir de la clarté. */}
            {bar.progressWidth > 0 && (
              <rect
                x={bar.x + 1.5}
                y={y + 2.5}
                width={Math.max(0, bar.progressWidth - 3)}
                height={bar.height - 5}
                rx={1}
                fill={unreported ? "var(--accent)" : "#ffffff"}
                opacity={unreported ? 0.75 : 0.92}
              >
                <title>{tip}</title>
              </rect>
            )}

            {/* Nom de la tâche. À DROITE de la barre plutôt que dedans : une
                barre courte ne peut pas contenir son libellé, et un texte
                tronqué à trois lettres ne renseigne personne. */}
            {showNames && (
              <text
                x={bar.x + bar.width + 6}
                y={y + bar.height / 2 + 3.5}
                fontSize={10}
                fill={GANTT.text}
                style={{ pointerEvents: "none" }}
              >
                {bar.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Repères verticaux, au-dessus de tout */}
      {layout.deadlineX !== null && (
        <line
          x1={layout.deadlineX}
          y1={0}
          x2={layout.deadlineX}
          y2={fullH}
          stroke={GANTT.text}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        >
          <title>{labels.deadline}</title>
        </line>
      )}
      {layout.todayX !== null && (
        <g>
          <line
            x1={layout.todayX}
            y1={0}
            x2={layout.todayX}
            y2={fullH}
            stroke={GANTT.today}
            strokeWidth={1.5}
          >
            <title>{labels.today}</title>
          </line>
          <polygon
            points={`${layout.todayX - 4},0 ${layout.todayX + 4},0 ${layout.todayX},5`}
            fill={GANTT.today}
          />
        </g>
      )}
    </svg>
  );
}
