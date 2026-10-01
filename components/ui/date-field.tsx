"use client";

// ============================================================
// components/ui/date-field.tsx — choisir une date, lisiblement.
//
// Le champ natif `<input type="date">` était utilisé partout. Il a deux
// défauts qu'aucune feuille de style ne corrige :
//
//   • IL NE RESSEMBLE À RIEN D'AUTRE DANS L'APPLICATION. Chrome dessine sa
//     propre icône, son propre calendrier, ses propres couleurs ; Firefox et
//     Safari en dessinent trois autres. Sur un écran dont toute la charte est
//     tenue au token près, c'est la seule pièce qui change d'un poste à l'autre.
//   • IL IMPOSE L'ORDRE DU SYSTÈME. Un poste en anglais américain demande
//     mois / jour / année à des gens qui écrivent jour / mois / année, et
//     « 07/10 » veut alors dire deux choses.
//
// D'où ce sélecteur : un champ texte au format du projet, et une grille de mois
// dans un panneau. Conventions habituelles d'un sélecteur de bureau —
//   • la semaine commence LUNDI (ISO, comme la frise et le plan de charge) ;
//   • aujourd'hui est cerclé, la valeur choisie est pleine ;
//   • flèches pour le jour et la semaine, Page préc./suiv. pour le mois,
//     Origine et Fin pour les bords de semaine, Entrée pour choisir, Échap
//     pour renoncer ;
//   • la SAISIE AU CLAVIER reste possible dans le champ : pour une date
//     lointaine, taper est plus rapide que de cliquer douze fois.
//
// L'arithmétique est dans `lib/ui/calendar.ts`, pure et testée. Ici il n'y a
// qu'un tapis de boutons.
// ============================================================

import { useMemo, useRef, useState } from "react";
import { useI18n, useT } from "@/components/i18n/i18n-context";
import { PopoverPanel } from "./popover";
import { Label, fieldClasses } from "./field";
import { CalendarIcon } from "./icons";
import { cn } from "@/lib/cn";
import { localToday } from "@/lib/schedule/dates";
import { isIsoDate, monthGrid, moveByKey, shiftMonth } from "@/lib/ui/calendar";

