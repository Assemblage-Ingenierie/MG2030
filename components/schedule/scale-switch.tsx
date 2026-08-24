import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { GANTT } from "@/lib/tokens";
import { cn } from "@/lib/cn";
import type { ScaleUnit } from "@/lib/gantt/scale";

/**
 * Barre d'outils du plan de charge : échelle, filtres, légende.
 *
 * La portée se règle au SOUS-PROJET, qui est le niveau auquel le plan est
 * réellement écrit : « Training venues works » couvre les 13 halls à la fois.
 *
 * Le filtre par site a été retiré le 21/08/2026 : aucune tâche ne désignait de
 * hall précis, et il ne pouvait rien retenir que son sous-projet ne retienne
 * déjà. Un filtre qui ne discrimine pas encombre.
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
  subprojects,
  currentSubproject,
  compact,
  showNames,
  scenarioCode,
}: {
  scale: ScaleUnit;
  scales: ScaleUnit[];
  contractCodes: string[];
  currentContract: string | null;
  subprojects: string[];
  currentSubproject: string | null;
  compact: boolean;
  showNames: boolean;
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
    subproject?: string | null;
    cols?: "compact" | "all";
    names?: boolean;
  }) => {
    const params = new URLSearchParams({ scenario: scenarioCode });
    params.set("scale", next.scale ?? scale);
    const contract = next.contract === undefined ? currentContract : next.contract;
    if (contract) params.set("contract", contract);
    const sub = next.subproject === undefined ? currentSubproject : next.subproject;
    if (sub) params.set("subproject", sub);
    const cols = next.cols ?? (compact ? "compact" : "all");
    if (cols === "all") params.set("cols", "all");
    if (next.names ?? showNames) params.set("names", "1");
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
          href={href({ contract: null, subproject: null })}
          aria-current={
            currentContract === null && currentSubproject === null ? "true" : undefined
          }
          className={cn(
            chip,
            currentContract === null && currentSubproject === null ? activeChip : idleChip,
          )}
        >
          {t("gantt.filterWholeProject")}
        </Link>
        {/* Les DEUX sous-projets, toujours. On les listait d'après les tâches
            présentes : le scénario « Base » ne porte que les training venues,
            si bien que le Student Center n'apparaissait nulle part — on ne
            pouvait pas constater qu'il était vide ici. */}
        {subprojects.map((code) => (
          <Link
            key={code}
            href={href({ subproject: code })}
            aria-current={code === currentSubproject ? "true" : undefined}
            className={cn(chip, code === currentSubproject ? activeChip : idleChip)}
          >
            {t(`schedule.sub_${code}`)}
          </Link>
        ))}
      </div>

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
      {/* Nom des tâches sur les barres. Hors du jeu de colonnes : c'est une
          question de lecture du diagramme, pas de saisie. */}
      <Link
        href={href({ names: !showNames })}
        aria-pressed={showNames}
        className={
          "rounded border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text)] " +
          (showNames ? "bg-[var(--app-bg)]" : "bg-[var(--surface)]")
        }
        title={t("gantt.showNamesHint")}
      >
        {t("gantt.showNames")}
      </Link>

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
