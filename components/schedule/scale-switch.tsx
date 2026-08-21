import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { GANTT } from "@/lib/tokens";
import { cn } from "@/lib/cn";
import type { ScaleUnit } from "@/lib/gantt/scale";
import type { SiteChoice } from "./board-types";

/**
 * Barre d'outils du plan de charge : échelle, filtres, légende.
 *
 * Trois filtres, car le brief §9.4 demande « projet entier, un contrat, un
 * site ». Le sous-projet s'y ajoute parce que c'est le niveau AUQUEL LE PLAN
 * EST ÉCRIT : filtrer par site s'y ramène (voir la page).
 *
 * Tout passe par l'URL, donc une vue se partage par un lien et survit à un
 * rechargement — ce qui compte pour un outil dont les captures finissent dans
 * les rapports mensuels envoyés à l'AFD.
 */
export async function ScaleSwitch({
  scale,
  scales,
  contractCodes,
  currentContract,
  sites,
  currentSite,
  subprojects,
  currentSubproject,
  compact,
  scenarioCode,
}: {
  scale: ScaleUnit;
  scales: ScaleUnit[];
  contractCodes: string[];
  currentContract: string | null;
  sites: SiteChoice[];
  currentSite: string | null;
  subprojects: string[];
  currentSubproject: string | null;
  compact: boolean;
  scenarioCode: string;
}) {
  const { t } = await getI18n();

  /**
   * Tout passe par l'URL. `undefined` = garder la valeur courante ; `null` =
   * l'effacer. Sans cette distinction, poser un filtre effacerait les autres.
   */
  const href = (next: {
    scale?: ScaleUnit;
    contract?: string | null;
    site?: string | null;
    subproject?: string | null;
    cols?: "compact" | "all";
  }) => {
    const params = new URLSearchParams({ scenario: scenarioCode });
    params.set("scale", next.scale ?? scale);
    const contract = next.contract === undefined ? currentContract : next.contract;
    if (contract) params.set("contract", contract);
    const site = next.site === undefined ? currentSite : next.site;
    if (site) params.set("site", site);
    const sub = next.subproject === undefined ? currentSubproject : next.subproject;
    if (sub) params.set("subproject", sub);
    const cols = next.cols ?? (compact ? "compact" : "all");
    if (cols === "all") params.set("cols", "all");
    return `/schedule?${params.toString()}`;
  };

  const chip = "rounded px-2.5 py-1 text-xs font-medium transition-colors";
  const activeChip = "bg-[var(--surface)] text-[var(--text)] shadow-sm";
  const idleChip = "text-[var(--text-muted)] hover:text-[var(--text)]";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] p-2">
      <div
        role="group"
        aria-label={t("gantt.scale")}
        className="inline-flex items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
      >
        {scales.map((unit) => (
          <Link
            key={unit}
            href={href({ scale: unit })}
            aria-current={unit === scale ? "true" : undefined}
            className={cn(chip, unit === scale ? activeChip : idleChip)}
          >
            {t(`gantt.${unit}`)}
          </Link>
        ))}
      </div>

      {/* Portée. « Projet entier » efface les trois filtres à la fois : c'est
          le geste de retour, il doit être fiable. */}
      <div
        role="group"
        aria-label={t("gantt.filterScope")}
        className="inline-flex flex-wrap items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
      >
        <Link
          href={href({ contract: null, site: null, subproject: null })}
          aria-current={
            currentContract === null && currentSite === null && currentSubproject === null
              ? "true"
              : undefined
          }
          className={cn(
            chip,
            currentContract === null && currentSite === null && currentSubproject === null
              ? activeChip
              : idleChip,
          )}
        >
          {t("gantt.filterWholeProject")}
        </Link>
        {subprojects.map((code) => (
          <Link
            key={code}
            href={href({ subproject: code, site: null })}
            aria-current={code === currentSubproject && !currentSite ? "true" : undefined}
            className={cn(chip, code === currentSubproject && !currentSite ? activeChip : idleChip)}
          >
            {t(`schedule.sub_${code}`)}
          </Link>
        ))}
      </div>

      {sites.length > 0 && (
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {t("gantt.filterSite")}
          {/* Une liste déroulante et non des puces : 14 sites feraient 14
              puces, qui repousseraient la légende hors de l'écran. */}
          <SiteSelect
            sites={sites}
            current={currentSite}
            href={href}
            allLabel={t("gantt.filterAllSites")}
          />
        </label>
      )}

      {contractCodes.length > 0 && (
        <div
          role="group"
          aria-label={t("gantt.filterContract")}
          className="inline-flex flex-wrap items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
        >
          {/* « Tous les marchés », et non « projet entier » : trois contrôles
              portaient le même mot pour trois sens différents. */}
          <Link
            href={href({ contract: null })}
            aria-current={currentContract === null ? "true" : undefined}
            className={cn(chip, currentContract === null ? activeChip : idleChip)}
          >
            {t("gantt.filterAllContracts")}
          </Link>
          {contractCodes.map((code) => (
            <Link
              key={code}
              href={href({ contract: code })}
              aria-current={code === currentContract ? "true" : undefined}
              className={cn(chip, code === currentContract ? activeChip : idleChip)}
            >
              {code}
            </Link>
          ))}
        </div>
      )}

      {/* Colonnes. Le jeu réduit est le défaut : sinon la grille prend 986 px
          et le diagramme n'a plus de place pour exister. */}
      <Link
        href={href({ cols: compact ? "all" : "compact" })}
        className={
          "rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 " +
          "text-xs font-medium text-[var(--text)]"
        }
        title={t(compact ? "gantt.showAllColumnsHint" : "gantt.showFewerColumnsHint")}
      >
        {t(compact ? "gantt.showAllColumns" : "gantt.showFewerColumns")}
      </Link>

      <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
        <LegendItem color="var(--accent)" label={t("gantt.task")} />
        <LegendItem color={GANTT.text} label={t("gantt.summary")} />
        <LegendItem color={GANTT.milestone} label={t("gantt.milestone")} diamond />
        <LegendItem color="#ea9999" label={t("gantt.late")} />
        <LegendItem color="var(--accent-2)" label={t("gantt.unreported")} hollow />
        <LegendItem color={GANTT.today} label={t("gantt.today")} />
      </div>
    </div>
  );
}

