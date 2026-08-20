import "server-only";

// ============================================================
// lib/queries/notifications.ts
//
// La RLS restreint déjà chaque lecture au destinataire (`user_id = auth.uid()`) :
// ce module ne refiltre pas.
// ============================================================

import { createClient } from "@/lib/supabase/server";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entityTable: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(limit = 100): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_notification")
    .select("id, kind, title, body, entity_table, entity_id, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Lecture des notifications : ${error.message}`);

  return (data ?? []).map((r) => ({
    id: r.id as string,
    kind: r.kind as string,
    title: r.title as string,
    body: (r.body as string) ?? null,
    entityTable: (r.entity_table as string) ?? null,
    entityId: (r.entity_id as string) ?? null,
    readAt: (r.read_at as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Compte les non lues. Sert au badge de la cloche. */
export async function countUnread(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("mg2030_notification")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}
