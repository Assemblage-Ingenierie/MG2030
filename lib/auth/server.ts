import "server-only";

// ============================================================
// lib/auth/server.ts — résolution de l'utilisateur courant, côté serveur.
// ============================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/config";
import type { AppUser, AuthState } from "./types";

/** Forme brute renvoyée par PostgREST pour la requête ci-dessous. */
interface Row {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  locale: string;
  is_active: boolean;
  mg2030_organisation: { code: string; name: string; access_mode: string } | null;
  mg2030_functional_role: {
    code: string;
    title: string;
    is_platform_admin: boolean;
    mg2030_role_permission: { permission_code: string }[];
  } | null;
  mg2030_app_user_scope: {
    kind: string;
    subproject: string | null;
    site_id: string | null;
    lot_id: string | null;
  }[];
}

/**
 * État d'accès de la requête courante.
 *
 * `cache()` de React mémoïse l'appel pour la durée du rendu : le layout, la
 * page et chaque Server Component peuvent l'appeler sans multiplier les
 * requêtes.
 *
 * On utilise `getUser()` et non `getSession()` : `getUser()` valide le jeton
 * auprès du serveur d'authentification, `getSession()` fait confiance au
 * cookie. Sur un rendu serveur, seul le premier est sûr.
 */
export const getAuthState = cache(async (): Promise<AuthState> => {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { status: "anonymous" };

  // ⚠ auth.users est PARTAGÉ. Être authentifié ne suffit pas : il faut une
  // ligne dans mg2030_app_user. La RLS le vérifie déjà côté base ; ici on le
  // vérifie pour choisir le bon écran.
  const { data, error } = await supabase
    .from("mg2030_app_user")
    .select(
      `id, email, full_name, job_title, locale, is_active,
       mg2030_organisation ( code, name, access_mode ),
       mg2030_functional_role ( code, title, is_platform_admin,
                                mg2030_role_permission ( permission_code ) ),
       mg2030_app_user_scope ( kind, subproject, site_id, lot_id )`,
    )
    .eq("id", authUser.id)
    .maybeSingle<Row>();

  if (error || !data || !data.mg2030_organisation || !data.mg2030_functional_role) {
    // Pas de ligne, ou ligne incomplète : ce compte n'appartient pas à MG2030.
    return { status: "foreign", email: authUser.email ?? "" };
  }

  const user: AppUser = {
    id: data.id,
    email: data.email,
    fullName: data.full_name,
    jobTitle: data.job_title,
    locale: isLocale(data.locale) ? data.locale : DEFAULT_LOCALE,
    isActive: data.is_active,
    organisation: {
      code: data.mg2030_organisation.code,
      name: data.mg2030_organisation.name,
      accessMode: data.mg2030_organisation.access_mode === "contributor" ? "contributor" : "read_only",
    },
    role: {
      code: data.mg2030_functional_role.code,
      title: data.mg2030_functional_role.title,
      isPlatformAdmin: data.mg2030_functional_role.is_platform_admin,
    },
    permissions: (data.mg2030_functional_role.mg2030_role_permission ?? []).map(
      (p) => p.permission_code,
    ),
    scopes: (data.mg2030_app_user_scope ?? []).map((s) => ({
      kind: s.kind as AppUser["scopes"][number]["kind"],
      subproject: s.subproject,
      siteId: s.site_id,
      lotId: s.lot_id,
    })),
  };

  return data.is_active ? { status: "active", user } : { status: "pending", user };
});

/** Utilisateur actif, ou `null`. Raccourci pour les écrans métier. */
export async function getCurrentUser(): Promise<AppUser | null> {
  const state = await getAuthState();
  return state.status === "active" ? state.user : null;
}

/**
 * Exige un utilisateur actif. Lève si absent.
 *
 * À n'utiliser que dans un composant déjà protégé par le middleware et le
 * garde d'accès : c'est un filet, pas la protection principale — qui est et
 * reste la RLS.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Utilisateur MG2030 actif requis.");
  return user;
}
