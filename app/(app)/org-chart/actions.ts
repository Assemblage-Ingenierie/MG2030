"use server";

// ============================================================
// app/(app)/org-chart/actions.ts — modifier l'organigramme sur place.
//
// Les cases de l'organigramme sont les rôles fonctionnels de la base. Les
// corriger demandait de quitter l'écran pour celui des organisations, de
// retrouver la ligne dans un tableau de quatorze, puis de revenir vérifier le
// rendu. Demandé le 01/10/2026 — on édite là où on regarde.
//
// ⚠ TROIS CHAMPS, ET PAS LE CODE. `code` identifie le rôle dans la mise en
// page de l'organigramme (`box("COORD")`), dans les autorisations
// documentaires et dans le chargement initial : le changer ferait d'un
// rebaptême une migration. On renomme l'INTITULÉ, qui est ce qu'on lit.
//
// La RLS réserve déjà l'écriture à l'administrateur sur les deux tables
// touchées. Le contrôle applicatif évite d'envoyer une requête vouée à
// l'échec — et surtout de laisser croire à une écriture qui n'a pas eu lieu :
// un refus de la RLS ne lève pas d'erreur, il ne rend aucune ligne.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { isTimeType } from "@/lib/org/time-types";

export type ChartResult =
  | { ok: true }
  | { ok: false; error: "forbidden" | "emptyName" | "invalidPosts" | "writeFailed" };

export async function updateRoleBox(
  roleId: string,
  title: string,
  posts: number,
  timeType: string | null,
): Promise<ChartResult> {
  if (!isPlatformAdmin(await getCurrentUser())) return { ok: false, error: "forbidden" };

  const cleanTitle = title.trim();
  if (cleanTitle === "") return { ok: false, error: "emptyName" };
  if (!Number.isInteger(posts) || posts < 1 || posts > 99) {
    return { ok: false, error: "invalidPosts" };
  }

  const clean = timeType !== null && isTimeType(timeType) ? timeType : null;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_functional_role")
    .update({ title: cleanTitle, posts, time_type: clean }, { count: "exact" })
    .eq("id", roleId);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/org-chart");
  revalidatePath("/admin/organisations");
  revalidatePath("/admin/users");
  return { ok: true };
}

/**
 * Place un compte sur un poste.
 *
 * ⚠ ON DÉPLACE, ON NE RETIRE PAS. `mg2030_app_user.functional_role_id` est
 * OBLIGATOIRE : un compte tient toujours exactement un poste. Il n'y a donc
 * pas de bouton « retirer » sur une case — on affecte ailleurs, et la case
 * d'origine se vide d'elle-même. C'est aussi la vérité du projet : personne
 * ne travaille sur le programme sans y occuper une fonction.
 *
 * Le déclencheur `mg2030_private.guard_access_columns()` refuse ce changement
 * à qui n'est pas administrateur, et il le refuse en LEVANT une exception —
 * d'où le `error` traité ici comme un refus et non comme une panne.
 */
export async function assignRoleHolder(
  userId: string,
  roleId: string,
): Promise<ChartResult> {
  if (!isPlatformAdmin(await getCurrentUser())) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_app_user")
    .update({ functional_role_id: roleId }, { count: "exact" })
    .eq("id", userId);

  if (error) return { ok: false, error: "forbidden" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/org-chart");
  revalidatePath("/admin/users");
  return { ok: true };
}
