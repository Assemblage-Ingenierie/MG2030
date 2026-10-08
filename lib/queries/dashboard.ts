import "server-only";

// ============================================================
// lib/queries/dashboard.ts — ce qu'on vient voir en ouvrant la plateforme.
//
// ⚠ UN TABLEAU DE BORD RÉPOND À DES QUESTIONS, IL N'AFFICHE PAS DES TOTAUX.
//
// L'accueil alignait huit compteurs — 14 sites, 36 bâtiments, 9 marchés. Ces
// nombres ne bougent pas d'un mois sur l'autre : on les lisait une fois, puis
// on passait devant sans les voir. Refondu le 01/10/2026 autour des trois
// questions qu'on se pose vraiment en arrivant :
//
//   1. COMBIEN DE TEMPS RESTE-T-IL ? L'échéance des Jeux et, avant elle, le
//      début de la marge terminale — la vraie date à laquelle il faut avoir
//      fini.
//   2. QU'EST-CE QUI SE PASSE MAINTENANT ? Les tâches en retard, celles en
//      cours, celles qui démarrent dans le mois. Nommées, pas comptées.
//   3. QU'EST-CE QUI CLOCHE ? Les manques qu'on peut corriger — une tâche sans
//      responsable ne recevra jamais d'alerte, un livrable en retard n'est pas
//      une statistique.
//
// Les totaux du référentiel restent, en bas, en une ligne : ils situent la
// taille du programme, ce qui n'est pas rien, mais ils ne sont pas l'actualité.
//
// RLS SEULE AUTORITÉ : un compte à périmètre restreint verra moins de lignes,
// sans qu'aucun filtre soit écrit ici.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { daysBetween } from "@/lib/schedule/dates";
import { localToday } from "@/lib/schedule/dates";

/** Fenêtre de « ce qui arrive » : un mois devant, quinze jours derrière. */
const AHEAD_DAYS = 30;
const BEHIND_DAYS = 15;
/** Au-delà, la liste cesse d'être lisible et devient un deuxième planning. */
const MAX_ROWS = 6;

export type TaskPhase = "late" | "running" | "soon" | "done";

export interface DashboardTask {
  id: string;
  wbsCode: string;
  activity: string;
  start: string | null;
  end: string | null;
  progressPct: number | null;
  ownerName: string | null;
  contractCode: string | null;
  phase: TaskPhase;
}

export interface DashboardAction {
  id: string;
  title: string;
  status: string | null;
  priority: string | null;
  start: string | null;
  assignees: string[];
}

export interface Gap {
  /** Suffixe de clé i18n : `home.gap_<key>`. */
  key: string;
  count: number;
  href: string;
}

export interface Dashboard {
  today: string;
  deadlineDate: string | null;
  bufferStartDate: string | null;
  bufferMonths: number | null;
  daysToDeadline: number | null;
  daysToBuffer: number | null;

  /** Avancement du plan : tâches terminées sur tâches réelles. */
  tasksTotal: number;
  tasksDone: number;
  tasksRunning: number;
  tasksLate: number;

  /** Ce qui bouge dans la fenêtre. Déjà trié, déjà tronqué. */
  focus: DashboardTask[];
  focusMore: number;

  /** La roadmap à court terme. */
  actions: DashboardAction[];
  actionsMore: number;

  gaps: Gap[];

  referential: {
    sites: number;
    buildings: number;
    contracts: number;
    lots: number;
    documents: number;
    acronyms: number;
  };
}

