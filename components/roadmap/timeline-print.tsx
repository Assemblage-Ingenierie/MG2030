// ============================================================
// components/roadmap/timeline-print.tsx — la FRISE sur papier.
//
// ⚠ L'EXPORT PDF DE LA FRISE RENDAIT LA LISTE. Le bouton « PDF » emportait
// bien `view=timeline` dans l'adresse, mais la page d'impression ne lisait pas
// ce paramètre : on cliquait sur l'export depuis la frise et on obtenait le
// tableau. Signalé le 01/10/2026 — « l'export de la timeline ouvre un pdf de
// la roadmap ».
//
// Une page à part plutôt qu'une feuille de style, pour la même raison que le
// plan de charge : la frise de l'écran vit dans une zone qui défile et fait
// deux à trois mille pixels de large. Il faut la RECALCULER pour la largeur du
// papier — ici en répartissant les jours sur la place disponible — et non la
// réduire en CSS, ce qui donnerait des libellés de deux points.
//
// Trois partis pris, repris du Gantt :
//   • PAYSAGE, toujours ;
//   • PAGINATION EXPLICITE, chaque feuille portant son axe de temps. Laissé au
//     navigateur, le saut de page tombe au milieu d'une ligne et les barres
//     d'une feuille ne se rattachent plus à aucun libellé ;
//   • les COULEURS de l'écran, pastilles de statut et liseré d'urgence
//     compris : qui a suivi la revue à l'écran doit retrouver ses repères.
// ============================================================

