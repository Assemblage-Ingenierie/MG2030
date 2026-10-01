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
import { PopoverPanel } from "@/components/ui/popover";
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
import { ASSIGNEE_ENTITIES } from "@/lib/roadmap/types";
import { shortAssignee } from "@/lib/roadmap/assignee-label";
import { RichText, RichTextEditor } from "./rich-text";
import type { PersonOption } from "./assignee-picker";

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

// ── Intitulé ────────────────────────────────────────────────────────────────

export function InlineTitle({ actionId, value }: { actionId: string; value: string }) {
  const { editable, error, pending, run } = useCell();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  /* Le DÉTAIL a quitté cette cellule le 01/10/2026. Écrit en petit sous
     l'intitulé, il n'avait pas de cible propre : cliquer dessus ouvrait
     l'édition du titre. Il a maintenant sa colonne, donc son clic. */
  /* GRAS depuis le 01/10/2026 : l'intitulé et son détail partagent la même
     cellule, et deux tailles de caractères ne suffisaient pas à les
     distinguer d'un coup d'œil sur quatre-vingts lignes. */
  const display = (
    <span className="text-[14px] font-semibold text-[var(--text)]">{value}</span>
  );

  if (!editable) return display;

  /**
   * Un `textarea` et non un champ d'une ligne : certains intitulés font quatre-
   * vingt-dix caractères (« Appoint a panel for the complaint mechanism… »), et
   * les corriger dans une fenêtre où l'on n'en voit que le tiers est pénible.
   *
   * Entrée valide, Maj+Entrée passe à la ligne — l'inverse du réflexe d'un
   * champ de texte, mais le bon ici : on vient corriger un mot, pas rédiger.
   */
  if (editing) {
    return (
      <textarea
        ref={input}
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLTextAreaElement).blur();
          }
        }}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() === "" || draft === value) {
            setDraft(value);
            return;
          }
          run(() => patchRoadmapAction(actionId, { title: draft }));
        }}
        className="w-full rounded border bg-[var(--surface)] px-1.5 py-1 text-[14px] outline-none"
        style={{ borderColor: "var(--focus)" }}
      />
    );
  }

  return (
    <span className="relative block">
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        disabled={pending}
        className={cn(TRIGGER, pending && "opacity-50")}
      >
        {display}
      </button>
      {error && (
        <span
          aria-hidden="true"
          className="absolute -right-1 top-0 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--danger)" }}
        />
      )}
    </span>
  );
}

// ── Détail de l'action ──────────────────────────────────────────────────────

/**
 * Le « quoi faire exactement » : l'interlocuteur à relancer, le document
 * attendu, la condition à lever.
 *
 * Il s'écrivait jusqu'ici dans la fenêtre d'édition, sept champs plus bas, et
 * se lisait en petit sous l'intitulé sans qu'on puisse le toucher. C'est
 * pourtant le champ qui bouge le plus d'une revue à l'autre.
 *
 * Un `textarea` à même la cellule, sans fenêtre : le détail tient en une ou
 * deux lignes, et l'ouvrir dans une fenêtre pour corriger un nom coûterait
 * plus cher que de le retaper.
 */
export function InlineDetail({
  actionId,
  value,
  placeholder,
}: {
  actionId: string;
  value: string | null;
  /** Ce qu'on écrit dans une cellule vide, pour qu'elle se propose au clic. */
  placeholder: string;
}) {
  const { editable, error, pending, run } = useCell();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const display = value ? (
    <RichText source={value} className="text-xs text-[var(--text)]" />
  ) : (
    <span className="block text-xs text-[var(--text-muted)]">{placeholder}</span>
  );

  if (!editable) {
    return value ? display : <span className="text-[var(--text-muted)]">—</span>;
  }

  if (editing) {
    return (
      /* ⚠ ON NE VALIDE PLUS SUR ENTRÉE ICI. Le détail accepte maintenant des
         puces (voir lib/roadmap/rich-text.ts), et une liste se tape ligne par
         ligne : faire d'Entrée la validation rendait les puces inaccessibles
         au clavier. On enregistre en quittant la cellule, Échap renonce. */
      <RichTextEditor
        compact
        autoFocus
        rows={4}
        value={draft}
        onChange={setDraft}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        onBlur={() => {
          setEditing(false);
          // VIDER est une modification légitime ici, contrairement à
          // l'intitulé : une précision devenue fausse doit pouvoir s'effacer.
          if (draft === (value ?? "")) return;
          run(() => patchRoadmapAction(actionId, { detail: draft }));
        }}
      />
    );
  }

  return (
    <span className="relative block">
      <button
        type="button"
        onClick={() => {
          setDraft(value ?? "");
          setEditing(true);
        }}
        disabled={pending}
        className={cn(TRIGGER, pending && "opacity-50")}
      >
        {display}
      </button>
      {error && (
        <span
          aria-hidden="true"
          className="absolute -right-1 top-0 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--danger)" }}
        />
      )}
    </span>
  );
}

