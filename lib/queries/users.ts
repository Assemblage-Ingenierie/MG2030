import "server-only";

// ============================================================
// lib/queries/users.ts — lecture de l'annuaire MG2030.
//
// Toutes les requêtes passent par le client à session utilisateur : la RLS
// s'applique. Aucune clé de service n'est utilisée nulle part dans
// l'application (docs/SCHEMA.md §10).
// ============================================================

import { createClient } from "@/lib/supabase/server";

export interface DirectoryUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  isActive: boolean;
  organisation: { code: string; name: string; accessMode: string };
  role: { id: string; code: string; title: string };
  scopes: { kind: string; subproject: string | null; siteCode: string | null; lotCode: string | null }[];
}

export async function listUsers(): Promise<DirectoryUser[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_app_user")
    .select(
      `id, email, full_name, job_title, is_active,
       mg2030_organisation ( code, name, access_mode ),
       mg2030_functional_role ( id, code, title ),
       mg2030_app_user_scope ( kind, subproject,
                               mg2030_site ( site_code ),
                               mg2030_lot ( lot_code ) )`,
    )
    .order("full_name");

  if (error) throw new Error(`Lecture de l'annuaire : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      email: string;
      full_name: string;
      job_title: string | null;
      is_active: boolean;
      mg2030_organisation: { code: string; name: string; access_mode: string };
      mg2030_functional_role: { id: string; code: string; title: string };
      mg2030_app_user_scope: {
        kind: string;
        subproject: string | null;
        mg2030_site: { site_code: string } | null;
        mg2030_lot: { lot_code: string } | null;
      }[];
    };
    return {
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      jobTitle: r.job_title,
      isActive: r.is_active,
      organisation: {
        code: r.mg2030_organisation.code,
        name: r.mg2030_organisation.name,
        accessMode: r.mg2030_organisation.access_mode,
      },
      role: {
        id: r.mg2030_functional_role.id,
        code: r.mg2030_functional_role.code,
        title: r.mg2030_functional_role.title,
      },
      scopes: (r.mg2030_app_user_scope ?? []).map((s) => ({
        kind: s.kind,
        subproject: s.subproject,
        siteCode: s.mg2030_site?.site_code ?? null,
        lotCode: s.mg2030_lot?.lot_code ?? null,
      })),
    };
  });
}

export interface RoleOption {
  id: string;
  code: string;
  title: string;
  posts: number;
  organisation: { code: string; accessMode: string };
  permissions: string[];
}

/** Les 14 rôles fonctionnels, avec leur matrice de permissions. */
export async function listRoles(): Promise<RoleOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_functional_role")
    .select(
      `id, code, title, posts,
       mg2030_organisation ( code, access_mode ),
       mg2030_role_permission ( permission_code )`,
    )
    .order("code");

  if (error) throw new Error(`Lecture des roles : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      code: string;
      title: string;
      posts: number;
      mg2030_organisation: { code: string; access_mode: string };
      mg2030_role_permission: { permission_code: string }[];
    };
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      posts: r.posts,
      organisation: { code: r.mg2030_organisation.code, accessMode: r.mg2030_organisation.access_mode },
      permissions: (r.mg2030_role_permission ?? []).map((p) => p.permission_code).sort(),
    };
  });
}