import { GANTT, ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import { buildTicks, periodBand, suggestScale } from "@/lib/gantt/scale";
import { addDays, daysBetween } from "@/lib/schedule/dates";
import { shortAssignee } from "@/lib/roadmap/assignee-label";
import { paginate, printGeometry } from "@/lib/schedule/print-layout";
import {
  ROADMAP_STATUSES,
  type RoadmapActionRow,
  type RoadmapStatus,
} from "@/lib/roadmap/types";
import type { RoadmapGroup } from "@/lib/roadmap/filter";

const ROW_H = 22;
/** Bande des mois (ou trimestres), au-dessus de l'échelle fine. */
const BAND_H = 16;
const TICK_H = 18;
const HEAD_H = BAND_H + TICK_H;
/** Bandeau de titre, répété en tête de chaque feuille. */
const SHEET_HEAD_H = 40;

type Row =
  | { kind: "subject"; name: string; orphan: boolean }
  | { kind: "action"; action: RoadmapActionRow };

export function RoadmapTimelinePrint({
  groups,
  undated,
  today,
  locale,
  labels,
}: {
  groups: RoadmapGroup[];
  undated: RoadmapActionRow[];
  today: string;
  locale: "en" | "sq";
  /** Déjà traduits : ce composant ne lit pas le dictionnaire. */
  labels: {
    title: string;
    issued: string;
    filters: string;
    noFilter: string;
    applied: string;
    noSubject: string;
    undatedLane: string;
    legendStatus: string;
    legendUrgent: string;
    status: Record<RoadmapStatus, string>;
  };
}) {
  const geometry = printGeometry("a4");
  const labelWidth = geometry.nameWidth;
  const chartWidth = geometry.pageWidth - labelWidth;

  const dated = groups.flatMap((g) => g.actions);

  // Même fenêtre qu'à l'écran : de la première échéance à la dernière, élargie
  // d'une semaine pour que les barres extrêmes ne collent pas au bord.
  const starts = dated.map((a) => a.timeline.start!).sort();
  const ends = dated.map((a) => a.timeline.end!).sort();
  const from = addDays(starts[0], -7);
  const to = addDays(ends[ends.length - 1], 7);

  const scale = suggestScale(daysBetween(from, to));

  /* ⚠ L'ORIGINE N'EST PAS `from`. `buildTicks` recale le départ sur le début
     de la première période ; mesurer les abscisses depuis `from` décalerait
     toutes les barres de quelques jours en silence. */
  const { origin, ticks, totalDays } = buildTicks(scale, from, to, locale);

  /* C'EST LA FEUILLE QUI DICTE LA DENSITÉ, et non l'échelle. À l'écran on
     défile ; ici la largeur est donnée, et les jours s'y répartissent. */
  const pxPerDay = chartWidth / Math.max(totalDays, 1);
  const band = periodBand(totalDays > 540 ? "quarter" : "month", origin, totalDays, locale);
  const x = (iso: string) => daysBetween(origin, iso) * pxPerDay;

  const rows: Row[] = [];
  for (const group of groups) {
    rows.push({
      kind: "subject",
      name: group.subjectName ?? labels.noSubject,
      orphan: group.subjectId === null,
    });
    for (const action of group.actions) rows.push({ kind: "action", action });
  }

  const rowsPerSheet = Math.max(
    1,
    Math.floor((geometry.pageHeight - SHEET_HEAD_H - HEAD_H - 16) / ROW_H),
  );
  const sheets = paginate(rows.length, rowsPerSheet);

  return (
    <div className="mx-auto flex flex-col gap-4" style={{ width: geometry.pageWidth }}>
      <style>{`@page { size: ${geometry.pageCss}; margin: 8mm; }`}</style>

      {sheets.map((sheet, index) => {
        const window = rows.slice(sheet.from, sheet.from + sheet.count);
        const height = window.length * ROW_H;

        return (
          <section
            key={sheet.from}
            className="print-sheet border border-[var(--border)] bg-white"
            style={{ width: geometry.pageWidth }}
          >
            {/* Répété sur CHAQUE feuille : une page détachée de la liasse doit
                encore dire ce qu'elle montre et de quand elle date. */}
            <header
              className="flex items-end justify-between border-b-2 px-2 pb-1"
              style={{ height: SHEET_HEAD_H, borderColor: "var(--accent)" }}
            >
              <div>
                <h1 className="text-sm font-semibold text-[var(--text)]">{labels.title}</h1>
                <p className="text-[9px] text-[var(--text-muted)]">
                  {`${labels.issued} ${today} · ${labels.filters} ${labels.applied === "" ? labels.noFilter : labels.applied}`}
                </p>
              </div>
              <p className="text-[9px] text-[var(--text-muted)]">
                {`${index + 1}/${sheets.length}`}
              </p>
            </header>

            <div className="flex items-start">
              <div style={{ width: labelWidth }}>
                {/* Cale de la hauteur de l'axe : sans elle, la première ligne
                    se retrouve en face de l'échelle de temps et tout le reste
                    est décalé d'un cran. */}
                <div
                  style={{ height: HEAD_H }}
                  className="border-b border-r border-[var(--border)]"
                />
                {window.map((row, i) =>
                  row.kind === "subject" ? (
                    <div
                      key={`s${sheet.from + i}`}
                      className="flex items-center overflow-hidden border-b border-r border-[var(--border)] px-1.5 text-[9px] font-semibold uppercase tracking-wide"
                      style={{
                        height: ROW_H,
                        // Le bleu de la charte dans la POLICE et non en aplat :
                        // une bande pleine boit l'encre, et une imprimante en
                        // nuances de gris y noierait le texte.
                        color: row.orphan ? "var(--danger)" : "var(--accent)",
                      }}
                    >
                      <span className="truncate">{row.name}</span>
                    </div>
                  ) : (
                    <div
                      key={row.action.id}
                      className="flex items-center gap-1 overflow-hidden border-b border-r border-[var(--border)] py-0 pl-3 pr-1.5 text-[9px] text-[var(--text)]"
                      style={{ height: ROW_H }}
                    >
                      <span className="truncate font-medium">{row.action.title}</span>
                      {row.action.assignees.length > 0 && (
                        <span className="shrink-0 text-[8px] text-[var(--text-muted)]">
                          {row.action.assignees.map((a) => shortAssignee(a.label)).join(", ")}
                        </span>
                      )}
                    </div>
                  ),
                )}
              </div>

              <div style={{ width: chartWidth }}>
                <svg
                  width={chartWidth}
                  height={HEAD_H}
                  style={{ display: "block", background: GANTT.band }}
                  aria-hidden="true"
                >
                  {band.map((tick) => {
                    const tx = tick.offsetDays * pxPerDay;
                    const tw = tick.spanDays * pxPerDay;
                    return (
                      <g key={`b-${tick.date}`}>
                        <line x1={tx} y1={0} x2={tx} y2={HEAD_H} stroke={GANTT.gridStrong} />
                        {tw >= 26 && (
                          <text
                            x={tx + tw / 2}
                            y={BAND_H - 4}
                            textAnchor="middle"
                            fontSize={9}
                            fontWeight={600}
                            fill={GANTT.text}
                          >
                            {tick.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <line
                    x1={0}
                    y1={BAND_H - 0.5}
                    x2={chartWidth}
                    y2={BAND_H - 0.5}
                    stroke={GANTT.grid}
                  />

                  {/* Même règle qu'à l'écran : plutôt qu'un axe entièrement
                      muet, un libellé sur deux quand la place manque. */}
                  {ticks.map((tick) => {
                    const tx = tick.offsetDays * pxPerDay;
                    const tw = tick.spanDays * pxPerDay;
                    const everyOther =
                      tw < 22 && tick.offsetDays % (2 * tick.spanDays) !== 0;
                    if (tw < 11 || everyOther) return null;
                    return (
                      <text
                        key={tick.date}
                        x={tx + tw / 2}
                        y={HEAD_H - 5}
                        textAnchor="middle"
                        fontSize={8}
                        fill={tick.major ? GANTT.text : GANTT.muted}
                        fontWeight={tick.major ? 600 : 400}
                      >
                        {tick.label}
                      </text>
                    );
                  })}
                  <line
                    x1={0}
                    y1={HEAD_H - 0.5}
                    x2={chartWidth}
                    y2={HEAD_H - 0.5}
                    stroke={GANTT.gridStrong}
                  />
                </svg>

                <svg
                  width={chartWidth}
                  height={height}
                  style={{ display: "block", background: "#ffffff" }}
                  aria-hidden="true"
                >
                  {ticks.map((tick) => (
                    <line
                      key={tick.date}
                      x1={tick.offsetDays * pxPerDay}
                      y1={0}
                      x2={tick.offsetDays * pxPerDay}
                      y2={height}
                      stroke={tick.major ? GANTT.gridStrong : GANTT.grid}
                    />
                  ))}

                  {window.map((row, i) =>
                    row.kind === "subject" ? (
                      <rect
                        key={`sb${sheet.from + i}`}
                        x={0}
                        y={i * ROW_H}
                        width={chartWidth}
                        height={ROW_H}
                        fill={GANTT.band}
                        opacity={0.5}
                      />
                    ) : null,
                  )}

                  {window.map((row, i) => {
                    if (row.kind !== "action") return null;
                    const a = row.action;
                    const bx = x(a.timeline.start!);
                    const bw = Math.max(
                      daysBetween(a.timeline.start!, a.timeline.end!) * pxPerDay,
                      3,
                    );
                    return (
                      <g key={a.id}>
                        {a.priority === "urgent" && (
                          <rect
                            x={bx - 2}
                            y={i * ROW_H + 2.5}
                            width={bw + 4}
                            height={ROW_H - 5}
                            rx={3}
                            fill="none"
                            stroke={ROADMAP_PRIORITY.urgent}
                            strokeWidth={1.4}
                          />
                        )}
                        <rect
                          x={bx}
                          y={i * ROW_H + 5}
                          width={bw}
                          height={ROW_H - 10}
                          rx={2}
                          fill={barFill(a.status)}
                        />
                      </g>
                    );
                  })}

                  {today >= origin && daysBetween(origin, today) <= totalDays && (
                    <line
                      x1={x(today)}
                      y1={0}
                      x2={x(today)}
                      y2={height}
                      stroke={GANTT.today}
                      strokeWidth={1.5}
                    />
                  )}
                </svg>
              </div>
            </div>

            {/* La légende sur la DERNIÈRE feuille seulement : on vient y
                vérifier une couleur, et la répéter quatre fois mangerait
                quatre lignes de frise. */}
            {index === sheets.length - 1 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] px-2 py-1 text-[8px] text-[var(--text-muted)]">
                <span className="font-semibold">{labels.legendStatus}</span>
                {ROADMAP_STATUSES.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: ROADMAP_STATUS[status].bg }}
                    />
                    {labels.status[status]}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-3.5 rounded-sm border"
                    style={{ borderColor: ROADMAP_PRIORITY.urgent }}
                  />
                  {labels.legendUrgent}
                </span>
              </div>
            )}
          </section>
        );
      })}

      {/* Les actions SANS DATE, sur leur propre feuille. Les écarter de
          l'export donnerait l'image d'une roadmap entièrement planifiée alors
          que la majorité des actions ne le sont pas — même raison qu'à
          l'écran, où elles occupent une voie sous l'axe. */}
      {undated.length > 0 && (
        <section
          className="print-sheet border border-[var(--border)] bg-white p-3"
          style={{ width: geometry.pageWidth }}
        >
          <h2 className="mb-2 border-b pb-1 text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--accent)", borderColor: "var(--accent)" }}>
            {`${labels.undatedLane} · ${undated.length}`}
          </h2>
          <ul className="columns-2 gap-6 text-[10px] text-[var(--text)]">
            {undated.map((a) => (
              <li
                key={a.id}
                className="mb-1 flex items-start gap-1.5"
                style={{ breakInside: "avoid" }}
              >
                <span
                  aria-hidden="true"
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: barFill(a.status) }}
                />
                <span>{a.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Même table que les pastilles de la liste : une seule vérité par statut. */
function barFill(status: RoadmapStatus | null): string {
  return ROADMAP_STATUS[status ?? "not_started"].bg;
}
