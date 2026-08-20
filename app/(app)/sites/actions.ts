"use server";

// ============================================================
// Création et édition des sites (brief §9.2).
//
// La RLS reste l'autorité : ces actions n'ajoutent aucun contrôle d'accès. Si
// l'appelant n'a pas `site.write` ou que le site est hors de son périmètre,
// la base refuse et rien n'est écrit — l'erreur PostgREST remonte telle quelle.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SiteInput {
  siteCode: string;
  subproject: "athletes_village" | "training_venues";
  name: string;
  beneficiaryInstitution: string | null;
  siteType: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  grossAreaSqm: number | null;
  yearOfConstruction: number | null;
  occupancyStatus: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function toRow(input: SiteInput) {
  return {
    site_code: input.siteCode.trim(),
    subproject: input.subproject,
    name: input.name.trim(),
    beneficiary_institution: input.beneficiaryInstitution?.trim() || null,
    site_type: input.siteType?.trim() || null,
    address: input.address?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    gross_area_sqm: input.grossAreaSqm,
    year_of_construction: input.yearOfConstruction,
    occupancy_status: input.occupancyStatus?.trim() || null,
  };
}

export async function updateSite(id: string, input: SiteInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "emptyName" };
  // Latitude et longitude vont ensemble ou pas du tout (contrainte de base) :
  // on le vérifie ici pour un message clair plutôt que l'erreur SQL brute.
  if ((input.latitude === null) !== (input.longitude === null)) {
    return { ok: false, error: "latLonTogether" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_site").update(toRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sites");
  return { ok: true };
}

export async function createSite(input: SiteInput): Promise<ActionResult> {
  if (!input.siteCode.trim() || !input.name.trim()) {
    return { ok: false, error: "missingFields" };
  }
  if ((input.latitude === null) !== (input.longitude === null)) {
    return { ok: false, error: "latLonTogether" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_site").insert(toRow(input));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/sites");
  return { ok: true };
}
