"use client";

// ============================================================
// components/roadmap/inline-cell.tsx — modifier un champ en cliquant dessus.
//
// Changer un statut demandait jusqu'ici : ouvrir la fenêtre d'édition, trouver
// la liste déroulante parmi sept champs, enregistrer, attendre. Pour un geste
// qu'on répète à chaque revue hebdomadaire, sur quatorze lignes. On clique
// désormais la cellule.
//
// ⚠ ON N'ENVOIE QUE LE CHAMP MODIFIÉ (`patchRoadmapAction`). Renvoyer toute la
// ligne ferait écraser, par celui qui change le statut, la date qu'un autre
// vient de poser trente secondes plus tôt — sans que personne ne le voie.
//
// La cellule reste en attente tant que l'écriture n'est pas revenue, et
// réaffiche l'ancienne valeur si la base refuse : un affichage optimiste qui
// mentirait sur un refus serait pire que l'attente.
// ============================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n, useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { cn } from "@/lib/cn";
import { ROADMAP_PRIORITY, ROADMAP_STATUS } from "@/lib/tokens";
import {
  TIMELINE_KINDS,
  resolveTimeline,
  timelineLabel,
  type Timeline,
  type TimelineKind,
} from "@/lib/roadmap/timeline";
import {
  ROADMAP_PRIORITIES,
  ROADMAP_STATUSES,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@/lib/roadmap/types";
import { patchRoadmapAction } from "@/app/(app)/roadmap/actions";

/** Enveloppe commune : le bouton d'ouverture, l'attente, le refus. */
function useCell() {
  const router = useRouter();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean }>) => {
    setOpen(false);
    setError(false);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(true);
      else router.refresh();
    });
  };

  return { editable: can("roadmap.write"), open, setOpen, error, pending, run };
}

const TRIGGER =
  "w-full rounded px-1 py-0.5 text-left transition-colors hover:bg-[var(--app-bg)]";

// ── Statut ──────────────────────────────────────────────────────────────────

export function InlineStatus({
  actionId,
  value,
  notSetLabel,
}: {
  actionId: string;
  value: RoadmapStatus | null;
  notSetLabel: string;
}) {
  const t = useT();
  const { editable, open, setOpen, error, pending, run } = useCell();

  const badge = value ? (
    <span
      className="inline-block rounded px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: ROADMAP_STATUS[value].bg,
        color: ROADMAP_STATUS[value].fg,
      }}
    >
      {t(`roadmap.status_${value}`)}
    </span>
  ) : (
    <span className="text-[var(--text-muted)]">—</span>
  );

  if (!editable) return badge;

  return (
    <Cell open={open} setOpen={setOpen} error={error} pending={pending} display={badge}>
      <Choices
        options={[
          { value: "", label: notSetLabel },
          ...ROADMAP_STATUSES.map((s) => ({
            value: s,
            label: t(`roadmap.status_${s}`),
            swatch: ROADMAP_STATUS[s].bg,
          })),
        ]}
        current={value ?? ""}
        onPick={(v) =>
          run(() =>
            patchRoadmapAction(actionId, { status: (v || null) as RoadmapStatus | null }),
          )
        }
      />
    </Cell>
  );
}

// ── Priorité ────────────────────────────────────────────────────────────────

export function InlinePriority({
  actionId,
  value,
  notSetLabel,
}: {
  actionId: string;
  value: RoadmapPriority | null;
  notSetLabel: string;
}) {
  const t = useT();
  const { editable, open, setOpen, error, pending, run } = useCell();

  const text = value ? (
    <span className="text-xs font-medium" style={{ color: ROADMAP_PRIORITY[value] }}>
      {t(`roadmap.priority_${value}`)}
    </span>
  ) : (
    <span className="text-[var(--text-muted)]">—</span>
  );

  if (!editable) return text;

  return (
    <Cell open={open} setOpen={setOpen} error={error} pending={pending} display={text}>
      <Choices
        options={[
          { value: "", label: notSetLabel },
          // Du plus pressant au moins : c'est « urgent » qu'on vient poser.
          ...[...ROADMAP_PRIORITIES].reverse().map((p) => ({
            value: p,
            label: t(`roadmap.priority_${p}`),
            swatch: ROADMAP_PRIORITY[p],
          })),
        ]}
        current={value ?? ""}
        onPick={(v) =>
          run(() =>
            patchRoadmapAction(actionId, { priority: (v || null) as RoadmapPriority | null }),
          )
        }
      />
    </Cell>
  );
}

