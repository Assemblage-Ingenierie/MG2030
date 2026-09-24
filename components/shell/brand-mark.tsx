"use client";

// ============================================================
// components/shell/brand-mark.tsx — identité visuelle de l'en-tête.
//
// ⚠ LE BLOC « MG2030 » EST UN PLACEHOLDER ASSUMÉ. Le logo officiel
// « XXI Mediterranean Games · Prishtina 2030 » n'est pas disponible en vectoriel
// (docs/GAPS.md point 49). En attendant, la marque est composée
// typographiquement dans les couleurs institutionnelles.
//
// TOUT le rendu de la marque est confiné à ce fichier : le jour où le vectoriel
// arrive, la substitution ne touche ni le header ni la sidebar.
//
// L'emblème de la République du Kosovo, lui, est le FICHIER OFFICIEL, servi tel
// quel depuis `public/logos/`. Il n'est pas redessiné : un tracé approché serait
// une falsification d'emblème d'État.
// ============================================================

import { useT } from "@/components/i18n/i18n-context";
import { cn } from "@/lib/cn";

/** Bloc typographique « MG2030 », en attente du logo officiel. */
export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  /** Vrai en sidebar et sur petit écran : le sous-titre est masqué. */
  compact?: boolean;
}) {
  const t = useT();

  return (
    <span className={cn("flex items-baseline gap-2 leading-none", className)}>
      <span className="text-xl font-bold tracking-tight" style={{ color: "var(--accent)" }}>
        MG
        <span style={{ color: "var(--accent-2)" }}>2030</span>
      </span>
      {!compact && (
        <span className="hidden text-xs text-[var(--text-muted)] lg:inline">
          {t("app.subtitle")}
        </span>
      )}
    </span>
  );
}

/**
 * Emblème de la République du Kosovo — fichier officiel, servi tel quel.
 *
 * `alt` est vide et le conteneur porte le nom de l'institution : l'emblème est
 * décoratif, le texte voisin porte l'information.
 */
export function KosovoEmblem({ className }: { className?: string }) {
  return (
    // SVG servi depuis public/, jamais transformé : l'optimisation d'images
    // Vercel est proscrite (brief §4) et next/image n'apporterait rien sur un
    // vectoriel de 8 ko déjà à la bonne échelle.
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logos/kosovo-emblem.svg" alt="" className={className} />
  );
}

/**
 * Logo de l'Agence Française de Développement — fichier officiel, servi tel quel.
 *
 * Le sigle s'affichait jusqu'ici en toutes lettres, faute de fichier au dépôt.
 * Le voici, repris sans retouche du logotype officiel (1200 × 531, fond
 * transparent). Il n'est ni redessiné ni recadré : un bailleur institutionnel
 * a des règles d'emploi de sa marque, et un tracé approché ou une moitié de
 * verrou seraient l'un comme l'autre une altération.
 *
 * ⚠ CONSÉQUENCE ASSUMÉE DE NE PAS RECADRER : à la hauteur de l'en-tête, la
 * mention « AGENCE FRANÇAISE DE DÉVELOPPEMENT » tombe sous quatre pixels par
 * ligne et ne se lit plus. C'est le compromis retenu — le verrou complet,
 * illisible dans sa moitié basse, plutôt qu'une version tronquée. Le nom exact
 * reste porté par `title` et par le texte alternatif, donc accessible au
 * lecteur d'écran comme au survol.
 *
 * La hauteur par défaut aligne le logo sur l'emblème du Kosovo qui lui fait
 * face ; les écrans de connexion la remplacent par une valeur plus généreuse,
 * où la place ne manque pas.
 */
export function FunderMark({ className }: { className?: string }) {
  const t = useT();
  return (
    // Servi depuis public/, jamais transformé : l'optimisation d'images Vercel
    // est proscrite (brief §4).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/afd.png"
      alt={t("app.funder")}
      title={t("app.funder")}
      className={cn("h-[34px] w-auto sm:h-[38px]", className)}
    />
  );
}

/**
 * Logo officiel des XXIes Jeux méditerranéens, Prishtina 2030 — fichier fourni
 * le 24/09/2026 (PNG 292 × 342, fond transparent), servi tel quel. Comme pour
 * l'AFD, le verrou est gardé ENTIER : à la hauteur de l'en-tête, les mentions
 * sous le monogramme ne se lisent plus, mais on ne recadre pas un logo officiel.
 */
export function GamesMark({ className }: { className?: string }) {
  const t = useT();
  return (
    // Servi depuis public/, jamais transformé (brief §4).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logos/mg2030-games.png"
      alt={t("app.gamesLogo")}
      title={t("app.gamesLogo")}
      className={cn("h-[46px] w-auto sm:h-[52px]", className)}
    />
  );
}