export async function loadDashboard(): Promise<Dashboard> {
  const supabase = await createClient();
  const today = localToday();
  const HEAD = { count: "exact" as const, head: true };

  // Scénario de référence : l'actif qui porte un cadre calendaire, à défaut le
  // premier qui en porte un. MÊME RÈGLE que le plan de charge, pour que les
  // deux écrans parlent du même planning.
  const { data: scenarioRows } = await supabase
    .from("mg2030_schedule_scenario")
    .select("id, is_active, buffer_start_date, buffer_months, deadline_date")
    .order("code");

  const scenarios = (scenarioRows ?? []) as unknown as Record<string, unknown>[];
  const scenario =
    scenarios.find((s) => s.is_active === true && s.buffer_start_date !== null) ??
    scenarios.find((s) => s.buffer_start_date !== null) ??
    scenarios[0] ??
    null;
  const scenarioId = (scenario?.id as string) ?? NO_ID;

  const [taskRows, actionRows, sites, buildings, contracts, lots, documents, acronyms, lateDeliverables, pendingNon] =
    await Promise.all([
      /* LES TÂCHES RÉELLES DU SCÉNARIO, en entier. Soixante-trois lignes :
         les compter en base aurait demandé cinq requêtes `head` là où une
         seule lecture permet de tout dériver — et il faut de toute façon les
         libellés pour la liste. */
      supabase
        .from("mg2030_task")
        /* ⚠ LA CLÉ ÉTRANGÈRE EST NOMMÉE. `mg2030_task` pointe DEUX FOIS vers
           `mg2030_app_user` — `owner_id` et `validator_id` : une jointure
           implicite est ambiguë, PostgREST la refuse, et le tableau de bord
           affichait « 0 tâche sur 0 » sans un mot d'erreur. */
        .select(
          `id, wbs_code, activity, start_date, end_date, progress_pct,
           owner:mg2030_app_user!mg2030_task_owner_id_fkey ( full_name ),
           contract:mg2030_contract ( contract_code )`,
        )
        .is("archived_at", null)
        .eq("scenario_id", scenarioId)
        .eq("task_type", "task")
        .order("start_date", { ascending: true, nullsFirst: false }),

      supabase
        .from("mg2030_roadmap_action")
        .select("id, title, status, priority, timeline_start, assignees:mg2030_roadmap_assignee ( label )")
        .is("archived_at", null)
        .not("timeline_start", "is", null)
        .order("timeline_start"),

      supabase.from("mg2030_site").select("*", HEAD).is("archived_at", null),
      supabase.from("mg2030_building").select("*", HEAD).is("archived_at", null),
      supabase.from("mg2030_contract").select("*", HEAD).is("archived_at", null),
      supabase.from("mg2030_lot").select("*", HEAD).is("archived_at", null),
      supabase.from("mg2030_document").select("*", HEAD).is("archived_at", null),
      supabase.from("mg2030_acronym").select("*", HEAD),

      // En retard : échéance passée et rien de remis. MÊME DÉFINITION que
      // l'écran des livrables — deux définitions divergeraient tôt ou tard.
      supabase
        .from("mg2030_deliverable")
        .select("*", HEAD)
        .is("actual_submission_date", null)
        .not("contractual_date", "is", null)
        .lt("contractual_date", today),

      // En attente d'une réponse : envoyées seulement, pas les brouillons
      // (même règle que isPending, lib/queries/procurement.ts).
      supabase.from("mg2030_no_objection").select("*", HEAD).eq("status", "sent"),
    ]);

  // ── Les tâches ────────────────────────────────────────────────────────
  // On LAISSE REMONTER l'erreur plutôt que de rendre un écran à zéro : un
  // tableau de bord qui annonce « rien à signaler » parce qu'il n'a rien pu
  // lire est pire qu'une page en erreur.
  if (taskRows.error) throw new Error(`Tableau de bord : ${taskRows.error.message}`);
  if (actionRows.error) throw new Error(`Tableau de bord : ${actionRows.error.message}`);

  const tasks = (taskRows.data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      wbs_code: string;
      activity: string;
      start_date: string | null;
      end_date: string | null;
      progress_pct: number | string | null;
      owner: { full_name: string } | null;
      contract: { contract_code: string } | null;
    };
    const progress = r.progress_pct === null ? null : Number(r.progress_pct);
    return {
      id: r.id,
      wbsCode: r.wbs_code,
      activity: r.activity,
      start: r.start_date,
      end: r.end_date,
      progressPct: progress,
      ownerName: r.owner?.full_name ?? null,
      contractCode: r.contract?.contract_code ?? null,
      phase: phaseOf(r.start_date, r.end_date, progress, today),
    } satisfies DashboardTask;
  });

  const horizonEnd = shift(today, AHEAD_DAYS);
  const horizonStart = shift(today, -BEHIND_DAYS);

  /* ⚠ LES RETARDS D'ABORD, QUELLE QUE SOIT LEUR DATE. Une tâche due il y a
     trois mois est plus urgente que celle qui commence demain ; la borner à la
     fenêtre l'aurait fait disparaître de l'écran au moment précis où elle
     devient un problème. Le reste est filtré sur la fenêtre. */
  const focusAll = tasks
    .filter(
      (task) =>
        task.phase === "late" ||
        (task.phase !== "done" &&
          task.start !== null &&
          task.start <= horizonEnd &&
          (task.end ?? task.start) >= horizonStart),
    )
    .sort(byUrgency);

  // ── La roadmap ────────────────────────────────────────────────────────
  const actions = (actionRows.data ?? [])
    .map((row) => {
      const r = row as unknown as {
        id: string;
        title: string;
        status: string | null;
        priority: string | null;
        timeline_start: string | null;
        assignees: { label: string }[] | null;
      };
      return {
        id: r.id,
        title: r.title,
        status: r.status,
        priority: r.priority,
        start: r.timeline_start,
        assignees: (r.assignees ?? []).map((a) => a.label),
      } satisfies DashboardAction;
    })
    // Ce qui est fini n'est plus à l'ordre du jour.
    .filter((a) => a.status !== "done" && a.start !== null && a.start <= horizonEnd);

  // ── Ce qui cloche ─────────────────────────────────────────────────────
  const unowned = tasks.filter((t) => t.ownerName === null).length;
  const undated = tasks.filter((t) => t.start === null || t.end === null).length;

  const gaps: Gap[] = [
    { key: "unowned", count: unowned, href: "/schedule?cols=all" },
    { key: "undated", count: undated, href: "/schedule?cols=all" },
    { key: "lateDeliverables", count: lateDeliverables.count ?? 0, href: "/deliverables" },
    { key: "pendingNon", count: pendingNon.count ?? 0, href: "/no-objections" },
    // Un écran sans manque est un écran vide, et c'est une bonne nouvelle :
    // on ne garde que ce qui demande un geste.
  ].filter((gap) => gap.count > 0);

  const bufferStartDate = (scenario?.buffer_start_date as string) ?? null;
  const deadlineDate = (scenario?.deadline_date as string) ?? null;

  return {
    today,
    deadlineDate,
    bufferStartDate,
    bufferMonths: (scenario?.buffer_months as number) ?? null,
    daysToDeadline: deadlineDate === null ? null : daysBetween(today, deadlineDate),
    daysToBuffer: bufferStartDate === null ? null : daysBetween(today, bufferStartDate),

    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.phase === "done").length,
    tasksRunning: tasks.filter((t) => t.phase === "running").length,
    tasksLate: tasks.filter((t) => t.phase === "late").length,

    focus: focusAll.slice(0, MAX_ROWS),
    focusMore: Math.max(0, focusAll.length - MAX_ROWS),

    actions: actions.slice(0, MAX_ROWS),
    actionsMore: Math.max(0, actions.length - MAX_ROWS),

    gaps,

    referential: {
      sites: sites.count ?? 0,
      buildings: buildings.count ?? 0,
      contracts: contracts.count ?? 0,
      lots: lots.count ?? 0,
      documents: documents.count ?? 0,
      acronyms: acronyms.count ?? 0,
    },
  };
}

const NO_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Où en est une tâche, selon ses dates et son avancement.
 *
 * ⚠ L'AVANCEMENT PRIME SUR LES DATES. Une tâche à 100 % est terminée même si
 * sa date de fin est demain, et une tâche à 100 % dont la fin est passée n'est
 * pas en retard — c'est le cas de la rédaction du REoI, close le 5 octobre.
 * Sans cette règle, le tableau de bord aurait signalé en rouge des tâches que
 * la PIU venait justement de finir.
 */
function phaseOf(
  start: string | null,
  end: string | null,
  progress: number | null,
  today: string,
): TaskPhase {
  if (progress !== null && progress >= 100) return "done";
  if (end !== null && end < today) return "late";
  if (start !== null && start <= today) return "running";
  return "soon";
}

/** Retards d'abord, puis par date de début — l'ordre dans lequel on agit. */
function byUrgency(a: DashboardTask, b: DashboardTask): number {
  const rank = (t: DashboardTask) => (t.phase === "late" ? 0 : t.phase === "running" ? 1 : 2);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return (a.start ?? "9999").localeCompare(b.start ?? "9999");
}

/** `yyyy-mm-dd` décalé de `days`, sans fuseau : voir `lib/schedule/dates`. */
function shift(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
