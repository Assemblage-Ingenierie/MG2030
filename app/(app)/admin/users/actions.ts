"use server";

// ============================================================
// Actions d'administration des comptes.
//
// Aucune ne cree de compte : la creation d'identifiants passe par Supabase Auth
// et releve de l'administrateur humain (voir docs/ADMIN.md). Ces actions ne
// font qu'ACTIVER, DESACTIVER et AFFECTER un perimetre a un compte existant.
//
// La RLS reste l'autorite : chacune de ces ecritures est refusee par la base si
// l'appelant n'est pas administrateur plateforme. Le controle applicatif
// ci-dessous evite seulement d'envoyer une requete vouee a l'echec.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isPlatformAdmin(user)) {
    throw new Error("Action reservee a l'administrateur de la plateforme.");
  }
  return user!;
}

export async function setUserActive(userId: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("mg2030_app_user")
    .update({
      is_active: active,
      approved_at: active ? new Date().toISOString() : null,
      approved_by: active ? admin.id : null,
    })
    .eq("id", userId);

  if (error) throw new Error(`Activation : ${error.message}`);
  revalidatePath("/admin/users");
}

/**
 * Affecte le role fonctionnel.
 *
 * Deuxieme dimension des droits (brief §8) : l'organisation dit en lecture ou
 * en contribution, le role dit QUOI. Il ne se reglait que par SQL — un ecran
 * d'administration des comptes qui affiche le role sans permettre de le
 * changer n'administre rien.
 *
 * Le role appartient a une organisation. On refuse un role d'une autre
 * organisation que celle du compte : la base l'accepterait, mais l'utilisateur
 * heriterait de permissions concues pour un autre corps de metier.
 */
export async function setUserRole(userId: string, roleId: string): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: user }, { data: role }] = await Promise.all([
    supabase.from("mg2030_app_user").select("organisation_id").eq("id", userId).single(),
    supabase.from("mg2030_functional_role").select("organisation_id").eq("id", roleId).single(),
  ]);

  if (!user || !role) throw new Error("Compte ou role introuvable.");
  if (user.organisation_id !== role.organisation_id) {
    throw new Error("Ce role appartient a une autre organisation.");
  }

  const { error } = await supabase
    .from("mg2030_app_user")
    .update({ functional_role_id: roleId })
    .eq("id", userId);
  if (error) throw new Error(`Role : ${error.message}`);

  revalidatePath("/admin/users");
}

export async function setUserScope(
  userId: string,
  kind: "global" | "subproject" | "site" | "lot",
  targetId: string | null,
): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();

  // Le perimetre est REMPLACE, pas cumule : un utilisateur porte un perimetre,
  // pas une collection historique de perimetres oublies.
  const { error: delError } = await supabase
    .from("mg2030_app_user_scope")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(`Perimetre : ${delError.message}`);

  const row: Record<string, unknown> = { user_id: userId, kind };
  if (kind === "subproject") row.subproject = targetId;
  if (kind === "site") row.site_id = targetId;
  if (kind === "lot") row.lot_id = targetId;

  const { error } = await supabase.from("mg2030_app_user_scope").insert(row);
  if (error) throw new Error(`Perimetre : ${error.message}`);
  revalidatePath("/admin/users");
}
