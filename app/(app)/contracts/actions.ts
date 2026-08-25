"use server";

// ============================================================
// Création et édition des marchés et des lots (brief §9.2).
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// ── Marchés ─────────────────────────────────────────────────────────────────

export interface ContractInput {
  contractCode: string;
  contractNumber: string;
  name: string;
  contractType: "C" | "W" | "G" | "NC" | "DB";
  competitionType: "NPC" | "IPC" | null;
  procedure: "REOI" | "IB" | "PQL+IB" | "RQ" | "DC";
  selectionMethod:
    | "QCBS"
    | "QBS"
    | "FBS"
    | "LCS"
    | "lowest_evaluated_compliant_bid"
    | null;
  afdReview: "prior" | "post";
  scenarioId: string;
  estimatedAmountEur: number | null;
  contractor: string | null;
  spnPublicationDate: string | null;
  bidOpeningDate: string | null;
  signatureDate: string | null;
  completionDate: string | null;
}

/** Format imposé au brief §7 : MYS/MG2030/{C|W|G|NC|DB}/{année}/XX. */
const NUMBER_FORMAT = /^MYS\/MG2030\/(C|W|G|NC|DB)\/[0-9]{4}\/([0-9]{2}|XX)$/;

function toContractRow(input: ContractInput) {
  return {
    contract_code: input.contractCode.trim(),
    contract_number: input.contractNumber.trim(),
    name: input.name.trim(),
    contract_type: input.contractType,
    competition_type: input.competitionType,
    procedure: input.procedure,
    selection_method: input.selectionMethod,
    afd_review: input.afdReview,
    scenario_id: input.scenarioId,
    estimated_amount_eur: input.estimatedAmountEur,
    contractor: input.contractor?.trim() || null,
    spn_publication_date: input.spnPublicationDate,
    bid_opening_date: input.bidOpeningDate,
    signature_date: input.signatureDate,
    completion_date: input.completionDate,
  };
}

function validateContract(input: ContractInput): string | null {
  if (!input.name.trim()) return "emptyName";
  if (!NUMBER_FORMAT.test(input.contractNumber.trim())) return "invalidNumberFormat";
  return null;
}

export async function updateContract(id: string, input: ContractInput): Promise<ActionResult> {
  const validationError = validateContract(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_contract")
    .update(toContractRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contracts");
  return { ok: true };
}

export async function createContract(input: ContractInput): Promise<ActionResult> {
  if (!input.contractCode.trim()) return { ok: false, error: "missingFields" };
  const validationError = validateContract(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_contract").insert(toContractRow(input));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contracts");
  return { ok: true };
}

// ── Lots ────────────────────────────────────────────────────────────────────

export interface LotInput {
  lotCode: string;
  contractId: string;
  lotNumber: number;
  name: string;
  amountEurMin: number | null;
  amountEurMax: number | null;
  minTurnoverEurMin: number | null;
  minTurnoverEurMax: number | null;
  contractor: string | null;
}

function toLotRow(input: LotInput) {
  return {
    lot_code: input.lotCode.trim(),
    contract_id: input.contractId,
    lot_number: input.lotNumber,
    name: input.name.trim(),
    amount_eur_min: input.amountEurMin,
    amount_eur_max: input.amountEurMax,
    min_turnover_eur_min: input.minTurnoverEurMin,
    min_turnover_eur_max: input.minTurnoverEurMax,
    contractor: input.contractor?.trim() || null,
  };
}

function validateLot(input: LotInput): string | null {
  if (!input.name.trim()) return "emptyName";
  // Contrainte de base : min <= max. Vérifiée ici pour un message clair.
  if (
    input.amountEurMin !== null &&
    input.amountEurMax !== null &&
    input.amountEurMin > input.amountEurMax
  ) {
    return "minAboveMax";
  }
  return null;
}

export async function updateLot(id: string, input: LotInput): Promise<ActionResult> {
  const validationError = validateLot(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_lot").update(toLotRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contracts");
  return { ok: true };
}

export async function createLot(input: LotInput): Promise<ActionResult> {
  if (!input.lotCode.trim() || !input.contractId) return { ok: false, error: "missingFields" };
  const validationError = validateLot(input);
  if (validationError) return { ok: false, error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_lot").insert(toLotRow(input));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/contracts");
  return { ok: true };
}

// ── Composition des lots ────────────────────────────────────────────────────

/**
 * Remplace la composition d'un lot.
 *
 * Remplacement complet plutôt que différentiel : la clé primaire est
 * (lot_id, building_id), donc supprimer puis réinsérer est exact et tient en
 * deux requêtes. Un différentiel demanderait de lire l'état courant d'abord,
 * pour un gain nul à ce volume (36 bâtiments).
 *
 * ⚠ ON NE VÉRIFIE PAS qu'un bâtiment n'est pris qu'une fois : un même bâtiment
 * appartient légitimement à un lot de TRAVAUX et à un lot d'ÉQUIPEMENT, qui
 * sont deux marchés distincts. Ce qui serait une faute, c'est deux lots du
 * MÊME marché — l'écran le signale, sans l'interdire : c'est un arbitrage
 * d'allotissement, pas une règle technique, et la PIU peut avoir une raison
 * que nous ignorons.
 *
 * La RLS reste l'autorité : `contract.write` et la visibilité du lot.
 */
export async function setLotBuildings(
  lotId: string,
  buildingIds: string[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("mg2030_lot_building")
    .delete()
    .eq("lot_id", lotId);
  if (deleteError) return { ok: false, error: deleteError.message };

  if (buildingIds.length > 0) {
    const { error } = await supabase.from("mg2030_lot_building").insert(
      buildingIds.map((buildingId) => ({
        lot_id: lotId,
        building_id: buildingId,
        source: "affectation manuelle",
      })),
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/contracts");
  revalidatePath("/buildings");
  return { ok: true };
}