/**
 * Sélecteur de site sans JavaScript : `details/summary` natif, chaque option
 * est un lien. Le composant reste serveur — pas de bundle envoyé au
 * navigateur pour un filtre qu'on utilise trois fois par jour.
 */
function SiteSelect({
  sites,
  current,
  href,
  allLabel,
}: {
  sites: SiteChoice[];
  current: string | null;
  href: (next: { site?: string | null; subproject?: string | null }) => string;
  allLabel: string;
}) {
  const selected = sites.find((s) => s.siteCode === current) ?? null;
  return (
    <details className="relative">
      <summary
        className={
          "cursor-pointer list-none rounded border border-[var(--border)] bg-[var(--surface)] " +
          "px-2 py-1 text-xs font-medium text-[var(--text)]"
        }
      >
        {selected ? `${selected.siteCode} — ${selected.name}` : allLabel}
      </summary>
      <div
        className={
          "absolute left-0 z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border " +
          "border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
        }
      >
        <Link
          href={href({ site: null })}
          className="block rounded px-2 py-1 text-xs hover:bg-[var(--app-bg)]"
        >
          {allLabel}
        </Link>
        {sites.map((s) => (
          <Link
            key={s.id}
            href={href({ site: s.siteCode, subproject: null })}
            aria-current={s.siteCode === current ? "true" : undefined}
            className={cn(
              "block rounded px-2 py-1 text-xs hover:bg-[var(--app-bg)]",
              s.siteCode === current && "bg-[var(--app-bg)] font-medium",
            )}
          >
            <span className="font-mono">{s.siteCode}</span> — {s.name}
          </Link>
        ))}
      </div>
    </details>
  );
}

function LegendItem({
  color,
  label,
  diamond = false,
  hollow = false,
}: {
  color: string;
  label: string;
  diamond?: boolean;
  /** Barre creuse à contour tireté : « on n'en sait rien », pas « c'est fini ». */
  hollow?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5"
        style={{
          backgroundColor: hollow ? "transparent" : color,
          border: hollow ? `1.2px dashed ${color}` : undefined,
          borderRadius: diamond ? 0 : 2,
          transform: diamond ? "rotate(45deg)" : undefined,
        }}
      />
      {label}
    </span>
  );
}
