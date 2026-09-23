import "server-only";

// ============================================================
// lib/queries/people.ts — annuaire des personnes affectables.
//
// Sert aux sélecteurs de responsable et de valideur. Ne remonte que les comptes
// ACTIFS : proposer un compte non validé donnerait une affectation qui ne
// recevrait aucune notification.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export interface Person {
  id: string;
  fullName: string;
  roleCode: string;
  /** Code de l'organisation : la grille en dérive la couleur de barre à l'affectation. */
  orgCode: string | null;
}

export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_app_user")
    .select("id, full_name, mg2030_functional_role!inner ( code ), mg2030_organisation ( code )")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(`Lecture de l'annuaire : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      full_name: string;
      mg2030_functional_role: { code: string };
      mg2030_organisation: { code: string } | null;
    };
    return {
      id: r.id,
      fullName: r.full_name,
      roleCode: r.mg2030_functional_role.code,
      orgCode: r.mg2030_organisation?.code ?? null,
    };
  });
}