/** Jour / mois / année : l'ordre écrit au Kosovo comme en France. */
function format(iso: string, locale: string): string {
  if (!isIsoDate(iso)) return iso;
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

function monthTitle(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00Z`));
}

/** Initiales des jours, lundi d'abord, tirées de la locale. */
function weekdayInitials(locale: string): string[] {
  const fmt = new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    weekday: "short",
  });
  // 2026-10-05 est un lundi.
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(Date.UTC(2026, 9, 5 + i, 12))).slice(0, 2),
  );
}

export function DateField({
  label,
  value,
  onChange,
  required = false,
  optionalText,
  id,
}: {
  label: string;
  /** `YYYY-MM-DD`, ou chaîne vide. */
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  optionalText?: string;
  id?: string;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  /* Le texte tapé vit à part de la valeur : pendant qu'on écrit « 07/1 », la
     date n'est pas encore valide, et remonter une valeur à chaque frappe
     effacerait la saisie en cours. */
  const [typed, setTyped] = useState<string | null>(null);
  const today = localToday();

  /** Jour sous le curseur dans la grille — ce que les flèches déplacent. */
  const [cursor, setCursor] = useState(() => (isIsoDate(value) ? value : today));

  /* Rouvrir repart de la valeur EN VIGUEUR : garder le curseur là où une
     navigation abandonnée l'avait laissé ferait s'ouvrir le calendrier sur un
     mois sans rapport avec la date affichée. Fait au clic plutôt que dans un
     effet, qui déclencherait un rendu en cascade. */
  const openPanel = () => {
    setCursor(isIsoDate(value) ? value : today);
    setOpen(true);
  };

  const grid = useMemo(() => monthGrid(cursor), [cursor]);
  const weekdays = useMemo(() => weekdayInitials(locale), [locale]);
  const gridRef = useRef<HTMLDivElement>(null);

  const text = typed ?? (value === "" ? "" : format(value, locale));

  function commitTyped(raw: string) {
    setTyped(null);
    const cleaned = raw.trim();
    if (cleaned === "") {
      onChange("");
      return;
    }
    // On accepte les deux écritures : celle qu'on affiche (07/10/2026) et celle
    // qu'on stocke (2026-10-07), parce qu'un copier-coller depuis la base ou
    // depuis un courriel ne se refuse pas.
    const slash = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(cleaned);
    const iso = slash
      ? `${slash[3]}-${slash[2].padStart(2, "0")}-${slash[1].padStart(2, "0")}`
      : cleaned;
    if (isIsoDate(iso)) onChange(iso);
    // Sinon on ne touche à rien : le champ se réaffiche avec la valeur en
    // vigueur, ce qui dit sans phrase que la saisie n'a pas été comprise.
  }

  const inputId = id ?? `date-${label.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div>
      <Label htmlFor={inputId} optionalText={optionalText}>
        {label}
      </Label>
      <div className="relative mt-1 flex items-center">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          required={required}
          value={text}
          placeholder={t("common.datePlaceholder")}
          onChange={(e) => setTyped(e.target.value)}
          onBlur={(e) => commitTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped((e.target as HTMLInputElement).value);
            }
          }}
          className={cn(fieldClasses(), "pr-10")}
        />
        <button
          ref={setTrigger}
          type="button"
          onClick={() => (open ? setOpen(false) : openPanel())}
          aria-expanded={open}
          aria-label={t("common.openCalendar")}
          className="absolute right-1 flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      <PopoverPanel
        anchor={trigger}
        open={open}
        onClose={() => setOpen(false)}
        width={268}
        className="p-2"
      >
        <div className="flex items-center justify-between pb-1">
          <Arrow
            label={t("common.previousMonth")}
            onClick={() => setCursor(shiftMonth(cursor, -1))}
            direction="left"
          />
          <span className="text-xs font-semibold capitalize text-[var(--text)]">
            {monthTitle(cursor, locale)}
          </span>
          <Arrow
            label={t("common.nextMonth")}
            onClick={() => setCursor(shiftMonth(cursor, 1))}
            direction="right"
          />
        </div>

        <div className="grid grid-cols-7 pb-0.5">
          {weekdays.map((d, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="py-1 text-center text-[10px] font-medium uppercase text-[var(--text-muted)]"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Le clavier est écouté sur la GRILLE et non sur chaque case : une
            case qui disparaît en changeant de mois emporterait le focus, et la
            navigation s'arrêterait au premier franchissement de mois. */}
        <div
          ref={gridRef}
          role="grid"
          tabIndex={0}
          aria-label={t("common.openCalendar")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onChange(cursor);
              setTyped(null);
              setOpen(false);
              return;
            }
            const next = moveByKey(cursor, e.key);
            if (next) {
              e.preventDefault();
              setCursor(next);
            }
          }}
          className="grid grid-cols-7 gap-px outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          {grid.map((d) => {
            const selected = d.iso === value;
            const isToday = d.iso === today;
            const onCursor = d.iso === cursor;
            return (
              <button
                key={d.iso}
                type="button"
                tabIndex={-1}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={selected}
                onClick={() => {
                  onChange(d.iso);
                  setTyped(null);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 items-center justify-center rounded text-xs tabular-nums",
                  // Les jours de débord restent CLIQUABLES mais s'effacent :
                  // les griser sans les désactiver mentirait, les retirer
                  // laisserait des trous dans la grille.
                  d.inMonth ? "text-[var(--text)]" : "text-[var(--text-muted)] opacity-50",
                  !selected && "hover:bg-[var(--app-bg)]",
                  onCursor && !selected && "ring-1 ring-[var(--focus)]",
                )}
                style={
                  selected
                    ? { backgroundColor: "var(--accent)", color: "var(--on-accent)" }
                    : isToday
                      ? { boxShadow: "inset 0 0 0 1px var(--accent-2)" }
                      : undefined
                }
              >
                {d.day}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5">
          <button
            type="button"
            onClick={() => {
              onChange(today);
              setTyped(null);
              setOpen(false);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-[var(--text)] hover:bg-[var(--app-bg)]"
          >
            {t("common.today")}
          </button>
          {!required && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setTyped(null);
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
      </PopoverPanel>
    </div>
  );
}

function Arrow({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
