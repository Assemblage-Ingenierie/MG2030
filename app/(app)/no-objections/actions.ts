"use server";

// ============================================================
// app/(app)/no-objections/actions.ts — écriture des avis AFD.
//
// Le cycle de vie est contraint EN BASE, pas ici : la contrainte
// `mg2030_no_objection_answer_coherent` impose qu'une réponse et sa date
// aillent ensemble. On s'appuie dessus au lieu de la redoubler — une règle
// écrite deux fois finit par diverger.
//
// RLS SEULE AUTORITÉ : aucune vérification de rôle dans ce fichier. Un compte
// sans `no_objection.write` reçoit une erreur de la base, pas d'ici.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface NoObjectionInput {
  reference: string | null;
  subject: string;
  contractId: string | null;
  lotId: string | null;
  taskId: string | null;
  sentDate: string | null;
  comments: string | null;
}

export type NoObjectionWrite =
  | { ok: true }
  | { ok: false; error: string; detail?: string };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function validate(input: NoObjectionInput): string | null {
  if (input.subject.trim() === "") return "emptySubject";
  // La contrainte `has_target` refuserait la ligne ; on le dit en clair avant
  // l'aller-retour plutôt que de laisser remonter un message Postgres.
  if (!input.contractId && !input.lotId && !input.taskId) return "noTarget";
  if (input.sentDate !== null && !ISO.test(input.sentDate)) return "invalidDate";
  return null;
}

function row(input: NoObjectionInput) {
  return {
    reference: input.reference?.trim() || null,
    subject: input.subject.trim(),
    contract_id: input.contractId,
    lot_id: input.lotId,
    task_id: input.taskId,
    sent_date: input.sentDate,
    comments: input.comments?.trim() || null,
  };
}

export async function createNoObjection(input: NoObjectionInput): Promise<NoObjectionWrite> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "unauthenticated" };

  // Le demandeur est l'auteur de la saisie : c'est lui que la PIU relancera.
  const { data: me } = await supabase
    .from("mg2030_app_user")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  const { error } = await supabase.from("mg2030_no_objection").insert({
    ...row(input),
    // Une date d'envoi saisie d'emblée signifie que l'avis est PARTI : le
    // laisser en brouillon le rendrait invisible dans le décompte des
    // instances, qui est précisément ce que la PIU surveille.
    status: input.sentDate ? "sent" : "draft",
    requested_by: me?.id ?? null,
  });
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  return { ok: true };
}

export async function updateNoObjection(
  id: string,
  input: NoObjectionInput,
): Promise<NoObjectionWrite> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_no_objection").update(row(input)).eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  return { ok: true };
}

/** Marque l'avis comme parti. Sans date, aucun délai ne peut être compté. */
export async function markSent(id: string, date: string | null): Promise<NoObjectionWrite> {
  const sent = date ?? new Date().toISOString().slice(0, 10);
  if (!ISO.test(sent)) return { ok: false, error: "invalidDate" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_no_objection")
    .update({ status: "sent", sent_date: sent })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  return { ok: true };
}

/**
 * Enregistre la réponse de l'AFD.
 *
 * Statut et date sont écrits ENSEMBLE : la contrainte de base les exige
 * indissociables, et c'est la bonne règle — un avis « rendu » sans date de
 * réponse rendrait tout calcul de délai faux.
 */
export async function recordAnswer(
  id: string,
  outcome: "no_objection" | "no_objection_with_comments" | "rejected",
  date: string | null,
): Promise<NoObjectionWrite> {
  const answered = date ?? new Date().toISOString().slice(0, 10);
  if (!ISO.test(answered)) return { ok: false, error: "invalidDate" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_no_objection")
    .update({ status: outcome, response_date: answered })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  revalidatePath("/deliverables");
  return { ok: true };
}

/**
 * Annule un avis. On n'efface pas : une demande retirée est un fait de
 * gestion, et l'AFD en a gardé la trace de son côté.
 */
export async function cancelNoObjection(id: string): Promise<NoObjectionWrite> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_no_objection")
    .update({ status: "cancelled", response_date: null })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  return { ok: true };
}

/** Suppression réservée aux saisies erronées ; l'annulation est la règle. */
export async function deleteNoObjection(id: string): Promise<NoObjectionWrite> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_no_objection").delete().eq("id", id);
  if (error) return { ok: false, error: "writeFailed", detail: error.message };

  revalidatePath("/no-objections");
  return { ok: true };
}
