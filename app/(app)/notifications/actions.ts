"use server";

// ============================================================
// Marquage des notifications comme lues.
//
// Seul geste possible : la RLS n'accorde au destinataire que SELECT et UPDATE
// sur ses propres lignes. Il n'existe aucune politique d'INSERT cote client —
// les notifications sont ecrites par l'evaluation periodique et par triggers.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_notification")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_notification")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/notifications");
  return { ok: true };
}
