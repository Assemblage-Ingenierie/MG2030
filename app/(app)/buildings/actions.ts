"use server";

// ============================================================
// Création et édition des bâtiments (brief §9.2).
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BuildingInput {
  buildingCode: string;
  siteId: string;
  name: string;
  zone: "residential" | "services_and_sports" | null;
  typology: string | null;
  interventionType: "renovation" | "demolition" | "extension" | "new_construction";
  netAreaSqm: number | null;
  grossAreaSqm: number | null;
  unitCostEurSqm: number | null;
  worksEstimateEur: number | null;
  yearOfConstruction: number | null;
  constructionType: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function toRow(input: BuildingInput) {
  return {
    building_code: input.buildingCode.trim(),
    site_id: input.siteId,
    name: input.name.trim(),
    zone: input.zone,
    typology: input.typology?.trim() || null,
    intervention_type: input.interventionType,
    net_area_sqm: input.netAreaSqm,
    gross_area_sqm: input.grossAreaSqm,
    unit_cost_eur_sqm: input.unitCostEurSqm,
    works_estimate_eur: input.worksEstimateEur,
    year_of_construction: input.yearOfConstruction,
    construction_type: input.constructionType?.trim() || null,
  };
}

export async function updateBuilding(id: string, input: BuildingInput): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_building").update(toRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/buildings");
  return { ok: true };
}

export async function createBuilding(input: BuildingInput): Promise<ActionResult> {
  if (!input.buildingCode.trim() || !input.name.trim() || !input.siteId) {
    return { ok: false, error: "missingFields" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_building").insert(toRow(input));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/buildings");
  return { ok: true };
}
