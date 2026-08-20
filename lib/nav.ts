// ============================================================
// lib/nav.ts — navigation déclarée en DONNÉES, jamais en JSX.
//
// `labelKey` est une clé de messages/, pas un libellé : aucune chaîne en dur
// dès le premier composant (brief §6).
//
// `permission` prépare le filtrage par rôle fonctionnel (brief §8, dimension 2).
// Tant que la matrice rôle × permission n'est pas chargée, tous les items sont
// visibles ; le filtrage s'activera au lot 4.
// ============================================================

import type { NavIconName } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: NavIconName;
  /** Permission requise pour VOIR l'item. `null` = visible de tout membre actif. */
  permission: string | null;
  /** Module pas encore livré : l'item est affiché en sourdine et non cliquable. */
  upcoming?: boolean;
}

export interface NavGroup {
  /** Clé de libellé du groupe, ou `null` pour un groupe sans intertitre. */
  labelKey: string | null;
  items: NavItem[];
}

/**
 * Ordre calqué sur le périmètre de la version 1 (brief §9) : référentiel, puis
 * planification, puis documents, puis administration. Les modules non encore
 * livrés portent `upcoming` — ils annoncent la structure sans mentir sur l'état.
 */
export const NAV: NavGroup[] = [
  {
    labelKey: null,
    items: [
      { href: "/", labelKey: "nav.dashboard", icon: "dashboard", permission: null, upcoming: true },
    ],
  },
  {
    labelKey: "nav.referential",
    items: [
      { href: "/sites", labelKey: "nav.sites", icon: "sites", permission: null },
      { href: "/buildings", labelKey: "nav.buildings", icon: "buildings", permission: null },
      { href: "/contracts", labelKey: "nav.contracts", icon: "contracts", permission: null },
    ],
  },
  {
    labelKey: "nav.planning",
    items: [
      { href: "/schedule", labelKey: "nav.plan", icon: "gantt", permission: null },
      { href: "/deliverables", labelKey: "nav.deliverables", icon: "deliverables", permission: null },
      { href: "/no-objections", labelKey: "nav.noObjections", icon: "contracts", permission: null },
    ],
  },
  {
    labelKey: "nav.documents",
    items: [
      { href: "/library", labelKey: "nav.library", icon: "library", permission: null },
    ],
  },
  {
    labelKey: "nav.administration",
    items: [
      { href: "/notifications", labelKey: "nav.notifications", icon: "notifications", permission: null },
      { href: "/org-chart", labelKey: "nav.orgChart", icon: "orgChart", permission: null },
      { href: "/admin/users", labelKey: "nav.users", icon: "users", permission: "user.admin" },
      { href: "/design-system", labelKey: "nav.designSystem", icon: "admin", permission: null },
    ],
  },
];

/** Un item est actif si la route courante est lui-même ou l'un de ses descendants. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
