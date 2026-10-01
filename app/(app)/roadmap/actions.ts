"use server";

// ============================================================
// app/(app)/roadmap/actions.ts — écriture des actions de roadmap.
//
// RLS SEULE AUTORITÉ : aucune vérification de rôle ici. Un compte sans
// `roadmap.write`, ou rattaché à une organisation en lecture seule, reçoit un
// refus de la base, pas d'ici.
//
// ⚠ LA TIMELINE EST RÉSOLUE PAR LE MODULE PUR, JAMAIS À LA MAIN.
// Le formulaire envoie une PRÉCISION et une date d'ancrage ; `resolveTimeline`
// en tire l'intervalle. Recalculer ici « un mois, c'est le 1er au 30 » serait
// une seconde implémentation de la même règle, donc une divergence certaine.
// C'est aussi lui qui recale l'ancre : cliquer le mercredi 14 avec la précision
// « semaine » désigne la semaine du lundi 12.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { resolveTimeline, type TimelineKind } from "@/lib/roadmap/timeline";
import type { RoadmapPriority, RoadmapStatus } from "@/lib/roadmap/types";

export interface RoadmapInput {
  subjectId: string;
  title: string;
  status: RoadmapStatus | null;
  priority: RoadmapPriority | null;
  timelineKind: TimelineKind | null;
  /** Jour choisi dans la période visée. Recalé par `resolveTimeline`. */
  anchor: string | null;
  /** Dernier jour COMPRIS, pour une plage seulement. */
  rangeEnd: string | null;
  detail: string | null;
  /** Libellés libres : une personne, une organisation, un tiers. */
  assignees: string[];
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function validate(input: RoadmapInput): string | null {
  if (input.title.trim() === "") return "emptyTitle";
  if (!input.subjectId) return "noSubject";
  // Une précision sans date n'est pas une timeline : on le dit avant
  // l'aller-retour plutôt que de laisser la contrainte de base trancher.
  if (input.timelineKind && !input.anchor) return "missingAnchor";
  if (input.timelineKind === "range") {
    if (!input.rangeEnd) return "missingAnchor";
    if (input.anchor && input.rangeEnd < input.anchor) return "invalidRange";
  }
  return null;
}

function toRow(input: RoadmapInput) {
  const timeline = resolveTimeline(input.timelineKind, input.anchor, input.rangeEnd);
  return {
    subject_id: input.subjectId,
    title: input.title.trim(),
    status: input.status,
    priority: input.priority,
    timeline_kind: timeline.kind,
    timeline_start: timeline.start,
    timeline_end: timeline.end,
    detail: input.detail?.trim() || null,
  };
}

/**
 * Remplace la liste des assignataires.
 *
 * On efface puis on repose, plutôt que de calculer un différentiel : à trois
 * noms par action, le différentiel coûterait une lecture de plus pour un gain
 * nul.
 *
 * ⚠ LE RATTACHEMENT AU COMPTE EST RÉSOLU ICI, PAR ÉGALITÉ EXACTE DU NOM.
 *
 * Une première version écrivait `app_user_id: null` systématiquement, pour ne
 * pas « deviner » un compte. C'était trop prudent, et le prix s'est vu : le
 * sélecteur insère le nom complet TEL QUE LE PORTE LE COMPTE, si bien qu'une
 * égalité stricte n'a rien d'une devinette — mais chaque édition effaçait le
 * lien, et la même personne s'est retrouvée sous trois libellés, donc trois
 * entrées dans le filtre.
 *
 * Le garde-fou contre l'homonyme reste : on ne relie que si EXACTEMENT UN
 * compte actif porte ce nom. Deux homonymes, et les deux lignes restent du
 * texte libre — ce qui se voit, au lieu de rattacher l'action au mauvais.
 */
async function replaceAssignees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actionId: string,
  labels: string[],
): Promise<string | null> {
  const { error: del } = await supabase
    .from("mg2030_roadmap_assignee")
    .delete()
    .eq("action_id", actionId);
  if (del) return del.message;

  const clean = [...new Set(labels.map((l) => l.trim()).filter(Boolean))];
  if (clean.length === 0) return null;

  const { data: matches } = await supabase
    .from("mg2030_app_user")
    .select("id, full_name")
    .in("full_name", clean)
    .eq("is_active", true);

  const byName = new Map<string, string | null>();
  for (const u of matches ?? []) {
    const name = u.full_name as string;
    // Déjà vu : homonymes. On annule le rattachement des deux.
    byName.set(name, byName.has(name) ? null : (u.id as string));
  }

  const { error } = await supabase.from("mg2030_roadmap_assignee").insert(
    clean.map((label, i) => ({
      action_id: actionId,
      label,
      app_user_id: byName.get(label) ?? null,
      sort_order: i,
    })),
  );
  return error?.message ?? null;
}

