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
