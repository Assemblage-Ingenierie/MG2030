"use client";

// ============================================================
// components/referential/lot-buildings.tsx — composition d'un lot.
//
// GAPS 3 : les sources ne disent PAS quels halls composent chacun des quatre
// lots de travaux. Les libellés annoncent « Lot 1 (3 venues) », « Lot 4
// (4 venues) » — 3+3+3+4 = 13 — mais la répartition nominative n'existe nulle
// part. C'est un arbitrage de la PIU, pas une donnée à retrouver : d'où une
// saisie à la main, et un compteur qui confronte ce qui est coché à ce que le
// libellé annonce.
//
// UN BÂTIMENT PEUT APPARTENIR À PLUSIEURS LOTS, et c'est normal : le même hall
// relève d'un lot de TRAVAUX et d'un lot d'ÉQUIPEMENT, qui sont deux marchés
// distincts. Ce qui serait une faute, c'est deux lots du MÊME marché — le
// même ouvrage payé deux fois. L'écran le signale sans l'interdire : la PIU
// peut avoir une raison que nous ignorons.
// ============================================================

import { useMemo, useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { setLotBuildings } from "@/app/(app)/contracts/actions";

export interface BuildingChoice {
  id: string;
  buildingCode: string;
  name: string;
  siteCode: string;
  siteName: string;
  subproject: string;
  interventionType: string;
  grossArea: number | null;
}

export interface LotAssignment {
  lotId: string;
  buildingId: string;
}

/**
 * Nombre de halls annoncé par le libellé du lot.
 *
 * Purement indicatif : on le lit pour pouvoir DIRE si la saisie s'en écarte,
 * jamais pour contraindre. « Lot 4 (4 venues) » → 4.
 */
function announcedCount(lotName: string): number | null {
  const match = /\((\d+)\s+venues?\)/i.exec(lotName);
  return match ? Number(match[1]) : null;
}

export function LotBuildingsButton({
  lotId,
  lotCode,
  lotName,
  contractId,
  buildings,
  assignments,
  lotsOfSameContract,
}: {
  lotId: string;
  lotCode: string;
  lotName: string;
  contractId: string;
  buildings: BuildingChoice[];
  assignments: LotAssignment[];
  /** Autres lots du même marché, pour détecter un ouvrage compté deux fois. */
  lotsOfSameContract: { id: string; lotCode: string }[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  const current = assignments.filter((a) => a.lotId === lotId).length;

  if (!can("contract.write")) {
    return (
      <span className="text-xs text-[var(--text-muted)]">
        {current > 0 ? t("lots.buildingCount", { count: String(current) }) : t("lots.unassigned")}
      </span>
    );
  }

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {current > 0
          ? t("lots.buildingCount", { count: String(current) })
          : t("lots.assignBuildings")}
      </Button>
      {open && (
        <Picker
          lotId={lotId}
          lotCode={lotCode}
          lotName={lotName}
          contractId={contractId}
          buildings={buildings}
          assignments={assignments}
          lotsOfSameContract={lotsOfSameContract}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Picker({
  lotId,
  lotCode,
  lotName,
  buildings,
  assignments,
  lotsOfSameContract,
  onClose,
}: {
  lotId: string;
  lotCode: string;
  lotName: string;
  contractId: string;
  buildings: BuildingChoice[];
  assignments: LotAssignment[];
  lotsOfSameContract: { id: string; lotCode: string }[];
  onClose: () => void;
}) {
  const t = useT();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(assignments.filter((a) => a.lotId === lotId).map((a) => a.buildingId)),
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** Bâtiments déjà pris par un AUTRE lot du même marché. */
  const takenElsewhere = useMemo(() => {
    const siblings = new Map(lotsOfSameContract.filter((l) => l.id !== lotId).map((l) => [l.id, l.lotCode]));
    const map = new Map<string, string>();
    for (const a of assignments) {
      const code = siblings.get(a.lotId);
      if (code) map.set(a.buildingId, code);
    }
    return map;
  }, [assignments, lotsOfSameContract, lotId]);

  /** Groupés par site : c'est ainsi qu'on raisonne pour composer un lot. */
  const grouped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const kept = buildings.filter(
      (b) =>
        needle === "" ||
        `${b.buildingCode} ${b.name} ${b.siteCode} ${b.siteName}`
          .toLowerCase()
          .includes(needle),
    );
    const map = new Map<string, { siteName: string; items: BuildingChoice[] }>();
    for (const b of kept) {
      const entry = map.get(b.siteCode);
      if (entry) entry.items.push(b);
      else map.set(b.siteCode, { siteName: b.siteName, items: [b] });
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [buildings, search]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSite = (items: BuildingChoice[]) => {
    const allIn = items.every((b) => selected.has(b.id));
    setSelected((current) => {
      const next = new Set(current);
      for (const b of items) {
        if (allIn) next.delete(b.id);
        else next.add(b.id);
      }
      return next;
    });
  };

  const announced = announcedCount(lotName);
  const conflicts = [...selected].filter((id) => takenElsewhere.has(id));

  function save() {
    setError(null);
    start(async () => {
      const result = await setLotBuildings(lotId, [...selected]);
      if (!result.ok) {
        setError(result.error ?? t("lots.error_writeFailed"));
        return;
      }
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("lots.composeTitle", { lot: lotCode })}
    >
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-muted)]">{lotName}</p>

        {/* Ce que le libellé annonce contre ce qui est coché. Indicatif : la
            PIU décide, l'écran ne fait que rapprocher les deux. */}
        <p className="text-sm">
          <span className="font-medium tabular-nums">{selected.size}</span>{" "}
          <span className="text-[var(--text-muted)]">
            {announced === null
              ? t("lots.selectedCount")
              : t("lots.selectedAgainstAnnounced", { announced: String(announced) })}
          </span>
          {announced !== null && selected.size !== announced && (
            <span className="ml-2" style={{ color: "var(--accent-2)" }}>
              {t("lots.countMismatch")}
            </span>
          )}
        </p>

        {conflicts.length > 0 && (
          <p
            className="rounded-md px-3 py-2 text-xs"
            style={{
              backgroundColor: "color-mix(in srgb, var(--accent-2) 12%, transparent)",
              color: "var(--text)",
            }}
          >
            {t("lots.sameContractWarning", { count: String(conflicts.length) })}
          </p>
        )}

        <input
          className="h-8 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
          placeholder={t("lots.searchBuildings")}
          aria-label={t("lots.searchBuildings")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-[45vh] overflow-y-auto rounded-md border border-[var(--border)]">
          {grouped.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              {t("lots.noBuildingMatch")}
            </p>
          )}

          {grouped.map(([siteCode, { siteName, items }]) => {
            const allIn = items.every((b) => selected.has(b.id));
            return (
              <div key={siteCode}>
                <div className="sticky top-0 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--app-bg)] px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleSite(items)}
                    className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text)] hover:underline"
                  >
                    {siteCode}
                  </button>
                  <span className="truncate text-xs text-[var(--text-muted)]">{siteName}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-[var(--text-muted)]">
                    {items.filter((b) => selected.has(b.id)).length}/{items.length}
                  </span>
                </div>

                {items.map((b) => {
                  const takenBy = takenElsewhere.get(b.id);
                  const checked = selected.has(b.id);
                  return (
                    <label
                      key={b.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 border-b border-[var(--border)] px-3 py-1.5 text-sm",
                        checked && "bg-[color-mix(in_srgb,var(--accent)_6%,transparent)]",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(b.id)}
                        aria-label={`${b.buildingCode} ${b.name}`}
                      />
                      <span className="w-24 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                        {b.buildingCode}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{b.name}</span>
                      {b.grossArea !== null && (
                        <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                          {Math.round(b.grossArea)} m²
                        </span>
                      )}
                      {/* Déjà pris par un lot frère : on le dit, on ne bloque pas. */}
                      {takenBy && (
                        <span
                          className="shrink-0 text-[11px] font-medium"
                          style={{ color: "var(--accent-2)" }}
                          title={t("lots.alreadyInHint")}
                        >
                          {takenBy}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
          <Button size="sm" variant="quiet" onClick={() => setSelected(new Set())}>
            {t("lots.clearSelection")}
          </Button>
          <span className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" disabled={pending} onClick={save}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
