import "server-only";

// ============================================================
// lib/queries/nav.ts — les onglets que l'administrateur a masqués.
//
// Lu à CHAQUE rendu du cadre applicatif, donc sur tous les écrans : la
// requête est volontairement minuscule (une colonne, une poignée de lignes) et
// mémoïsée pour la durée du rendu, sinon le layout, le garde et la page la
// referaient chacun de leur côté.
// ============================================================

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Les routes masquées. L'ABSENCE DE LIGNE VAUT « VISIBLE » : un onglet ajouté
 * au code apparaît sans qu'il faille penser à l'autoriser.
 *
 * ⚠ UNE ERREUR DE LECTURE REND LE MENU ENTIER. Échouer dans l'autre sens
 * masquerait toute l'application sur un incident réseau — on perdrait l'accès
 * à l'écran qui permet de réparer. Et il n'y a rien à protéger ici : la RLS
 * garde les données, pas le menu (brief §8).
 */
export const listHiddenNav = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_nav_visibility")
    .select("href")
    .eq("is_hidden", true);

  if (error) return new Set();
  return new Set((data ?? []).map((r) => r.href as string));
});
