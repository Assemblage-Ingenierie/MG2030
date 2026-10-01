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
import { bufferStartFrom } from "@/lib/schedule/buffer";

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

// ============================================================
// Cadre calendaire des Jeux.
//
// L'échéance du 1er janvier 2030 et la marge terminale de quatre mois sont le
// cadre dans lequel tout le reste doit tenir (brief §2). Elles venaient du
// seed, et les corriger demandait du SQL — or une date de cérémonie
// d'ouverture peut bouger, et le nombre de mois de marge est un arbitrage de
// pilotage, pas une donnée technique. Demandé le 01/10/2026.
// ============================================================

export type FrameResult =
  | { ok: true; bufferStart: string }
  | { ok: false; error: "forbidden" | "invalidDate" | "invalidMonths" | "writeFailed" };

/**
 * Pose l'échéance et la marge SUR TOUS LES SCÉNARIOS.
 *
 * La date d'ouverture des Jeux est un fait du projet, pas une variante : si
 * elle ne valait que pour le scénario affiché, deux écrans regardant deux
 * scénarios annonceraient deux dates de cérémonie. Les scénarios se
 * distinguent par leurs tâches, pas par leur échéance.
 */
export async function setGamesFrame(
  deadline: string,
  bufferMonths: number,
): Promise<FrameResult> {
  const me = await getCurrentUser();
  if (!isPlatformAdmin(me)) return { ok: false, error: "forbidden" };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline))) {
    return { ok: false, error: "invalidDate" };
  }
  if (!Number.isInteger(bufferMonths) || bufferMonths < 0 || bufferMonths > 36) {
    return { ok: false, error: "invalidMonths" };
  }

  const bufferStart = bufferStartFrom(deadline, bufferMonths);

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_schedule_scenario")
    .update(
      {
        deadline_date: deadline,
        buffer_months: bufferMonths,
        buffer_start_date: bufferStart,
      },
      { count: "exact" },
    )
    // Pas de filtre : tous les scénarios. `neq` sur une colonne jamais nulle
    // porte la clause que PostgREST exige pour un `update` global.
    .not("id", "is", null);

  if (error) return { ok: false, error: "writeFailed" };
  // Un refus de la RLS ne lève pas d'erreur : il ne rend aucune ligne.
  if (count === 0) return { ok: false, error: "forbidden" };

  // Le cadre se lit au Plan, au tableau de bord et dans les deux impressions.
  revalidatePath("/", "layout");
  return { ok: true, bufferStart };
}
