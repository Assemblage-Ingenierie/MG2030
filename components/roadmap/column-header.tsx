"use client";

// ============================================================
// components/roadmap/column-header.tsx — trier et filtrer DEPUIS l'en-tête.
//
// Les filtres vivaient dans une barre au-dessus du tableau : douze chips en
// trois rangées, où l'on cherchait longtemps lequel agissait sur quelle
// colonne. Les voici là où la question se pose — dans l'en-tête de la colonne
// concernée, comme dans un tableur.
//
// MULTI-SÉLECTION : des cases à cocher, pas des boutons exclusifs. « Bloqué OU
// en cours » est la question qu'on se pose vraiment en revue de projet ;
// l'ancienne barre obligeait à les regarder l'un après l'autre.
//
// L'état reste dans l'URL (lib/roadmap/url.ts) : une vue filtrée et triée se
// partage par un lien. D'où `router.push` plutôt qu'un état local.
// ============================================================

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { cn } from "@/lib/cn";
import { FilterIcon, SortIcon } from "@/components/ui/icons";
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
  const box = useRef<HTMLDetailsElement>(null);

  const selected: string[] =
    kind === "statuses"
      ? params.filters.statuses
      : kind === "priorities"
        ? params.filters.priorities
        : kind === "assignees"
          ? params.filters.assignees
          : [];

  // `<details>` ne se referme pas au clic extérieur : sans cela, ouvrir le
  // filtre d'une colonne laissait le précédent ouvert par-dessus le tableau.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = box.current;
      if (el?.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const sorted = column !== null && params.sort.column === column;

  function go(url: string) {
    if (box.current) box.current.open = false;
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
              mal, et l'ordre affiché est une information, pas une décoration. */}
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
        <details ref={box} className="relative">
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center rounded p-0.5",
              selected.length > 0 ? "opacity-100" : "opacity-40 hover:opacity-80",
            )}
            title={t("roadmap.filterBy", { column: label })}
          >
            <FilterIcon className="h-3 w-3" aria-hidden="true" />
            {/* Le NOMBRE de valeurs retenues, replié. Sans lui, un filtre posé
                puis oublié fait croire à des lignes manquantes. */}
            {selected.length > 0 && (
              <span className="ml-0.5 text-[10px] tabular-nums">{selected.length}</span>
            )}
          </summary>

          <div
            className={cn(
              "absolute z-30 mt-1 max-h-72 w-56 overflow-auto rounded-md border",
              "border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {options.map((option) => {
              const on = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    go(
                      buildRoadmapQuery(params, {
                        [kind]: toggle(selected, option.value),
                      } as never),
                    )
                  }
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--app-bg)]"
                >
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

            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => go(buildRoadmapQuery(params, { [kind]: [] } as never))}
                className="mt-1 w-full border-t border-[var(--border)] px-2 pt-1.5 text-left text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                {t("roadmap.clearColumn")}
              </button>
            )}
          </div>
        </details>
      )}
    </span>
  );
}