export async function createRoadmapAction(input: RoadmapInput): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();

  // Nouvelle action en fin de sujet : on ne pousse personne.
  const { data: last } = await supabase
    .from("mg2030_roadmap_action")
    .select("sort_order")
    .eq("subject_id", input.subjectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("mg2030_roadmap_action")
    .insert({ ...toRow(input), sort_order: ((last?.sort_order as number) ?? 0) + 10 })
    .select("id")
    .single();

  if (error) return { ok: false, error: "writeFailed" };

  const failed = await replaceAssignees(supabase, data.id as string, input.assignees);
  if (failed) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

export async function updateRoadmapAction(
  id: string,
  input: RoadmapInput,
): Promise<ActionResult> {
  const invalid = validate(input);
  if (invalid) return { ok: false, error: invalid };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_roadmap_action")
    .update(toRow(input))
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  const failed = await replaceAssignees(supabase, id, input.assignees);
  if (failed) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * ARCHIVER plutôt que supprimer.
 *
 * Une action retirée de la roadmap n'a pas forcément disparu du projet : elle
 * a pu être abandonnée, reportée, absorbée par une autre. Six mois plus tard,
 * « pourquoi avait-on arrêté de suivre ça ? » est une question qui se pose
 * vraiment en revue, et une ligne effacée ne peut pas y répondre.
 *
 * `archived_at` existait depuis la création de la table sans être employé ;
 * c'est maintenant le geste normal, et la suppression devient l'exception.
 */
export async function archiveRoadmapAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_roadmap_action")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/** Remet une action archivée dans la liste courante. */
export async function restoreRoadmapAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_roadmap_action")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * Suppression DÉFINITIVE, et réservée aux actions déjà archivées.
 *
 * Deux gestes pour effacer, et c'est voulu : on archive, puis on supprime
 * depuis la liste des archives. Une corbeille accessible d'un seul clic depuis
 * la liste courante finit toujours par emporter une ligne qu'on relisait.
 */
export async function deleteRoadmapAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_roadmap_action")
    .delete({ count: "exact" })
    .eq("id", id)
    .not("archived_at", "is", null);

  if (error) return { ok: false, error: "writeFailed" };
  // Zéro ligne : soit la RLS a refusé, soit l'action n'était pas archivée.
  if (count === 0) return { ok: false, error: "notArchived" };

  revalidatePath("/roadmap");
  return { ok: true };
}

// ── Sujets ──────────────────────────────────────────────────────────────────

/**
 * Crée un sujet, à la fin de la liste.
 *
 * Le `code` est dérivé du nom, en majuscules sans accent : il sert de clé
 * naturelle et de garde-fou contre les doublons — « Student center » et
 * « Student Center » rendraient le même code et le second serait refusé, ce
 * qui vaut mieux que deux intertitres presque identiques.
 */
export async function createRoadmapSubject(name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (clean === "") return { ok: false, error: "emptySubjectName" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("mg2030_roadmap_subject")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("mg2030_roadmap_subject").insert({
    code: toCode(clean),
    name: clean,
    sort_order: ((last?.sort_order as number) ?? 0) + 10,
  });
  if (error) return { ok: false, error: "duplicateSubject" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * Renomme un sujet. Le `code` NE BOUGE PAS.
 *
 * Il identifie le sujet ; le changer ferait d'un simple rebaptême une
 * migration. Corriger une faute de frappe dans un intitulé ne doit pas toucher
 * à l'identité de la ligne.
 */
export async function renameRoadmapSubject(
  id: string,
  name: string,
): Promise<ActionResult> {
  const clean = name.trim();
  if (clean === "") return { ok: false, error: "emptySubjectName" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_roadmap_subject")
    .update({ name: clean })
    .eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * Déplace un sujet d'un rang, vers le haut ou vers le bas.
 *
 * ⚠ ON ÉCHANGE LES DEUX `sort_order`, on ne renumérote pas la liste entière.
 * Une renumérotation écrit autant de lignes qu'il y a de sujets à chaque clic,
 * et deux administrateurs qui réordonnent en même temps se marchent dessus sur
 * toute la table au lieu de deux lignes.
 *
 * Les rangs du seed valent 10, 20, 30… : l'échange reste exact même si un
 * sujet ajouté depuis porte un rang intercalaire.
 */
export async function moveRoadmapSubject(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: subjects, error: readError } = await supabase
    .from("mg2030_roadmap_subject")
    .select("id, sort_order")
    .order("sort_order");
  if (readError || !subjects) return { ok: false, error: "writeFailed" };

  const index = subjects.findIndex((s) => s.id === id);
  const other = subjects[index + (direction === "up" ? -1 : 1)];
  // Déjà au bout : ce n'est pas une erreur, il n'y a simplement rien à faire.
  if (index === -1 || !other) return { ok: true };

  const mine = subjects[index];
  const [a, b] = await Promise.all([
    supabase
      .from("mg2030_roadmap_subject")
      .update({ sort_order: other.sort_order })
      .eq("id", mine.id),
    supabase
      .from("mg2030_roadmap_subject")
      .update({ sort_order: mine.sort_order })
      .eq("id", other.id),
  ]);
  if (a.error || b.error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

/**
 * Supprime un sujet. SES ACTIONS SURVIVENT.
 *
 * La clé étrangère est passée en `on delete set null` (migration 0040) : les
 * actions perdent leur rangement, pas leur contenu, et l'écran les regroupe
 * sous « sans sujet » pour qu'on les reclasse. C'était la demande explicite du
 * 01/10/2026 — un sujet créé par erreur devait pouvoir disparaître sans
 * emporter le travail qu'on y avait rangé entre-temps.
 *
 * Pas d'archivage ici, contrairement aux actions : un sujet ne porte aucune
 * information propre — un intitulé, un rang — et « pourquoi avait-on arrêté de
 * suivre ce sujet ? » ne se pose pas comme pour une action abandonnée.
 */
export async function deleteRoadmapSubject(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("mg2030_roadmap_subject").delete().eq("id", id);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/roadmap");
  return { ok: true };
}

function toCode(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Modification d'UN SEUL champ, depuis la liste.
 *
 * L'édition en ligne ne renvoie pas l'action entière : deux personnes peuvent
 * modifier deux colonnes de la même ligne à quelques secondes d'intervalle, et
 * renvoyer tout le formulaire ferait écraser par la seconde ce que la première
 * vient d'écrire — sans que personne ne le voie. On n'envoie donc que ce qu'on
 * change.
 *
 * La timeline reste indivisible : précision et intervalle voyagent ensemble,
 * parce qu'une précision sans intervalle est un état que la contrainte de base
 * refuse, à juste titre.
 */
export async function patchRoadmapAction(
  id: string,
  patch: {
    title?: string;
    subjectId?: string | null;
    status?: RoadmapStatus | null;
    priority?: RoadmapPriority | null;
    detail?: string | null;
    timeline?: { kind: TimelineKind | null; anchor: string | null; rangeEnd: string | null };
    assignees?: string[];
  },
): Promise<ActionResult> {
  const supabase = await createClient();
  const row: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    // Une action sans intitulé ne se retrouve plus dans la liste : on refuse
    // plutôt que d'enregistrer une ligne muette.
    if (title === "") return { ok: false, error: "emptyTitle" };
    row.title = title;
  }
  // `null` est une valeur LÉGITIME ici : c'est ainsi qu'on déclasse une action
  // sans la supprimer. D'où `in` plutôt que `!== undefined`.
  if ("subjectId" in patch) row.subject_id = patch.subjectId;
  if ("status" in patch) row.status = patch.status;
  if ("priority" in patch) row.priority = patch.priority;
  // Un détail vidé vaut « pas de détail », pas une chaîne vide : sinon la
  // cellule afficherait une ligne blanche sous l'intitulé.
  if ("detail" in patch) row.detail = patch.detail?.trim() || null;

  if (patch.timeline) {
    const { kind, anchor, rangeEnd } = patch.timeline;
    if (kind && !anchor) return { ok: false, error: "missingAnchor" };
    if (kind === "range" && (!rangeEnd || (anchor && rangeEnd < anchor))) {
      return { ok: false, error: "invalidRange" };
    }
    const timeline = resolveTimeline(kind, anchor, rangeEnd);
    row.timeline_kind = timeline.kind;
    row.timeline_start = timeline.start;
    row.timeline_end = timeline.end;
  }

  if (Object.keys(row).length > 0) {
    const { error } = await supabase.from("mg2030_roadmap_action").update(row).eq("id", id);
    if (error) return { ok: false, error: "writeFailed" };
  }

  if (patch.assignees) {
    const failed = await replaceAssignees(supabase, id, patch.assignees);
    if (failed) return { ok: false, error: "writeFailed" };
  }

  revalidatePath("/roadmap");
  return { ok: true };
}
