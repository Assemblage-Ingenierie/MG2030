// ============================================================
// lib/tokens.ts — SOURCE UNIQUE des tokens de design.
// Aucune couleur ne doit être écrite en dur ailleurs dans l'application.
//
// Origine : docs/UI_TOKENS.md, extrait du dépôt de charte `peeb-cool-santafe`.
// Les couleurs de surface sont reprises telles quelles ; l'accent de marque est
// celui du maître d'ouvrage kosovar, pas celui du prestataire.
//
// Les composants consomment ces valeurs via `var(--token)` en classe Tailwind
// arbitraire : bg-[var(--surface)], text-[var(--text-muted)]. Le TypeScript
// reste la source, le CSS n'en est que le miroir (posé sur <body>).
// ============================================================

import type { CSSProperties } from "react";

// --- Couleurs de texte de référence (règles de contraste) ---
const TEXT_DARK = "#272a33"; // texte foncé sur fond clair
const TEXT_LIGHT = "#ffffff"; // texte clair sur fond foncé

// ============================================================
// Palette institutionnelle MG2030.
// Valeurs EXACTES relevées sur le fichier vectoriel officiel de l'emblème de la
// République du Kosovo (assets/logos/kosovo-emblem.svg), pas sur une capture.
// Décision du 19/08/2026 (docs/GAPS.md, point 46).
// ============================================================
export const BRAND = {
  /** Bleu du champ et du contour de l'emblème. Marque et élément actif. */
  blue: "#034ea2",
  /** Or de la bordure et de la carte du Kosovo. Mise en valeur secondaire. */
  gold: "#d0a650",
  /** Blanc des six étoiles. Texte sur accent. */
  onBrand: TEXT_LIGHT,
} as const;

// ============================================================
// Tokens de surface (UI neutre). Repris INCHANGÉS du dépôt de charte : ce sont
// les tokens structurels, indépendants de tout projet.
// ============================================================
export const UI = {
  // Sidebar (palette sombre dédiée)
  sidebarBg: "#30323e",
  sidebarText: "#e8e9ed",
  sidebarTextMuted: "#9aa1ad",
  sidebarActive: "rgba(255,255,255,0.10)",
  sidebarHover: "rgba(255,255,255,0.05)",
  sidebarBorder: "rgba(255,255,255,0.08)",

  // Surfaces
  appBg: "#f3f4f6",
  surface: "#ffffff",
  border: "#e4e6eb",
  text: TEXT_DARK,
  textMuted: "#646b78",

  // États d'interaction
  focus: "#3c78d8",

  // Marque
  accent: BRAND.blue,
  accent2: BRAND.gold,
  onAccent: BRAND.onBrand,

  // Signaux. `danger` est DISTINCT de `accent` : l'accent n'étant pas rouge,
  // l'erreur ne peut pas le réutiliser (contrairement au dépôt de charte, où
  // l'accent rouge servait aussi de signal d'erreur).
  danger: "#c0392b",
  ok: "#38761d",
} as const;

// ============================================================
// Palette d'ÉTAT (pastels). Reprise du dépôt de charte pour le sens.
// Le rouge « en retard » est volontairement pastel et peu agressif : il ne doit
// pas être confondu avec `danger`, qui signale une erreur ou une destruction.
// ============================================================
export type StatusTone = "running" | "done" | "late" | "upcoming";

export const STATUS: Record<StatusTone, { bg: string; fg: string }> = {
  running: { bg: "#ffd966", fg: TEXT_DARK },
  done: { bg: "#b6d7a8", fg: TEXT_DARK },
  late: { bg: "#ea9999", fg: TEXT_DARK },
  upcoming: { bg: "#e6e8ec", fg: TEXT_DARK },
};

// ============================================================
// Palette du Gantt. Reprise de `lib/cronograma/cronograma-svg.ts` du dépôt de
// charte, où elle est éprouvée en production. Le jalon passe à l'or de marque.
// ============================================================
export const GANTT = {
  band: "#eceef2",
  grid: "#e6e8ec",
  gridStrong: "#d5d9df",
  text: "#1f2733",
  muted: "#6b7280",
  dateMuted: "#a3a8b2",
  /** Repère « aujourd'hui ». Volontairement distinct de l'accent et de danger. */
  today: "#d4351f",
  /** Barre neutre, sans code métier. */
  neutralBar: "#808080",
  /** Jalon (losange) et marge terminale. */
  milestone: BRAND.gold,
} as const;

// ============================================================
// Rayons, ombres, échelle typographique.
// Valeurs relevées par fréquence d'emploi dans le dépôt de charte.
// ============================================================
export const RADIUS = {
  xs: "2px", // cellule en cours d'édition
  sm: "4px",
  md: "6px", // DÉFAUT : boutons, champs, items de navigation
  lg: "8px", // conteneurs : tableau encadré, panneau
  xl: "12px", // carte de page pleine, modale
  full: "9999px",
} as const;

export const FONT_SIZE = {
  "2xs": "10px", // étiquettes du Gantt uniquement
  xs: "11px", // tableaux denses, en-têtes de colonne
  sm: "12px", // légendes, métadonnées, badges
  md: "14px", // DÉFAUT de l'interface
  lg: "16px", // corps de texte, intitulés de section
  xl: "18px", // titres de carte / modale
  "2xl": "20px", // titre de page
} as const;

// ============================================================
// Variables CSS dérivées — à poser en `style` sur <body>.
// C'est le seul pont entre ce fichier et le CSS.
// ============================================================
export const themeVars = {
  "--sidebar-bg": UI.sidebarBg,
  "--sidebar-text": UI.sidebarText,
  "--sidebar-text-muted": UI.sidebarTextMuted,
  "--sidebar-active": UI.sidebarActive,
  "--sidebar-hover": UI.sidebarHover,
  "--sidebar-border": UI.sidebarBorder,

  "--app-bg": UI.appBg,
  "--surface": UI.surface,
  "--border": UI.border,
  "--text": UI.text,
  "--text-muted": UI.textMuted,

  "--focus": UI.focus,
  "--accent": UI.accent,
  "--accent-2": UI.accent2,
  "--on-accent": UI.onAccent,
  "--danger": UI.danger,
  "--ok": UI.ok,

  "--radius-xs": RADIUS.xs,
  "--radius-sm": RADIUS.sm,
  "--radius-md": RADIUS.md,
  "--radius-lg": RADIUS.lg,
  "--radius-xl": RADIUS.xl,
} as CSSProperties;
