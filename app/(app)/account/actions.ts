"use server";

// ============================================================
// Sa propre fiche.
//
// ⚠ CHACUN MODIFIE LA SIENNE, ET RIEN D'AUTRE. L'identifiant ne vient JAMAIS
// du formulaire : il est relu de la session. Sans cela, poster l'identifiant
// d'un collègue suffirait à renommer son compte — la politique
// `mg2030_app_user_update_self` le refuserait, mais une action qui compte sur
// la base pour rattraper une erreur de conception est une action mal écrite.
//
// Les colonnes de DROITS (niveau d'accès, activation, organisation, rôle) sont
// hors d'atteinte ici, et un déclencheur les verrouille de toute façon
// (migration 0037).
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { isLocale } from "@/lib/i18n/config";

export type ProfileResult =
  | { ok: true }
  | { ok: false; error: "emptyName" | "writeFailed" };

export async function updateOwnProfile(input: {
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  locale: string;
}): Promise<ProfileResult> {
  const me = await requireUser();

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (firstName === "" || lastName === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  // `full_name` n'est pas écrit : il est DÉRIVÉ par déclencheur (migration
  // 0036). L'écrire ici ouvrirait la porte à deux sources de vérité.
  const { error } = await supabase
    .from("mg2030_app_user")
    .update({
      first_name: firstName,
      last_name: lastName,
      job_title: input.jobTitle?.trim() || null,
      locale: isLocale(input.locale) ? input.locale : "en",
    })
    .eq("id", me.id);

  if (error) return { ok: false, error: "writeFailed" };

  // Le nom traverse tout l'écran — en-tête, annuaire, organigramme : on
  // revalide le cadre entier, pas la seule fiche.
  revalidatePath("/", "layout");
  return { ok: true };
}

export type EmailResult =
  | { ok: true }
  | { ok: false; error: "invalidEmail" | "sameEmail" | "writeFailed"; detail?: string };

/**
 * Demande un changement d'adresse.
 *
 * ⚠ RIEN NE CHANGE AVANT LA CONFIRMATION. Supabase envoie un lien à la
 * NOUVELLE adresse ; tant qu'il n'est pas suivi, la connexion se fait toujours
 * avec l'ancienne. L'écran le dit en toutes lettres : un message « enregistré »
 * laisserait croire le changement acquis, et quelqu'un se retrouverait dehors
 * en pensant avoir changé d'adresse.
 *
 * L'annuaire suit tout seul une fois la confirmation passée (migration 0043).
 */
export async function requestEmailChange(email: string): Promise<EmailResult> {
  const me = await requireUser();
  const next = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return { ok: false, error: "invalidEmail" };
  if (next === me.email.toLowerCase()) return { ok: false, error: "sameEmail" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email: next });
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  return { ok: true };
}
