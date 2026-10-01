// ============================================================
// lib/nav.ts — navigation déclarée en DONNÉES, jamais en JSX.
//
// `labelKey` est une clé de messages/, pas un libellé : aucune chaîne en dur
// dès le premier composant (brief §6).
//
// Deux filtres, et deux seulement :
//   • `adminOnly` — écran d'administration, invisible aux autres. C'est le
//     CODE qui décide, parce que cela ne se négocie pas.
//   • la table `mg2030_nav_visibility` — onglets masqués par l'administrateur
//     depuis l'écran d'administration. C'est l'EXPLOITATION qui décide, parce
//     que cela change au rythme des livraisons.
//
// La matrice rôle × permission qui gouvernait ce champ auparavant a disparu
// avec la migration 0037 (trois niveaux d'accès).
// ============================================================

import type { NavIconName } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: NavIconName;
  /** Écran d'administration : visible du seul niveau `administrator`. */
  adminOnly?: boolean;
  /** Module pas encore livré : l'item est affiché en sourdine et non cliquable. */
  upcoming?: boolean;
  /** Réservé à l'assistance technique (écrans internes) : masqué pour les autres. */
  taOnly?: boolean;
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
      { href: "/", labelKey: "nav.dashboard", icon: "dashboard" },
    ],
  },
  {
    labelKey: "nav.referential",
    items: [
      { href: "/sites", labelKey: "nav.sites", icon: "sites" },
      { href: "/buildings", labelKey: "nav.buildings", icon: "buildings" },
      { href: "/contracts", labelKey: "nav.contracts", icon: "contracts" },
      { href: "/map", labelKey: "nav.map", icon: "map" },
    ],
  },
  {
    labelKey: "nav.planning",
    items: [
      { href: "/roadmap", labelKey: "nav.roadmap", icon: "roadmap" },
      { href: "/schedule", labelKey: "nav.plan", icon: "gantt" },
      { href: "/deliverables", labelKey: "nav.deliverables", icon: "deliverables" },
      { href: "/no-objections", labelKey: "nav.noObjections", icon: "contracts" },
      { href: "/procurement", labelKey: "nav.procurement", icon: "admin" },
    ],
  },
  {
    labelKey: "nav.documents",
    items: [
      { href: "/library", labelKey: "nav.library", icon: "library" },
    ],
  },
  {
    labelKey: "nav.administration",
    items: [
      { href: "/org-chart", labelKey: "nav.orgChart", icon: "orgChart" },
      { href: "/data-flows", labelKey: "nav.dataFlows", icon: "flows" },
      { href: "/admin/users", labelKey: "nav.users", icon: "users", adminOnly: true },
      { href: "/admin/navigation", labelKey: "nav.tabs", icon: "admin", adminOnly: true },
      { href: "/design-system", labelKey: "nav.designSystem", icon: "admin", taOnly: true },
    ],
  },
];

/** Un item est actif si la route courante est lui-même ou l'un de ses descendants. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Les onglets qu'un administrateur a le droit de masquer.
 *
 * Deux exclusions, et chacune évite de s'enfermer dehors :
 *   • les ÉCRANS D'ADMINISTRATION — masquer celui des onglets retirerait le
 *     seul moyen de revenir en arrière ;
 *   • le TABLEAU DE BORD, qui est la racine : `/` est le préfixe de tout, et
 *     `hiddenRouteFor` l'écarte déjà pour cette raison.
 */
export const HIDEABLE_HREFS: string[] = NAV.flatMap((g) => g.items)
  .filter((i) => !i.adminOnly && i.href !== "/")
  .map((i) => i.href);

/**
 * Cette route peut-elle être masquée ?
 *
 * ⚠ LA MÊME RÈGLE AUX TROIS ENDROITS : l'action qui écrit, le menu qui dessine
 * et le garde qui refuse l'écran. Si l'un d'eux appliquait sa propre lecture,
 * une ligne `/` arrivée par un autre chemin ferait disparaître le menu sans
 * pour autant fermer les pages — une incohérence impossible à diagnostiquer.
 */
export const isHideable = (href: string): boolean => HIDEABLE_HREFS.includes(href);

/** Qui regarde le menu, et quels onglets l'administrateur a masqués. */
export interface NavAudience {
  isAdmin: boolean;
  isTa: boolean;
  /** Routes masquées, telles que `mg2030_nav_visibility` les enregistre. */
  hidden: ReadonlySet<string>;
}

/** Un item tel qu'il sera rendu : on sait s'il n'est là que pour son auteur. */
export type ResolvedNavItem = NavItem & { hidden: boolean };

export interface ResolvedNavGroup {
  labelKey: string | null;
  items: ResolvedNavItem[];
}

/**
 * Le menu tel qu'il doit s'afficher pour cette personne.
 *
 * ⚠ L'ADMINISTRATEUR CONTINUE DE VOIR LES ONGLETS MASQUÉS, marqués comme tels.
 * Les lui retirer l'enfermerait dehors : il ne pourrait plus ni ouvrir le
 * module qu'il est en train de finir, ni, s'il masquait l'écran des onglets
 * lui-même, revenir en arrière autrement que par SQL.
 *
 * Un groupe vidé de tous ses items disparaît : un intertitre seul annonce une
 * section qui n'existe pas.
 *
 * Pur, donc testé — et ni le serveur ni le navigateur n'en détient sa propre
 * version.
 */
export function visibleNav(audience: NavAudience): ResolvedNavGroup[] {
  return NAV.map((group) => ({
    labelKey: group.labelKey,
    items: group.items
      .filter((item) => !(item.taOnly && !audience.isTa))
      .filter((item) => !(item.adminOnly && !audience.isAdmin))
      .filter((item) => audience.isAdmin || !isHidden(item.href, audience.hidden))
      .map((item) => ({ ...item, hidden: isHidden(item.href, audience.hidden) })),
  })).filter((group) => group.items.length > 0);
}

/**
 * La route courante tombe-t-elle dans un onglet masqué ?
 *
 * Sert à refuser l'écran à qui en connaîtrait l'adresse — un onglet retiré du
 * menu mais qu'un signet rouvre n'est pas masqué, il est seulement discret.
 * Ce refus reste de la PRÉSENTATION : les données, elles, sont protégées par
 * la RLS et par elle seule (brief §8).
 */
export function hiddenRouteFor(
  pathname: string,
  hidden: ReadonlySet<string>,
): string | null {
  for (const href of hidden) {
    if (isHideable(href) && isActive(pathname, href)) return href;
  }
  return null;
}

const isHidden = (href: string, hidden: ReadonlySet<string>): boolean =>
  isHideable(href) && hidden.has(href);
