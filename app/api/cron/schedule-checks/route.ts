// ============================================================
// Évaluation périodique des ÉTATS : retards de tâches et de livrables.
//
// POURQUOI UNE ROUTE ET PAS UN TRIGGER. « Franchissement de jalon » et
// « retard » ne sont pas des événements : personne ne fait l'action de dépasser
// une échéance. Il faut donc une évaluation périodique. Le brief §4 proscrit
// les Edge Functions ; Vercel Cron appelle cette route (docs/GAPS.md 35).
//
// ⚠ C'EST LE SEUL ENDROIT DE L'APPLICATION QUI UTILISE LA CLÉ DE SERVICE.
// Un ordonnanceur n'a pas de session : sans elle, `auth.uid()` est nul et la
// RLS masquerait tout. La justification complète est dans lib/supabase/service.ts.
// Deux protections : le secret partagé ci-dessous, et le fait qu'aucune donnée
// n'est renvoyée — la réponse ne contient que des compteurs.
// ============================================================

import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/** Fenêtre d'anticipation : on prévient d'une échéance dans les 7 jours. */
const LOOKAHEAD_DAYS = 7;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }
  // Sans ce contrôle, n'importe qui déclencherait l'évaluation.
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "service_key_missing" }, { status: 503 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + LOOKAHEAD_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const created = { task_late: 0, deliverable_due: 0, deliverable_late: 0 };

  // ── Tâches en retard ────────────────────────────────────────────────────
  // Sans responsable, la notification n'irait nulle part : le fichier source
  // n'en contient aucun (GAPS 8), donc rien ne partira tant que la PIU n'aura
  // pas affecté les tâches. C'est voulu, et ce n'est pas une panne.
  const { data: lateTasks } = await supabase
    .from("mg2030_task")
    .select("id, wbs_code, activity, end_date, owner_id, progress_pct")
    .lt("end_date", today)
    .not("owner_id", "is", null)
    .is("archived_at", null);

  for (const task of lateTasks ?? []) {
    if (task.progress_pct === 100) continue;
    if (
      await notifyOnce(supabase, {
        userId: task.owner_id as string,
        kind: "task_late",
        title: `Task late: ${task.wbs_code}`,
        body: `${task.activity} — due ${task.end_date}`,
        entityTable: "mg2030_task",
        entityId: task.id as string,
      })
    ) {
      created.task_late++;
    }
  }

  // ── Livrables : échéance proche, puis dépassée ──────────────────────────
  const { data: deliverables } = await supabase
    .from("mg2030_deliverable")
    .select("id, title, contractual_date, visa_by")
    .in("status", ["expected", "submitted", "under_review"])
    .not("contractual_date", "is", null)
    .not("visa_by", "is", null)
    .lte("contractual_date", horizon)
    .is("archived_at", null);

  for (const deliverable of deliverables ?? []) {
    const due = deliverable.contractual_date as string;
    const late = due < today;
    if (
      await notifyOnce(supabase, {
        userId: deliverable.visa_by as string,
        kind: late ? "deliverable_late" : "deliverable_due",
        title: `${late ? "Deliverable late" : "Deliverable due"}: ${deliverable.title}`,
        body: `Contractual date ${due}`,
        entityTable: "mg2030_deliverable",
        entityId: deliverable.id as string,
      })
    ) {
      created[late ? "deliverable_late" : "deliverable_due"]++;
    }
  }

  // La réponse ne contient que des compteurs : aucune donnée projet ne sort
  // par cette route, même avec le secret.
  return NextResponse.json({ ok: true, evaluatedOn: today, created });
}

/**
 * Insère une notification si la même n'existe pas déjà.
 *
 * Une échéance dépassée le reste tous les jours suivants. Sans ce contrôle,
 * chaque passage du cron rejouterait la même ligne, et la boîte deviendrait
 * inutilisable en une semaine — donc ignorée, donc inutile.
 */
async function notifyOnce(
  supabase: ReturnType<typeof createServiceClient>,
  n: {
    userId: string;
    kind: string;
    title: string;
    body: string;
    entityTable: string;
    entityId: string;
  },
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("mg2030_notification")
    .select("id")
    .eq("user_id", n.userId)
    .eq("kind", n.kind)
    .eq("entity_table", n.entityTable)
    .eq("entity_id", n.entityId)
    .maybeSingle();

  if (existing) return false;

  const { error } = await supabase.from("mg2030_notification").insert({
    user_id: n.userId,
    kind: n.kind,
    title: n.title,
    body: n.body,
    entity_table: n.entityTable,
    entity_id: n.entityId,
  });

  return !error;
}
