import { getI18n } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { GANTT, STATUS } from "@/lib/tokens";
import { PX_PER_DAY, buildTicks, suggestScale } from "@/lib/gantt/scale";
import { addDays, daysBetween } from "@/lib/schedule/dates";
import { timelineLabel } from "@/lib/roadmap/timeline";
import type { RoadmapActionRow, RoadmapStatus } from "@/lib/roadmap/types";
import type { RoadmapGroup } from "@/lib/roadmap/filter";

const ROW_H = 26;
const HEAD_H = 36;
const LABEL_W = 280;

/**
 * Frise de la roadmap.
 *
 * ⚠ LES ACTIONS SANS DATE SONT MONTRÉES, PAS ÉCARTÉES.
 *
 * Neuf des quatorze actions reprises du tableur n'ont aucune échéance. Une
 * frise qui ne dessinerait que les cinq autres donnerait l'image d'une roadmap
 * largement planifiée, alors que l'essentiel ne l'est pas. Elles vivent donc
 * dans une voie « sans date », sous l'axe, avec leur compte.
 *
 * La barre dit l'ÉTENDUE, jamais la précision : une semaine occupe sept jours
 * parce qu'elle dure sept jours. C'est l'infobulle qui rappelle la formulation
 * exacte — « Week of 12/10/2026 » — pour qu'un lecteur ne prenne pas le bord
 * gauche d'une barre hebdomadaire pour une date de début arrêtée.
 *
 * L'échelle et les graduations viennent de `lib/gantt/scale`, déjà éprouvées
 * par le plan de charge : aucune arithmétique de dates n'est réécrite ici.
 */
