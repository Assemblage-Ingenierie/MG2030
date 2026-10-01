import "server-only";
import { cache } from "react";

// ============================================================
// lib/queries/acronyms.ts — le glossaire du projet.
//
// Lu par l'onglet Acronyms et, par le layout, par TOUS les écrans : les sigles
// se développent au survol où qu'ils apparaissent (voir `components/acronyms/
// glossary.tsx`). D'où le `cache()` de React — une seule requête par rendu,
// même si plusieurs morceaux de la page le demandent.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import type { Acronym } from "@/lib/acronyms/match";

export interface AcronymRecord extends Acronym {
  id: string;
}

export const listAcronyms = cache(async (): Promise<AcronymRecord[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_acronym")
    .select("id, code, meaning")
    .order("code");

  // ⚠ UN GLOSSAIRE ILLISIBLE NE DOIT PAS ABATTRE LA PAGE. Il est chargé dans
  // le layout, donc sur chaque écran : une erreur de lecture — un compte en
  // attente, à qui la RLS refuse tout — ferait échouer l'application entière
  // au lieu de la rendre sans infobulles. L'onglet Acronyms, lui, signale
  // l'erreur : c'est son sujet.
  if (error) return [];

  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    meaning: r.meaning as string,
  }));
});