// ── Timeline ────────────────────────────────────────────────────────────────

export function InlineTimeline({
  actionId,
  value,
}: {
  actionId: string;
  value: Timeline;
}) {
  const t = useT();
  const { locale } = useI18n();
  const { editable, open, setOpen, error, pending, run } = useCell();

  const [kind, setKind] = useState<TimelineKind | "">(value.kind ?? "");
  const [anchor, setAnchor] = useState(value.start ?? "");
  const [rangeEnd, setRangeEnd] = useState(
    value.kind === "range" && value.end ? shiftDay(value.end, -1) : "",
  );

  const label = timelineLabel(value, locale);
  const display = (
    <span
      className={cn(
        "text-xs",
        value.kind === null ? "text-[var(--text-muted)]" : "tabular-nums text-[var(--text)]",
      )}
    >
      {t(`roadmap.timeline_${label.key}`, label.values)}
    </span>
  );

  if (!editable) return display;

  // Aperçu calculé par le MÊME module que la liste : jamais décalé d'avec elle.
  const preview = timelineLabel(
    resolveTimeline(kind || null, anchor || null, rangeEnd || null),
    locale,
  );

  return (
    <Cell open={open} setOpen={setOpen} error={error} pending={pending} display={display} wide>
      <div className="flex flex-col gap-2 p-2">
        <select
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          value={kind}
          onChange={(e) => {
            const k = e.target.value as TimelineKind | "";
            setKind(k);
            if (k === "") {
              setAnchor("");
              setRangeEnd("");
            } else if (k !== "range") setRangeEnd("");
          }}
        >
          <option value="">{t("roadmap.kind_none")}</option>
          {TIMELINE_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`roadmap.kind_${k}`)}
            </option>
          ))}
        </select>

        {kind !== "" && (
          <input
            type="date"
            value={anchor}
            onChange={(e) => setAnchor(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
        )}
        {kind === "range" && (
          <input
            type="date"
            value={rangeEnd}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
        )}

        {/* Ce que la liste écrira, mot pour mot — le jour cliqué n'est pas
            toujours celui qu'on affichera. */}
        <p className="text-xs text-[var(--text)]">
          {t(`roadmap.timeline_${preview.key}`, preview.values)}
        </p>

        <button
          type="button"
          disabled={kind !== "" && !anchor}
          onClick={() =>
            run(() =>
              patchRoadmapAction(actionId, {
                timeline: {
                  kind: kind || null,
                  anchor: anchor || null,
                  rangeEnd: rangeEnd || null,
                },
              }),
            )
          }
          className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
          style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
        >
          {t("common.save")}
        </button>
      </div>
    </Cell>
  );
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Pièces communes ─────────────────────────────────────────────────────────

function Cell({
  open,
  setOpen,
  error,
  pending,
  display,
  children,
  wide = false,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  error: boolean;
  pending: boolean;
  display: React.ReactNode;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  return (
    <span ref={box} className="relative inline-block w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={pending}
        className={cn(TRIGGER, pending && "opacity-50")}
      >
        {display}
      </button>

      {/* Un refus se VOIT. Sans ce point, une écriture refusée par la base
          laissait la cellule inchangée, ce qui se lit comme un clic manqué. */}
      {error && (
        <span
          aria-hidden="true"
          className="absolute -right-1 top-0 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--danger)" }}
        />
      )}

      {open && (
        <div
          className={cn(
            "absolute left-0 z-30 mt-1 rounded-md border border-[var(--border)]",
            "bg-[var(--surface)] shadow-lg",
            wide ? "w-52" : "w-44",
          )}
        >
          {children}
        </div>
      )}
    </span>
  );
}

function Choices({
  options,
  current,
  onPick,
}: {
  options: { value: string; label: string; swatch?: string }[];
  current: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onPick(o.value)}
          className={cn(
            "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
            o.value === current
              ? "bg-[var(--app-bg)] font-medium text-[var(--text)]"
              : "text-[var(--text)] hover:bg-[var(--app-bg)]",
          )}
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-[var(--border)]"
            style={o.swatch ? { backgroundColor: o.swatch, borderColor: "transparent" } : undefined}
          />
          <span className="truncate">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
