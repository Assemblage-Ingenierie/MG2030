import "server-only";

// ============================================================
// lib/queries/deliverables.ts — suivi des livrables et des retards.
//
// « Détection automatique des manquants et des retards » (brief §7).
// Le retard est DÉRIVÉ, jamais stocké : une colonne `is_late` en base serait
// fausse dès le lendemain de son calcul, et il faudrait un travail périodique
// pour la tenir à jour. Ici, la comparaison se fait à la lecture.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { daysBetween } from "@/lib/schedule/dates";

export type DeliverableStatus =
  | "expected"
  | "submitted"
  | "under_review"
  | "approved"
  | "approved_with_comments"
  | "rejected";

export interface DeliverableRow {
  id: string;
  title: string;
  issuer: string | null;
  contractCode: string | null;
  lotCode: string | null;
  contractualDate: string | null;
  actualSubmissionDate: string | null;
  status: DeliverableStatus;
  visaByName: string | null;
  visaDate: string | null;
  comments: string | null;

  // ── Dérivés ──────────────────────────────────────────────────────────────
  /** Attendu, échéance passée, non remis. */
  isLate: boolean;
  /** Remis, mais après l'échéance. Le retard reste visible après coup. */
  wasLate: boolean;
  /** Jours jusqu'à l'échéance ; négatif si dépassée. `null` si sans objet. */
  daysToDue: number | null;
}

export async function listDeliverables(options: {
  contractCode?: string;
  onlyOpen?: boolean;
} = {}): Promise<DeliverableRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("mg2030_deliverable")
    .select(
      `id, title, issuer, contractual_date, actual_submission_date, status,
       visa_date, comments,
       mg2030_contract ( contract_code ),
       mg2030_lot ( lot_code ),
       visa:mg2030_app_user!mg2030_deliverable_visa_by_fkey ( full_name )`,
    )
    .is("archived_at", null)
    .order("contractual_date", { nullsFirst: false });

  if (options.contractCode) {
    query = query.eq("mg2030_contract.contract_code", options.contractCode);
  }
  if (options.onlyOpen) {
    query = query.in("status", ["expected", "submitted", "under_review"]);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des livrables : ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_contract: { contract_code: string } | null;
      mg2030_lot: { lot_code: string } | null;
      visa: { full_name: string } | null;
    };

    const due = (r.contractual_date as string) ?? null;
    const submitted = (r.actual_submission_date as string) ?? null;

    return {
      id: r.id as string,
      title: r.title as string,
      issuer: (r.issuer as string) ?? null,
      contractCode: r.mg2030_contract?.contract_code ?? null,
      lotCode: r.mg2030_lot?.lot_code ?? null,
      contractualDate: due,
      actualSubmissionDate: submitted,
      status: r.status as DeliverableStatus,
      visaByName: r.visa?.full_name ?? null,
      visaDate: (r.visa_date as string) ?? null,
      comments: (r.comments as string) ?? null,

      isLate: submitted === null && due !== null && due < today,
      wasLate: submitted !== null && due !== null && submitted > due,
      daysToDue: due === null || submitted !== null ? null : daysBetween(today, due),
    };
  });
}

export interface ContractHealth {
  contractCode: string;
  contractName: string;
  deliverablesLate: number;
  deliverablesOpen: number;
  noObjectionsPending: number;
  nextDue: string | null;
}

/** Santé par marché : ce qui est en retard, ce qui vient. */
export async function contractHealth(): Promise<ContractHealth[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: contracts }, deliverables, { data: nons }] = await Promise.all([
    supabase
      .from("mg2030_contract")
      .select("contract_code, name")
      .is("archived_at", null)
      .order("contract_code"),
    listDeliverables(),
    supabase
      .from("mg2030_no_objection")
      .select("status, mg2030_contract ( contract_code )")
      .eq("status", "sent"),
  ]);

  const pendingByContract = new Map<string, number>();
  for (const row of (nons ?? []) as unknown as {
    mg2030_contract: { contract_code: string } | null;
  }[]) {
    const code = row.mg2030_contract?.contract_code;
    if (code) pendingByContract.set(code, (pendingByContract.get(code) ?? 0) + 1);
  }

  return (contracts ?? []).map((c) => {
    const mine = deliverables.filter((d) => d.contractCode === c.contract_code);
    const open = mine.filter((d) =>
      ["expected", "submitted", "under_review"].includes(d.status),
    );
    const upcoming = open
      .map((d) => d.contractualDate)
      .filter((d): d is string => Boolean(d) && d! >= today)
      .sort();

    return {
      contractCode: c.contract_code as string,
      contractName: c.name as string,
      deliverablesLate: mine.filter((d) => d.isLate).length,
      deliverablesOpen: open.length,
      noObjectionsPending: pendingByContract.get(c.contract_code as string) ?? 0,
      nextDue: upcoming[0] ?? null,
    };
  });
}
