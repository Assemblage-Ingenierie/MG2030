import { getI18n } from "@/lib/i18n/server";
import { Card, Section } from "@/components/ui/card";

/**
 * Schéma de fonctionnement : comment les onglets s'alimentent.
 *
 * Demandé le 25/09/2026 pour rendre visibles les interactions entre les
 * données. SVG fait main, comme le Gantt : aucune bibliothèque, et les
 * couleurs sont celles de la charte (`var(--…)`), jamais écrites en dur.
 *
 * CODE COULEUR PAR GROUPE, celui de la barre latérale :
 *   référentiel    → bleu nuit plein, texte blanc ;
 *   planification  → jaune de l'accent secondaire ;
 *   documents      → surface blanche, bordure neutre ;
 *   administration → surface blanche, bordure bleu nuit en pointillé ;
 *   accueil        → fond ivoire, bordure bleu nuit.
 * La forme du trait double la couleur : un groupe ne se reconnaît pas à la
 * seule teinte.
 *
 * Chaque case est un lien vers l'onglet qu'elle représente.
 */

type Group = "referential" | "planning" | "documents" | "admin" | "home";

const GROUP_STYLE: Record<
  Group,
  { fill: string; stroke: string; dash?: string; width: number; title: string; sub: string }
> = {
  referential: {
    fill: "var(--accent)",
    stroke: "var(--accent)",
    width: 1,
    title: "var(--on-accent)",
    sub: "color-mix(in srgb, var(--on-accent) 78%, transparent)",
  },
  planning: {
    fill: "color-mix(in srgb, var(--accent-2) 38%, var(--surface))",
    stroke: "var(--accent-2)",
    width: 1.5,
    title: "var(--text)",
    sub: "var(--text-muted)",
  },
  documents: {
    fill: "var(--surface)",
    stroke: "var(--border)",
    width: 1.5,
    title: "var(--text)",
    sub: "var(--text-muted)",
  },
  admin: {
    fill: "var(--surface)",
    stroke: "var(--accent)",
    dash: "5 3",
    width: 1.5,
    title: "var(--text)",
    sub: "var(--text-muted)",
  },
  home: {
    fill: "var(--app-bg)",
    stroke: "var(--accent)",
    width: 2,
    title: "var(--text)",
    sub: "var(--text-muted)",
  },
};

interface Node {
  key: string;
  href: string;
  group: Group;
  x: number;
  y: number;
}

const W = 160;
const H = 56;

const NODES: Node[] = [
  { key: "sites", href: "/sites", group: "referential", x: 40, y: 40 },
  { key: "contracts", href: "/contracts", group: "referential", x: 260, y: 40 },
  { key: "users", href: "/org-chart", group: "admin", x: 480, y: 40 },
  { key: "buildings", href: "/buildings", group: "referential", x: 40, y: 140 },
  { key: "lots", href: "/contracts", group: "referential", x: 260, y: 140 },
  { key: "procurement", href: "/procurement", group: "planning", x: 40, y: 250 },
  { key: "plan", href: "/schedule", group: "planning", x: 260, y: 250 },
  { key: "deliverables", href: "/deliverables", group: "planning", x: 480, y: 250 },
  { key: "noc", href: "/no-objections", group: "planning", x: 260, y: 360 },
  { key: "library", href: "/library", group: "documents", x: 480, y: 360 },
  { key: "home", href: "/", group: "home", x: 260, y: 470 },
];

