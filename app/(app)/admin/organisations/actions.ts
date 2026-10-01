"use server";

// ============================================================
// Organisations et rôles fonctionnels.
//
// Les deux tables existaient depuis la première migration, remplies par le
// seed, et aucun écran ne les touchait : ajouter une organisation ou corriger
// l'intitulé d'un poste demandait du SQL. Demandé le 01/10/2026.
//
// La RLS réserve déjà l'écriture à l'administrateur de la plateforme sur les
// deux tables. Le contrôle ci-dessous évite seulement d'envoyer une requête
// vouée à l'échec — et, surtout, de laisser croire à une écriture qui n'a pas
// eu lieu : chaque action vérifie le NOMBRE DE LIGNES réellement touchées,
// parce qu'un refus de la RLS ne lève pas d'erreur, il ne rend rien.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";

export type OrgResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "forbidden"
        | "emptyName"
        | "duplicateCode"
        | "inUse"
        | "writeFailed";
    };

async function assertAdmin(): Promise<boolean> {
  return isPlatformAdmin(await getCurrentUser());
}

/** Code court et stable : AFD, TA, PIU… Majuscules, sans espace. */
function toCode(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Organisations ───────────────────────────────────────────────────────────

export async function createOrganisation(
  code: string,
  name: string,
  accessMode: string,
): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };

  const cleanCode = toCode(code);
  const cleanName = name.trim();
  if (cleanCode === "" || cleanName === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_organisation").insert({
    code: cleanCode,
    name: cleanName,
    access_mode: accessMode === "contributor" ? "contributor" : "read_only",
  });

  if (error) return { ok: false, error: error.code === "23505" ? "duplicateCode" : "writeFailed" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Renomme une organisation. Le CODE ne change pas.
 *
 * Il identifie l'entité dans la couleur des barres du plan de charge, dans les
 * assignataires de la roadmap et dans le formulaire d'inscription. Le changer
 * ferait d'un rebaptême une migration.
 */
export async function updateOrganisation(
  id: string,
  name: string,
  accessMode: string,
): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };

  const cleanName = name.trim();
  if (cleanName === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_organisation")
    .update(
      {
        name: cleanName,
        access_mode: accessMode === "contributor" ? "contributor" : "read_only",
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Supprime une organisation INUTILISÉE.
 *
 * ⚠ ON VÉRIFIE AVANT, on ne laisse pas la clé étrangère trancher. `on delete`
 * n'est pas défini sur `mg2030_app_user.organisation_id` : Postgres refuserait
 * donc avec un message de contrainte, que personne ne lit comme « cette
 * organisation a encore des comptes ». On compte, et on le dit.
 */
export async function deleteOrganisation(id: string): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };
  const supabase = await createClient();

  const [{ count: users }, { count: roles }] = await Promise.all([
    supabase
      .from("mg2030_app_user")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id),
    supabase
      .from("mg2030_functional_role")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id),
  ]);

  if ((users ?? 0) > 0 || (roles ?? 0) > 0) return { ok: false, error: "inUse" };

  const { error, count } = await supabase
    .from("mg2030_organisation")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

// ── Rôles fonctionnels ──────────────────────────────────────────────────────

export async function createFunctionalRole(
  code: string,
  title: string,
  organisationId: string,
  posts: number,
): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };

  const cleanCode = toCode(code);
  const cleanTitle = title.trim();
  if (cleanCode === "" || cleanTitle === "" || organisationId === "") {
    return { ok: false, error: "emptyName" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_functional_role").insert({
    code: cleanCode,
    title: cleanTitle,
    organisation_id: organisationId,
    // `is_platform_admin` n'est PAS proposé : il ne décide plus rien depuis la
    // migration 0037, où les droits sont passés sur le compte. L'offrir ici
    // ferait croire qu'on accorde l'administration en créant un poste.
    posts: Number.isFinite(posts) && posts > 0 ? Math.round(posts) : 1,
  });

  if (error) return { ok: false, error: error.code === "23505" ? "duplicateCode" : "writeFailed" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function updateFunctionalRole(
  id: string,
  title: string,
  organisationId: string,
  posts: number,
): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };

  const cleanTitle = title.trim();
  if (cleanTitle === "" || organisationId === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_functional_role")
    .update(
      {
        title: cleanTitle,
        organisation_id: organisationId,
        posts: Number.isFinite(posts) && posts > 0 ? Math.round(posts) : 1,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Supprime un rôle INUTILISÉ.
 *
 * `mg2030_app_user.functional_role_id` est obligatoire : un compte ne peut pas
 * perdre son poste. Contrairement aux sujets de la roadmap, on ne délie donc
 * pas — on refuse, et on dit combien de comptes le portent.
 */
export async function deleteFunctionalRole(id: string): Promise<OrgResult> {
  if (!(await assertAdmin())) return { ok: false, error: "forbidden" };
  const supabase = await createClient();

  const { count: users } = await supabase
    .from("mg2030_app_user")
    .select("id", { count: "exact", head: true })
    .eq("functional_role_id", id);

  if ((users ?? 0) > 0) return { ok: false, error: "inUse" };

  const { error, count } = await supabase
    .from("mg2030_functional_role")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}
