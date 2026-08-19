// ============================================================
// lib/auth/types.ts — modèle d'utilisateur, ISOMORPHE (serveur + client).
// Aucun accès session ni base : importable depuis un Client Component.
// ============================================================

import type { Locale } from "@/lib/i18n/config";

/** Mode d'accès de l'organisation — DIMENSION 1 des droits (brief §8). */
export type AccessMode = "contributor" | "read_only";

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
  role: { code: string; title: string; isPlatformAdmin: boolean };

  /** Codes de permission accordés au rôle (DIMENSION 2). */
  permissions: string[];
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
  u?.role.isPlatformAdmin ?? false;

export const canWrite = (u: AppUser | null): boolean =>
  (u?.isActive ?? false) && u?.organisation.accessMode === "contributor";

/** DIMENSION 2. L'administrateur plateforme court-circuite la matrice. */
export function hasPermission(u: AppUser | null, permission: string): boolean {
  if (!u || !u.isActive) return false;
  if (u.role.isPlatformAdmin) return true;
  return u.permissions.includes(permission);
}

/**
 * Un droit d'écriture exige les DEUX premières dimensions : le mode d'accès de
 * l'organisation, puis la permission du rôle. L'AFD est `read_only`, donc aucun
 * de ses membres n'écrit, quelle que soit sa matrice.
 *
 * Ceci ne remplace jamais la RLS : c'est un confort d'interface, qui évite de
 * proposer un bouton dont l'action sera refusée par la base (brief §8).
 */
export const canDo = (u: AppUser | null, permission: string): boolean =>
  canWrite(u) && hasPermission(u, permission);
