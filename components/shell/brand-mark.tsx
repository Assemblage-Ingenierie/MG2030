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
 * Logo AFD.
 *
 * ⚠ Fichier absent du dépôt : à reprendre de `peeb-cool-santafe/public/logos/afd.png`
 * ou à obtenir en vectoriel. Tant qu'il manque, on affiche le sigle en toutes
 * lettres plutôt qu'une image cassée.
 */
export function FunderMark({ className }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={cn(
        "text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]",
        className,
      )}
      title={t("app.funder")}
    >
      AFD
    </span>
  );
}
