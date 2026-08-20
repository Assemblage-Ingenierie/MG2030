import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { GANTT } from "@/lib/tokens";
import { cn } from "@/lib/cn";
import type { ScaleUnit } from "@/lib/gantt/scale";

/**
 * Barre d'outils du plan de charge : échelle, filtre par marché, légende.
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
  scenarioCode,
}: {
  scale: ScaleUnit;
  scales: ScaleUnit[];
  contractCodes: string[];
  currentContract: string | null;
  scenarioCode: string;
}) {
  const { t } = await getI18n();

  const href = (next: { scale?: ScaleUnit; contract?: string | null }) => {
    const params = new URLSearchParams({ scenario: scenarioCode });
    params.set("scale", next.scale ?? scale);
    const contract = next.contract === undefined ? currentContract : next.contract;
    if (contract) params.set("contract", contract);
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

      {contractCodes.length > 0 && (
        <div
          role="group"
          aria-label={t("gantt.filterContract")}
          className="inline-flex flex-wrap items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
        >
          <Link
            href={href({ contract: null })}
            className={cn(chip, currentContract === null ? activeChip : idleChip)}
          >
            {t("gantt.filterAll")}
          </Link>
          {contractCodes.map((code) => (
            <Link
              key={code}
              href={href({ contract: code })}
              className={cn(chip, code === currentContract ? activeChip : idleChip)}
            >
              {code}
            </Link>
          ))}
        </div>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-muted)]">
        <LegendItem color="var(--accent)" label={t("gantt.task")} />
        <LegendItem color={GANTT.text} label={t("gantt.summary")} />
        <LegendItem color={GANTT.milestone} label={t("gantt.milestone")} diamond />
        <LegendItem color="#ea9999" label={t("gantt.late")} />
        <LegendItem color={GANTT.today} label={t("gantt.today")} />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  diamond = false,
}: {
  color: string;
  label: string;
  diamond?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-2.5 w-2.5"
        style={{
          backgroundColor: color,
          borderRadius: diamond ? 0 : 2,
          transform: diamond ? "rotate(45deg)" : undefined,
        }}
      />
      {label}
    </span>
  );
}