/** Liaisons : tracé SVG, étiquette et sa position. */
const EDGES: {
  d: string;
  both?: boolean;
  label: string;
  lx: number;
  ly: number;
  anchor?: "start" | "middle" | "end";
}[] = [
  { d: "M120 96 V138", label: "edgeBuildings", lx: 128, ly: 122 },
  { d: "M340 96 V138", label: "edgeLots", lx: 348, ly: 122 },
  { d: "M202 168 H258", both: true, label: "edgeLotBuilding", lx: 230, ly: 160, anchor: "middle" },
  { d: "M260 68 H230 V278 H202", label: "edgeAnchor", lx: 224, ly: 238, anchor: "end" },
  { d: "M200 292 H258", label: "edgeTasks", lx: 230, ly: 304, anchor: "middle" },
  { d: "M620 96 V232 H380 V248", label: "edgeOwner", lx: 628, ly: 160 },
  { d: "M420 168 H540 V248", label: "edgeContractLot", lx: 534, ly: 186, anchor: "end" },
  { d: "M340 306 V358", label: "edgeDuration", lx: 348, ly: 336 },
  { d: "M120 306 V388 H258", label: "edgeDraftNoc", lx: 128, ly: 342 },
  { d: "M340 416 V468", label: "edgeCounts", lx: 348, ly: 446 },
  { d: "M640 68 H662 V388 H642", label: "edgeRoles", lx: 656, ly: 336, anchor: "end" },
];

const STEPS = ["step1", "step2", "step3", "step4", "step5", "step6", "step7", "step8"];
const LEGEND: Group[] = ["referential", "planning", "documents", "admin", "home"];

export default async function DataFlowsPage() {
  const { t } = await getI18n();

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Section title={t("flows.title")} description={t("flows.intro")}>
        <Card className="p-4">
          <svg
            viewBox="0 0 680 540"
            className="mx-auto block h-auto w-full max-w-[880px]"
            role="img"
            aria-labelledby="flows-title flows-desc"
          >
            <title id="flows-title">{t("flows.title")}</title>
            <desc id="flows-desc">{t("flows.intro")}</desc>
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path
                  d="M2 1L8 5L2 9"
                  fill="none"
                  stroke="context-stroke"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>

            {/* Liaisons d'abord : les cases passent par-dessus. */}
            {EDGES.map((e) => (
              <g key={e.label}>
                <path
                  d={e.d}
                  fill="none"
                  style={{ stroke: "var(--text-muted)" }}
                  strokeWidth={1.3}
                  markerEnd="url(#flow-arrow)"
                  markerStart={e.both ? "url(#flow-arrow)" : undefined}
                />
                <text
                  x={e.lx}
                  y={e.ly}
                  textAnchor={e.anchor ?? "start"}
                  fontSize={11}
                  style={{ fill: "var(--text-muted)" }}
                >
                  {t(`flows.${e.label}`)}
                </text>
              </g>
            ))}

            {NODES.map((n) => {
              const s = GROUP_STYLE[n.group];
              return (
                <a key={n.key} href={n.href} aria-label={t(`flows.node_${n.key}`)}>
                  <rect
                    x={n.x}
                    y={n.y}
                    width={W}
                    height={H}
                    rx={8}
                    style={{ fill: s.fill, stroke: s.stroke }}
                    strokeWidth={s.width}
                    strokeDasharray={s.dash}
                  />
                  <text
                    x={n.x + W / 2}
                    y={n.y + 22}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={600}
                    style={{ fill: s.title }}
                  >
                    {t(`flows.node_${n.key}`)}
                  </text>
                  <text
                    x={n.x + W / 2}
                    y={n.y + 41}
                    textAnchor="middle"
                    fontSize={11}
                    style={{ fill: s.sub }}
                  >
                    {t(`flows.sub_${n.key}`)}
                  </text>
                </a>
              );
            })}
          </svg>

          {/* Légende : même rendu que les cases, en réduction. */}
          <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-2">
            {LEGEND.map((g) => {
              const s = GROUP_STYLE[g];
              return (
                <span key={g} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3 w-4 rounded-sm"
                    style={{
                      backgroundColor: s.fill,
                      border: `${Math.max(1, s.width)}px ${s.dash ? "dashed" : "solid"} ${s.stroke}`,
                    }}
                  />
                  {t(`flows.group_${g}`)}
                </span>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("flows.stepsTitle")}</h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--text)]">
            {STEPS.map((k) => (
              <li key={k}>{t(`flows.${k}`)}</li>
            ))}
          </ol>
        </Card>
      </Section>
    </div>
  );
}
