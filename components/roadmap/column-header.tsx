"use client";

// ============================================================
// components/roadmap/column-header.tsx — trier et filtrer DEPUIS l'en-tête.
//
// Les filtres vivaient dans une barre au-dessus du tableau : douze chips en
// trois rangées, où l'on cherchait longtemps lequel agissait sur quelle
// colonne. Les voici là où la question se pose.
//
// ⚠ ON COCHE, PUIS ON VALIDE. Chaque case déclenchait auparavant sa propre
// navigation : le panneau se refermait, la page se rechargeait, et il fallait
// le rouvrir pour cocher la deuxième valeur. La multi-sélection était donc
// annoncée mais impraticable — signalé le 01/10/2026. Les cases composent
// maintenant un brouillon local, et un seul bouton l'applique.
//
// L'état validé reste dans l'URL (lib/roadmap/url.ts) : une vue filtrée et
// triée se partage par un lien.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { cn } from "@/lib/cn";
import { FilterIcon, SortIcon } from "@/components/ui/icons";
import { PopoverPanel } from "@/components/ui/popover";
import type { SortColumn } from "@/lib/roadmap/filter";
import { buildRoadmapQuery, nextSort, toggle, type RoadmapParams } from "@/lib/roadmap/url";

export interface FilterOption {
  value: string;
  label: string;
  /** Pastille de couleur, pour retrouver un statut sans lire son nom. */
  swatch?: string;
}

/** Quelle facette du filtre cette colonne pilote. `null` = tri seulement. */
export type FilterKind = "statuses" | "priorities" | "assignees" | null;

export function ColumnHeader({
  label,
  column,
  kind,
  options = [],
  params,
  align = "left",
}: {
  label: string;
  /** `null` pour une colonne qu'on ne trie pas. */
  column: SortColumn | null;
  kind: FilterKind;
  options?: FilterOption[];
  params: RoadmapParams;
  align?: "left" | "right";
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /* Le déclencheur est tenu en ÉTAT et non en ref : une ref lue pendant le
     rendu vaut `null` au premier passage et ne provoque aucun nouveau rendu
     quand elle se remplit — le panneau n'aurait alors rien à quoi s'ancrer. */
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  const applied: string[] =
    kind === "statuses"
      ? params.filters.statuses
      : kind === "priorities"
        ? params.filters.priorities
        : kind === "assignees"
          ? params.filters.assignees
          : [];

  /** Brouillon local : ce qui est coché mais pas encore appliqué. */
  const [draft, setDraft] = useState<string[]>(applied);

  const sorted = column !== null && params.sort.column === column;
  const dirty = draft.length !== applied.length || draft.some((v) => !applied.includes(v));

  function go(url: string) {
    setOpen(false);
    router.push(url, { scroll: false });
  }

  return (
    <span
      className={cn(
        "flex items-center gap-1",
        align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {column ? (
        <button
          type="button"
          onClick={() => go(buildRoadmapQuery(params, { sort: nextSort(params.sort, column) }))}
          title={t("roadmap.sortBy", { column: label })}
          className="inline-flex items-center gap-1 rounded px-0.5 hover:underline"
        >
          {label}
          <SortIcon
            className={cn("h-3 w-3 shrink-0", sorted ? "opacity-100" : "opacity-30")}
            aria-hidden="true"
          />
          {/* Le SENS du tri est écrit, pas seulement suggéré par une icône
              retournée : deux flèches opposées à cette taille se distinguent
              mal, et l'ordre affiché est une information. */}
          {sorted && (
            <span aria-hidden="true" className="text-[10px]">
              {params.sort.direction === "asc" ? "↑" : "↓"}
            </span>
          )}
        </button>
      ) : (
        <span className="px-0.5">{label}</span>
      )}

      {kind && options.length > 0 && (
        <>
          <button
            ref={setTrigger}
            type="button"
            onClick={() => {
              // Rouvrir repart de ce qui est RÉELLEMENT en vigueur : garder un
              // brouillon abandonné ferait croire qu'un filtre est posé alors
              // qu'il ne l'est pas. Fait ici plutôt que dans un effet, qui
              // déclencherait un rendu en cascade.
              if (!open) setDraft(applied);
              setOpen(!open);
            }}
            aria-expanded={open}
            title={t("roadmap.filterBy", { column: label })}
            className={cn(
              "flex items-center rounded p-0.5",
              applied.length > 0 ? "opacity-100" : "opacity-40 hover:opacity-80",
            )}
          >
            <FilterIcon className="h-3 w-3" aria-hidden="true" />
            {/* Le NOMBRE de valeurs retenues, replié : un filtre posé puis
                oublié fait croire à des lignes manquantes. */}
            {applied.length > 0 && (
              <span className="ml-0.5 text-[10px] tabular-nums">{applied.length}</span>
            )}
          </button>

          <PopoverPanel
            anchor={trigger}
            open={open}
            onClose={() => setOpen(false)}
            align={align}
            width={224}
          >
            <div className="p-1">
              {options.map((option) => {
                const on = draft.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraft(toggle(draft, option.value))}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--app-bg)]"
                  >
                    <Check on={on} />
                    {option.swatch && (
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: option.swatch }}
                      />
                    )}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Le pied est COLLÉ : sur une longue liste d'assignataires, le
                bouton de validation sortait de l'écran et l'on croyait le
                filtre inopérant. */}
            <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
              <button
                type="button"
                onClick={() => setDraft([])}
                disabled={draft.length === 0}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-40"
              >
                {t("roadmap.clearColumn")}
              </button>
              <button
                type="button"
                onClick={() => go(buildRoadmapQuery(params, { [kind]: draft } as never))}
                disabled={!dirty}
                className="rounded px-2 py-1 text-xs font-medium disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
              >
                {t("roadmap.applyFilter")}
              </button>
            </div>
          </PopoverPanel>
        </>
      )}
    </span>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
        on ? "border-transparent" : "border-[var(--border)]",
      )}
      style={on ? { backgroundColor: "var(--accent)" } : undefined}
    >
      {on && (
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M1 5l2.5 2.5L9 2"
            fill="none"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
