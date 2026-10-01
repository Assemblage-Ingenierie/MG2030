// ============================================================
// lib/auth/types.ts — modèle d'utilisateur, ISOMORPHE (serveur + client).
// Aucun accès session ni base : importable depuis un Client Component.
// ============================================================

import type { Locale } from "@/lib/i18n/config";

/**
 * Mode d'accès de l'organisation.
 *
 * ⚠ NE DÉCIDE PLUS RIEN depuis la migration 0037. Conservé comme information
 * de gouvernance (brief §3 : l'AFD consulte, elle ne saisit pas). Les droits
 * se lisent sur `AppUser.accessLevel`.
 */
export type AccessMode = "contributor" | "read_only";

/**
 * Niveau d'accès — SEULE autorité applicative sur le droit d'écrire.
 *
 * Trois valeurs, et c'est tout le modèle :
 *   • `viewer`        — consulte, filtre, trie, exporte ; n'écrit rien ;
 *   • `editor`        — écrit partout où il voit, SAUF sur les comptes ;
 *   • `administrator` — éditeur, plus la gestion des comptes et des onglets.
 *
 * Il remplace le croisement « mode d'organisation × matrice rôle × permission »
 * : deux dimensions qui se recouvraient, qu'on ne pouvait régler que par SQL,
 * et dont personne ne savait dire de mémoire ce qu'elles donnaient.
 *
 * Le PÉRIMÈTRE (`scopes`) est une autre question — « sur quoi » — et reste
 * entier.
 */
export type AccessLevel = "viewer" | "editor" | "administrator";

export const ACCESS_LEVELS: readonly AccessLevel[] = [
  "viewer",
  "editor",
  "administrator",
] as const;

export const isAccessLevel = (v: string): v is AccessLevel =>
  (ACCESS_LEVELS as readonly string[]).includes(v);

/** Périmètre — DIMENSION 3. */
export type ScopeKind = "global" | "subproject" | "site" | "lot";

export interface UserScope {
  kind: ScopeKind;
  subproject: string | null;
  siteId: string | null;
  lotId: string | null;
}

/**
 * Utilisateur MG2030.
 *
 * ⚠ L'existence de cet objet signifie « ce compte authentifié appartient à
 * MG2030 ». `auth.users` est PARTAGÉ avec une autre application du projet
 * Supabase : un compte authentifié n'est pas forcément un utilisateur MG2030
 * (docs/SCHEMA.md §1).
 */
export interface AppUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  locale: Locale;
  isActive: boolean;

  organisation: { code: string; name: string; accessMode: AccessMode };

  /**
   * Le POSTE, pas les droits. `mg2030_functional_role` décrit la place dans
   * l'organigramme et l'intitulé du métier ; depuis 0037 il n'accorde plus
   * rien.
   */
  role: { code: string; title: string };

  /** Ce que ce compte a le droit de faire. Voir {@link AccessLevel}. */
  accessLevel: AccessLevel;
  scopes: UserScope[];
}

/**
 * État d'accès, résolu à chaque requête.
 *
 * Les trois états ne se confondent pas, et c'est délibéré :
 *   • `anonymous` — pas de session ;
 *   • `foreign`   — authentifié, mais AUCUNE ligne dans `mg2030_app_user`.
 *                   Typiquement un utilisateur de l'autre application du
 *                   projet. Il ne doit PAS voir « en attente de validation » :
 *                   il attendrait une validation qui ne viendra jamais ;
 *   • `pending`   — compte MG2030 créé mais pas encore activé ;
 *   • `active`    — compte MG2030 opérationnel.
 */
export type AuthState =
  | { status: "anonymous" }
  | { status: "foreign"; email: string }
  | { status: "pending"; user: AppUser }
  | { status: "active"; user: AppUser };

export const isPlatformAdmin = (u: AppUser | null): boolean =>
  (u?.isActive ?? false) && u?.accessLevel === "administrator";

/**
 * Membre de l'assistance technique : organisation TA, ou administrateur de la
 * plateforme — rôle tenu par la TA (organigramme, 25/09/2026). Sert à réserver
 * les écrans internes, comme la revue de charte.
 */
export const isTechnicalAssistance = (u: AppUser | null): boolean =>
  (u?.isActive ?? false) && (u?.organisation.code === "TA" || isPlatformAdmin(u));

export const canWrite = (u: AppUser | null): boolean =>
  (u?.isActive ?? false) &&
  (u?.accessLevel === "editor" || u?.accessLevel === "administrator");

/**
 * Le code de permission ne distingue plus qu'UNE chose : la gestion des
 * comptes, réservée à l'administrateur — « éditeur » se définit précisément
 * comme « tout, sauf gérer les utilisateurs ».
 *
 * L'argument est conservé plutôt que supprimé : il dit au point d'appel ce qui
 * est protégé, et il permettra de refaire de la granularité sans retoucher les
 * appelants. Même raisonnement que `mg2030_private.has_perm()` côté base, dont
 * ceci est le miroir exact — les deux doivent rester d'accord.
 */
export function hasPermission(u: AppUser | null, permission: string): boolean {
  if (!u || !u.isActive) return false;
  return permission.startsWith("user.") ? isPlatformAdmin(u) : canWrite(u);
}

/**
 * Ceci ne remplace jamais la RLS : c'est un confort d'interface, qui évite de
 * proposer un bouton dont l'action sera refusée par la base (brief §8).
 */
export const canDo = (u: AppUser | null, permission: string): boolean =>
  canWrite(u) && hasPermission(u, permission);
