"use server";

// ============================================================
// Saisie des livrables (brief §9.6).
//
// L'émetteur est un TEXTE libre : ni les consultants ni les entreprises ne sont
// utilisateurs de la plateforme (brief §3). Leurs livrables sont saisis par la
// PIU ou l'AT à réception.
//
// Le RETARD n'est jamais stocké : il est dérivé à la lecture. Une colonne
// `is_late` serait fausse dès le lendemain de son calcul.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";

export type DeliverableStatus =
  | "expected"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_with_comments"
  | "rejected";

export interface DeliverableInput {
  title: string;
  issuer: string | null;
  contractId: string | null;
  lotId: string | null;
  contractualDate: string | null;
  actualSubmissionDate: string | null;
  status: DeliverableStatus;
  comments: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function toRow(input: DeliverableInput) {
  return {
    title: input.title.trim(),
    issuer: input.issuer?.trim() || null,
    contract_id: input.contractId,
    lot_id: input.lotId,
    contractual_date: input.contractualDate,
    actual_submission_date: input.actualSubmissionDate,
    status: input.status,
    comments: input.comments?.trim() || null,
  };
}

function validate(input: DeliverableInput): string | null {
  if (!input.title.trim()) return "emptyTitle";
  // Contrainte de base : un livrable se rattache à un marché ou à un lot.
  if (!input.contractId && !input.lotId) return "noOrigin";
  // Aucune vérification sur l'ordre des dates : une remise ANTÉRIEURE à
  // l'échéance est normale, et une remise postérieure est précisément le retard
  // qu'on veut enregistrer.
  return null;
}

export async function createDeliverable(input: DeliverableInput): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_deliverable").insert(toRow(input));
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deliverables");
  return { ok: true };
}

export async function updateDeliverable(
  id: string,
  input: DeliverableInput,
): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_deliverable").update(toRow(input)).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deliverables");
  return { ok: true };
}

/**
 * Viser un livrable.
 *
 * Le visa est DÉCLARATIF (docs/SCHEMA.md §13) : ce n'est pas une signature, et
 * la plateforme ne prétend pas le contraire. Il enregistre qui a validé et
 * quand. `visa_by` et `visa_date` vont ensemble ou pas du tout — contrainte de
 * base, appliquée ici pour un message clair.
 */
export async function setDeliverableVisa(id: string, grant: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_deliverable")
    .update(
      grant
        ? { visa_by: user.id, visa_date: new Date().toISOString().slice(0, 10) }
        : { visa_by: null, visa_date: null },
    )
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deliverables");
  return { ok: true };
}

/** Enregistrer une remise : date du jour par défaut, statut avancé. */
export async function markSubmitted(id: string, isoDate: string | null): Promise<ActionResult> {
  const date = isoDate ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "invalidDate" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_deliverable")
    .update({ actual_submission_date: date, status: "submitted" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deliverables");
  return { ok: true };
}

export async function deleteDeliverable(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_deliverable").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/deliverables");
  return { ok: true };
}
