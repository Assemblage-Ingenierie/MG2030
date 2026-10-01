"use server";

// ============================================================
// Actions d'administration des onglets.
//
// La RLS reste l'autorité : `mg2030_nav_visibility` n'accepte l'écriture que
// d'un administrateur. Le contrôle applicatif ci-dessous évite seulement
// d'envoyer une requête vouée à l'échec.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { isHideable } from "@/lib/nav";

export async function setNavHidden(href: string, hidden: boolean): Promise<void> {
  const me = await getCurrentUser();
  if (!isPlatformAdmin(me)) {
    throw new Error("Action reservee a l'administrateur de la plateforme.");
  }

  // ⚠ ON N'ÉCRIT QUE DES ROUTES CONNUES. `href` est la clef primaire de la
  // table : accepter une chaîne arbitraire laisserait s'accumuler des lignes
  // qui ne correspondent à aucun onglet, et qu'aucun écran ne permettrait plus
  // de retrouver pour les effacer.
  if (!isHideable(href)) {
    throw new Error("Cet onglet ne peut pas etre masque.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_nav_visibility")
    .upsert({ href, is_hidden: hidden, updated_by: me!.id }, { onConflict: "href" });

  if (error) throw new Error(`Visibilite de l'onglet : ${error.message}`);

  // TOUTE l'application, pas seulement cet écran : le menu est dans le layout,
  // donc dans chaque page.
  revalidatePath("/", "layout");
}
