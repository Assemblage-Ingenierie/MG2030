import "server-only";

import { createClient } from "@/lib/supabase/server";
import { daysBetween } from "@/lib/schedule/dates";

// ============================================================
// lib/queries/procurement.ts — avis de non-objection AFD.
//
// Le NoN est le point de passage obligé de la passation : sans avis, rien ne
// se signe. C'est aussi le principal générateur de retard, et le planning le
// sait — il porte des tâches dédiées (« AFD's NoN », TV.2.3, SC.2.4).
//
// D'où le parti pris de cette lecture : le RETARD D'UN AVIS SE MESURE CONTRE
// LA DURÉE PRÉVUE AU PLAN pour la tâche qu'il porte, jamais contre un délai
// standard inventé. Un avis sans tâche liée n'a donc pas de verdict — on
// affiche le temps écoulé et on s'arrête là. Annoncer « en retard » sans
// référence serait une opinion déguisée en fait.
//
// RLS SEULE AUTORITÉ (brief §8) : aucun re-filtrage ici.
// ============================================================

export type NoObjectionStatus =
  | "draft"
  | "sent"
  | "no_objection"
  | "no_objection_with_comments"
  | "rejected"
  | "cancelled";

export interface NoObjectionRow {
  id: string;
  reference: string | null;
  subject: string;
  status: NoObjectionStatus;
  contractId: string | null;
  contractCode: string | null;
  lotId: string | null;
  lotCode: string | null;
  taskId: string | null;
  taskWbs: string | null;
  /** Durée prévue au plan pour la tâche portée : la seule référence légitime. */
  allowedDays: number | null;
  sentDate: string | null;
  responseDate: string | null;
  comments: string | null;
  requestedByName: string | null;
  /**
   * Jours d'attente EN COURS. Nul dès que l'avis est rendu : à ce moment la
   * grandeur qui compte est le délai constaté, et afficher les deux donnerait
   * deux fois le même nombre sur une ligne.
   */
  elapsedDays: number | null;
  /**
   * Jours au-delà de la durée prévue. Nul si l'avis n'est pas en instance ou
   * si aucune tâche ne fournit de référence.
   */
  overdueDays: number | null;
  /** Jours qu'a réellement pris l'AFD, une fois l'avis rendu. */
  turnaroundDays: number | null;
}

const PENDING: NoObjectionStatus[] = ["draft", "sent"];

export function isPending(status: NoObjectionStatus): boolean {
  return PENDING.includes(status);
}

export async function listNoObjections(): Promise<NoObjectionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_no_objection")
    .select(
      `id, reference, subject, status, sent_date, response_date, comments,
       contract_id, lot_id, task_id,
       mg2030_contract ( contract_code ),
       mg2030_lot ( lot_code ),
       mg2030_task ( wbs_code, duration_days ),
       requester:mg2030_app_user!mg2030_no_objection_requested_by_fkey ( full_name )`,
    )
    .order("sent_date", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Lecture des avis de non-objection : ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);

  // Le client type les relations imbriquées en TABLEAUX quand il ne peut pas
  // inférer la cardinalité. Le passage par `unknown` est le même que dans
  // lib/queries/schedule.ts — on ne le répète pas ailleurs.
  const raw = (data ?? []) as unknown as Record<string, unknown>[];

  return raw.map((r) => {
    const task = r.mg2030_task as { wbs_code: string; duration_days: number | null } | null;
    const sentDate = (r.sent_date as string) ?? null;
    const responseDate = (r.response_date as string) ?? null;
    const status = r.status as NoObjectionStatus;
    const allowedDays = task?.duration_days ?? null;

    const elapsedDays = sentDate && responseDate === null ? daysBetween(sentDate, today) : null;
    const turnaroundDays = sentDate && responseDate ? daysBetween(sentDate, responseDate) : null;

    // Retard : seulement pour un avis EN INSTANCE et doté d'une référence.
    const overdueDays =
      status === "sent" && responseDate === null && allowedDays !== null && elapsedDays !== null
        ? Math.max(0, elapsedDays - allowedDays)
        : null;

    return {
      id: r.id as string,
      reference: (r.reference as string) ?? null,
      subject: r.subject as string,
      status,
      contractId: (r.contract_id as string) ?? null,
      contractCode: (r.mg2030_contract as { contract_code: string } | null)?.contract_code ?? null,
      lotId: (r.lot_id as string) ?? null,
      lotCode: (r.mg2030_lot as { lot_code: string } | null)?.lot_code ?? null,
      taskId: (r.task_id as string) ?? null,
      taskWbs: task?.wbs_code ?? null,
      allowedDays,
      sentDate,
      responseDate,
      comments: (r.comments as string) ?? null,
      requestedByName: (r.requester as { full_name: string } | null)?.full_name ?? null,
      elapsedDays,
      overdueDays,
      turnaroundDays,
    };
  });
}

export interface NoObjectionTaskOption {
  id: string;
  wbsCode: string;
  activity: string;
  durationDays: number | null;
}

/**
 * Tâches candidates : celles que le planning identifie comme des avis AFD.
 *
 * On ne propose pas les 27 tâches. Lier un avis à « Detail Design studies »
 * n'aurait aucun sens, et la liste ferait perdre plus de temps qu'elle n'en
 * fait gagner. Le filtre porte sur le libellé, seule marque disponible : le
 * planning source écrit « AFD's NoN » / « AFD's NoNs ».
 */
export async function listNoObjectionTaskOptions(
  scenarioCode: string,
): Promise<NoObjectionTaskOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_task")
    .select(
      "id, wbs_code, activity, duration_days, mg2030_schedule_scenario!inner ( code )",
    )
    .eq("mg2030_schedule_scenario.code", scenarioCode)
    .is("archived_at", null)
    .ilike("activity", "%NoN%")
    .order("wbs_code");

  if (error) throw new Error(`Lecture des taches d'avis : ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    wbsCode: r.wbs_code as string,
    activity: r.activity as string,
    durationDays: (r.duration_days as number) ?? null,
  }));
}
