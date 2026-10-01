"use server";

// ============================================================
// Glossaire du projet.
//
// La RLS laisse écrire tout ÉDITEUR, pas seulement l'administration : un
// glossaire que seul l'administrateur peut compléter ne se complète pas, et
// une ligne de glossaire n'ouvre aucun accès. Les actions ci-dessous vérifient
// le nombre de lignes touchées — un refus de la RLS ne lève pas d'erreur, il
// ne rend rien.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type AcronymResult =
  | { ok: true }
  | { ok: false; error: "emptyField" | "duplicateCode" | "forbidden" | "writeFailed" };

export async function createAcronym(code: string, meaning: string): Promise<AcronymResult> {
  const cleanCode = code.trim();
  const cleanMeaning = meaning.trim();
  if (cleanCode === "" || cleanMeaning === "") return { ok: false, error: "emptyField" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_acronym")
    .insert({ code: cleanCode, meaning: cleanMeaning });

  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicateCode" : "writeFailed" };
  }

  revalidatePath("/acronyms");
  return { ok: true };
}

/**
 * Modifie un sigle ou sa définition.
 *
 * ⚠ LE SIGLE LUI-MÊME EST MODIFIABLE, contrairement aux codes d'étiquette ou
 * d'organisation. Rien ne s'y rattache — c'est une ligne de glossaire, pas une
 * clé — et c'est précisément ce qui vient d'arriver : MYS est devenu MSY. Un
 * glossaire qu'on ne peut pas corriger quand un nom change ne sert plus à rien.
 */
export async function updateAcronym(
  id: string,
  code: string,
  meaning: string,
): Promise<AcronymResult> {
  const cleanCode = code.trim();
  const cleanMeaning = meaning.trim();
  if (cleanCode === "" || cleanMeaning === "") return { ok: false, error: "emptyField" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_acronym")
    .update({ code: cleanCode, meaning: cleanMeaning }, { count: "exact" })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicateCode" : "writeFailed" };
  }
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/acronyms");
  return { ok: true };
}

export async function deleteAcronym(id: string): Promise<AcronymResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_acronym")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { ok: false, error: "writeFailed" };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/acronyms");
  return { ok: true };
}
