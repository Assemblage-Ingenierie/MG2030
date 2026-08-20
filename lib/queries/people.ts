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
}

export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_app_user")
    .select("id, full_name, mg2030_functional_role!inner ( code )")
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(`Lecture de l'annuaire : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      full_name: string;
      mg2030_functional_role: { code: string };
    };
    return { id: r.id, fullName: r.full_name, roleCode: r.mg2030_functional_role.code };
  });
}
