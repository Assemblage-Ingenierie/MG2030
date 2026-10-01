import { getI18n } from "@/lib/i18n/server";
import { Card } from "@/components/ui/card";
import { GANTT, ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import { PX_PER_DAY, buildTicks, periodBand, suggestScale } from "@/lib/gantt/scale";
import { addDays, daysBetween } from "@/lib/schedule/dates";
import { timelineLabel } from "@/lib/roadmap/timeline";
import { ROADMAP_STATUSES, type RoadmapActionRow, type RoadmapStatus } from "@/lib/roadmap/types";
import type { RoadmapGroup } from "@/lib/roadmap/filter";
import { TimelineRow } from "./timeline-row";
import type { PersonOption } from "./assignee-picker";

const ROW_H = 28;
/** Bande des mois, au-dessus de l'échelle fine. */
const BAND_H = 18;
/** Bande de l'échelle choisie (jours, semaines…). */
const TICK_H = 20;
const HEAD_H = BAND_H + TICK_H;
const LABEL_W = 360;

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
 *
 * ⚠ LES COULEURS SONT CELLES DE LA LISTE, exactement. La frise peignait ses
 * barres avec `STATUS`, la palette générique du plan de charge : « en cours »
 * y était jaune alors que la liste l'affiche en bleu, et « bloqué » n'avait
 * aucune couleur propre — il tombait dans le gris de « à venir ». On lisait
 * donc deux codes couleur différents pour une même donnée, d'un onglet à
 * l'autre. Elles viennent maintenant de `ROADMAP_STATUS`, comme les pastilles
 * du tableau, et une légende les rappelle sous la frise.
 *
 * L'URGENCE se marque par un liseré rouge à GAUCHE de la barre, comme dans la
 * liste : un contour complet se confondait avec le rouge de « bloqué ».
 */
export async function RoadmapTimeline({
  groups,
  undated,
  today,
  people,
  shortNames,
}: {
  groups: RoadmapGroup[];
  undated: RoadmapActionRow[];
  today: string;
  /** Pour le choix d'assignataire depuis la frise. */
  people: PersonOption[];
  shortNames: boolean;
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

  /* ⚠ UNE BANDE DE MOIS AU-DESSUS DE L'ÉCHELLE FINE. « W41 » ne dit pas de
     quel mois il s'agit, et la frise se lisait en comptant les semaines depuis
     la dernière qu'on avait reconnue. La bande se cale sur la MÊME origine que
     le corps (voir `periodBand`), sinon les mois flottent de quelques jours
     au-dessus des semaines.

     Trimestres plutôt que mois quand la frise est très longue : douze libellés
     mensuels sur une année resserrée ne tiennent pas. */
  const band = periodBand(totalDays > 540 ? "quarter" : "month", origin, totalDays, locale);

  const x = (iso: string) => daysBetween(origin, iso) * pxPerDay;

  // Une ligne par action, les intertitres de sujet comprises.
  const rows: ({ kind: "subject"; name: string } | { kind: "action"; action: RoadmapActionRow })[] =
    [];
  for (const g of groups) {
    // `null` = groupe des actions dont le sujet a été supprimé (0040).
    rows.push({ kind: "subject", name: g.subjectName ?? t("roadmap.noSubject") });
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
                  className="flex items-center border-b border-r border-[var(--border)] px-2 pl-3 text-[13px]"
                  style={{ height: ROW_H }}
                >
                  <TimelineRow
                    actionId={row.action.id}
                    title={row.action.title}
                    assignees={row.action.assignees}
                    people={people}
                    notSetLabel={t("roadmap.notSet")}
                    shortNames={shortNames}
                  />
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
              {/* ── Bande des mois ──────────────────────────────────────── */}
              {band.map((tick) => {
                const tx = tick.offsetDays * pxPerDay;
                const tw = tick.spanDays * pxPerDay;
                return (
                  <g key={`b-${tick.date}`}>
                    <line x1={tx} y1={0} x2={tx} y2={HEAD_H} stroke={GANTT.gridStrong} />
                    {tw >= 30 && (
                      <text
                        x={tx + tw / 2}
                        y={BAND_H - 5}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill={GANTT.text}
                      >
                        {tick.label}
                      </text>
                    )}
                  </g>
                );
              })}
              <line x1={0} y1={BAND_H - 0.5} x2={width} y2={BAND_H - 0.5} stroke={GANTT.grid} />

              {/* ── Échelle fine ────────────────────────────────────────── */}
              {ticks.map((tick) => {
                const tx = tick.offsetDays * pxPerDay;
                const tw = tick.spanDays * pxPerDay;
                /* ⚠ LE SEUIL SUIT LA LARGEUR RÉELLE DE LA GRADUATION. Il valait
                   26 px en dur : à l'échelle du JOUR, une graduation fait
                   24 px, si bien que l'axe s'affichait entièrement MUET dès
                   qu'un filtre resserrait la frise sous deux mois — signalé le
                   01/10/2026 (« quand on filtre les Weeks disparaissent »).
                   On n'écrit plus qu'un libellé sur deux lorsque la place
                   manque, plutôt que de n'en écrire aucun. */
                const everyOther = tw < 22 && tick.offsetDays % (2 * tick.spanDays) !== 0;
                if (tw < 11 || everyOther) return null;
                return (
                  <text
                    key={tick.date}
                    x={tx + tw / 2}
                    y={HEAD_H - 6}
                    textAnchor="middle"
                    fontSize={9}
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
                    {/* ⚠ L'URGENCE CERCLE LA BARRE (01/10/2026). Elle était
                        marquée par un trait à gauche, qui disparaissait sur une
                        barre d'un jour — large de quatre pixels, le trait
                        valait presque autant que la barre. Le contour tient sur
                        n'importe quelle largeur ; il est épais et détaché de
                        deux pixels, pour rester visible même sur le rouge de
                        « bloqué ». */}
                    {a.priority === "urgent" && (
                      <rect
                        x={bx - 2.5}
                        y={i * ROW_H + 3.5}
                        width={bw + 5}
                        height={ROW_H - 7}
                        rx={4}
                        fill="none"
                        stroke={ROADMAP_PRIORITY.urgent}
                        strokeWidth={1.6}
                      />
                    )}
                    <rect
                      x={bx}
                      y={i * ROW_H + 6}
                      width={bw}
                      height={ROW_H - 12}
                      rx={3}
                      fill={barFill(a.status)}
                    >
                      {/* La formulation exacte, pour qu'on ne lise pas le bord
                          d'une barre hebdomadaire comme un jour arrêté.

                          ⚠ UNE SEULE EXPRESSION, et non `{x} · {y}`. Un
                          `<title>` SVG ne peut contenir que du texte : React
                          sépare plusieurs enfants par des marqueurs côté
                          serveur, que le navigateur n'accepte pas ici, et
                          l'hydratation échouait sur toute la frise. */}
                      <title>{`${a.title} · ${t(`roadmap.timeline_${label.key}`, label.values)}`}</title>
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

      {/* La légende sous la frise, et non au-dessus : on vient y vérifier une
          couleur qu'on vient de voir, pas apprendre un code avant de lire. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--text-muted)]">
        <span className="font-medium">{t("roadmap.legendStatus")}</span>
        {ROADMAP_STATUSES.map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: ROADMAP_STATUS[status].bg }}
            />
            {t(`roadmap.status_${status}`)}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-4 rounded-sm border-[1.5px]"
            style={{ borderColor: ROADMAP_PRIORITY.urgent }}
          />
          {t("roadmap.legendUrgent")}
        </span>
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
                title={a.title}
                className="flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--app-bg)] py-1 pr-2 text-xs text-[var(--text)]"
                style={
                  a.priority === "urgent"
                    ? { borderColor: ROADMAP_PRIORITY.urgent, borderWidth: 1.5 }
                    : undefined
                }
              >
                {/* La même pastille que dans la frise : une action sans date
                    n'est pas une action sans statut. */}
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ marginLeft: 6, backgroundColor: barFill(a.status) }}
                />
                {a.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

/**
 * Couleur par STATUT : une frise répond d'abord à « où en est-on ? ».
 *
 * MÊME TABLE que les pastilles de la liste (`lib/tokens.ts`). Une action sans
 * statut garde le gris de « non commencé » : c'est le plus neutre des cinq, et
 * inventer une sixième couleur pour « on ne sait pas » chargerait la légende
 * d'un cas qui ne se décide jamais.
 */
function barFill(status: RoadmapStatus | null): string {
  return ROADMAP_STATUS[status ?? "not_started"].bg;
}