// ── Assignataires ───────────────────────────────────────────────────────────

export function InlineAssignees({
  actionId,
  value,
  people,
  notSetLabel,
  shortNames = false,
}: {
  actionId: string;
  value: { label: string }[];
  people: PersonOption[];
  notSetLabel: string;
  /**
   * Écrire le PRÉNOM seul. Décidé par l'appelant sur l'ensemble du tableau —
   * voir `hasAmbiguousFirstNames` : deux homonymes et on réécrit tout en
   * entier, parce qu'une colonne illisible vaut mieux qu'une colonne fausse.
   */
  shortNames?: boolean;
}) {
  const t = useT();
  const { editable, open, setOpen, error, pending, run } = useCell();
  const labels = value.map((a) => a.label);

  const display =
    labels.length === 0 ? (
      <span className="text-[var(--text-muted)]">—</span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {labels.map((l) => (
          <span
            key={l}
            // Le libellé ENTIER reste en infobulle : raccourcir est une
            // affaire d'affichage, jamais de donnée.
            title={l}
            className="inline-block rounded bg-[var(--app-bg)] px-1.5 py-0.5 text-xs text-[var(--text)]"
          >
            {shortNames ? shortAssignee(l) : l}
          </span>
        ))}
      </span>
    );

  if (!editable) return display;

  const toggle = (label: string) =>
    run(() =>
      patchRoadmapAction(actionId, {
        assignees: labels.includes(label)
          ? labels.filter((l) => l !== label)
          : [...labels, label],
      }),
    );

  // Tout libellé qui n'est ni une entité ni un compte reste listé pour pouvoir
  // être RETIRÉ : sans cela, un nom saisi autrefois à la main deviendrait
  // indécrochable depuis la liste.
  const known = new Set<string>([...ASSIGNEE_ENTITIES, ...people.map((p) => p.fullName)]);
  const extras = labels.filter((l) => !known.has(l));

  return (
    <Cell open={open} setOpen={setOpen} error={error} pending={pending} display={display} wide>
      <div className="max-h-72 overflow-auto p-1">
        <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          {t("roadmap.entities")}
        </p>
        {ASSIGNEE_ENTITIES.map((e) => (
          <Pick key={e} label={e} on={labels.includes(e)} onClick={() => toggle(e)} />
        ))}

        {people.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {t("roadmap.people")}
            </p>
            {people.map((p) => (
              <Pick
                key={p.id}
                label={p.fullName}
                on={labels.includes(p.fullName)}
                onClick={() => toggle(p.fullName)}
              />
            ))}
          </>
        )}

        {extras.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {t("roadmap.otherAssignees")}
            </p>
            {extras.map((l) => (
              <Pick key={l} label={l} on onClick={() => toggle(l)} />
            ))}
          </>
        )}

        {labels.length === 0 && (
          <p className="px-2 py-1 text-xs text-[var(--text-muted)]">{notSetLabel}</p>
        )}
      </div>
    </Cell>
  );
}

function Pick({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs",
        on ? "bg-[var(--app-bg)] font-medium" : "hover:bg-[var(--app-bg)]",
      )}
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
            <path d="M1 5l2.5 2.5L9 2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <span className="truncate text-[var(--text)]">{label}</span>
    </button>
  );
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
  /* En ÉTAT et non en ref : une ref lue pendant le rendu vaut `null` au
     premier passage et ne redéclenche rien quand elle se remplit. */
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  /* ⚠ LE PANNEAU PASSE PAR UN PORTAIL (`PopoverPanel`), et ce n'est pas un
     détail d'implémentation. En `absolute`, il était rogné par le
     `overflow-x-auto` dont `Table` enveloppe tout tableau : avec peu de lignes,
     le menu se trouvait tranché au milieu. Un portail le soustrait aux
     `overflow` de ses ancêtres. */
  return (
    <span className="relative inline-block w-full">
      <button
        ref={setTrigger}
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

      <PopoverPanel
        anchor={trigger}
        open={open}
        onClose={() => setOpen(false)}
        width={wide ? 220 : 180}
      >
        {children}
      </PopoverPanel>
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