export async function RoadmapTimeline({
  groups,
  undated,
  today,
}: {
  groups: RoadmapGroup[];
  undated: RoadmapActionRow[];
  today: string;
}) {
  const { t, locale } = await getI18n();

  const dated = groups.flatMap((g) => g.actions);
  if (dated.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
        {t("roadmap.noDated")}
      </Card>
    );
  }

  // Fenêtre : de la première échéance à la dernière, élargie d'une marge pour
  // que les barres extrêmes ne collent pas au bord.
  const starts = dated.map((a) => a.timeline.start!).sort();
  const ends = dated.map((a) => a.timeline.end!).sort();
  const from = addDays(starts[0], -7);
  const to = addDays(ends[ends.length - 1], 7);

  const scale = suggestScale(daysBetween(from, to));
  const pxPerDay = PX_PER_DAY[scale];

  // ⚠ L'ORIGINE N'EST PAS `from`. `buildTicks` recale le départ sur le début de
  // la première période — sinon une frise mensuelle commençant un 17 décalerait
  // toutes les colonnes d'une demi-largeur. Les abscisses se mesurent donc
  // depuis `origin`, et l'employer à la place de `from` décalerait les barres
  // de quelques jours en silence.
  const { origin, ticks, totalDays } = buildTicks(scale, from, to, locale);
  const width = Math.max(totalDays * pxPerDay, 360);

  const x = (iso: string) => daysBetween(origin, iso) * pxPerDay;

  // Une ligne par action, les intertitres de sujet comprises.
  const rows: ({ kind: "subject"; name: string } | { kind: "action"; action: RoadmapActionRow })[] =
    [];
  for (const g of groups) {
    rows.push({ kind: "subject", name: g.subjectName });
    for (const a of g.actions) rows.push({ kind: "action", action: a });
  }
  const height = rows.length * ROW_H;

  return (
    <Card className="overflow-hidden">
      {/* Une SEULE zone de défilement porte les deux axes : deux zones
          distinctes désynchronisent les lignes dès qu'on fait défiler. */}
      <div className="max-h-[70vh] overflow-auto">
        <div className="flex w-max items-start">
          {/* Libellés, figés à gauche pendant le défilement horizontal. */}
          <div
            className="sticky left-0 z-10 shrink-0 bg-[var(--surface)]"
            style={{ width: LABEL_W }}
          >
            <div
              className="sticky top-0 z-20 border-b border-r border-[var(--border)] bg-[var(--app-bg)]"
              style={{ height: HEAD_H }}
            />
            {rows.map((row, i) =>
              row.kind === "subject" ? (
                <div
                  key={`s${i}`}
                  className="flex items-center border-b border-r border-[var(--border)] bg-[var(--app-bg)] px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                  style={{ height: ROW_H }}
                >
                  <span className="truncate">{row.name}</span>
                </div>
              ) : (
                <div
                  key={row.action.id}
                  className="flex items-center border-b border-r border-[var(--border)] px-2 pl-4 text-[13px]"
                  style={{ height: ROW_H }}
                  title={row.action.title}
                >
                  <span className="truncate">{row.action.title}</span>
                </div>
              ),
            )}
          </div>

          <div className="shrink-0" style={{ width }}>
            {/* Échelle, collée en haut comme l'en-tête des libellés. */}
            <svg
              width={width}
              height={HEAD_H}
              className="sticky top-0 z-[5]"
              style={{ display: "block", background: GANTT.band }}
              aria-hidden="true"
            >
              {ticks.map((tick) => {
                const tx = tick.offsetDays * pxPerDay;
                const tw = tick.spanDays * pxPerDay;
                if (tw < 26) return null;
                return (
                  <text
                    key={tick.date}
                    x={tx + tw / 2}
                    y={HEAD_H - 13}
                    textAnchor="middle"
                    fontSize={10}
                    fill={tick.major ? GANTT.text : GANTT.muted}
                    fontWeight={tick.major ? 600 : 400}
                  >
                    {tick.label}
                  </text>
                );
              })}
              <line x1={0} y1={HEAD_H - 0.5} x2={width} y2={HEAD_H - 0.5} stroke={GANTT.gridStrong} />
            </svg>

            <svg
              width={width}
              height={height}
              style={{ display: "block", background: "var(--surface)" }}
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

              {rows.map((row, i) =>
                row.kind === "subject" ? (
                  <rect
                    key={`sb${i}`}
                    x={0}
                    y={i * ROW_H}
                    width={width}
                    height={ROW_H}
                    fill={GANTT.band}
                    opacity={0.5}
                  />
                ) : null,
              )}

              {rows.map((row, i) => {
                if (row.kind !== "action") return null;
                const a = row.action;
                const bx = x(a.timeline.start!);
                const bw = Math.max((daysBetween(a.timeline.start!, a.timeline.end!)) * pxPerDay, 4);
                const label = timelineLabel(a.timeline, locale);
                return (
                  <g key={a.id}>
                    <rect
                      x={bx}
                      y={i * ROW_H + 6}
                      width={bw}
                      height={ROW_H - 12}
                      rx={3}
                      fill={barFill(a.status)}
                      stroke={a.priority === "urgent" ? "var(--danger)" : undefined}
                      strokeWidth={a.priority === "urgent" ? 1.4 : 0}
                    >
                      {/* La formulation exacte, pour qu'on ne lise pas le bord
                          d'une barre hebdomadaire comme un jour arrêté. */}
                      <title>
                        {a.title} · {t(`roadmap.timeline_${label.key}`, label.values)}
                      </title>
                    </rect>
                  </g>
                );
              })}

              {/* Aujourd'hui. Hors fenêtre, on ne le dessine pas plutôt que de
                  le coller au bord, ce qui le ferait lire comme une échéance. */}
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
      </div>

      {undated.length > 0 && (
        <div className="border-t border-[var(--border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t("roadmap.undatedLane")} · {t("roadmap.undatedCount", { count: String(undated.length) })}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {undated.map((a) => (
              <li
                key={a.id}
                className="rounded border border-[var(--border)] bg-[var(--app-bg)] px-2 py-1 text-xs text-[var(--text)]"
                style={
                  a.priority === "urgent" ? { borderColor: "var(--danger)" } : undefined
                }
              >
                {a.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/** Couleur par STATUT : une frise répond d'abord à « où en est-on ? ». */
function barFill(status: RoadmapStatus | null): string {
  if (status === "done") return STATUS.done.bg;
  if (status === "in_progress") return STATUS.running.bg;
  return STATUS.upcoming.bg;
}
