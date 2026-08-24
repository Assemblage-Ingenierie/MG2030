"use server";

// ============================================================
// app/actions/access-request.ts — demande d'accès et traitement.
//
// S'inscrire crée un compte d'AUTHENTIFICATION, jamais un membre. Le nouveau
// venu ne lit aucune donnée : toute la RLS passe par `is_member()`, qui
// interroge `mg2030_app_user`. Cette action n'écrit qu'une demande, sous RLS,
// dans une table dont la politique d'insertion exige `auth.uid() = auth_user_id`
// — personne ne peut donc déposer une demande au nom d'un autre.
//
// L'e-mail aux administrateurs est le SEUL message sortant de la version 1
// (le brief §7 n'en prévoyait aucun). Il est justifié parce qu'il est le seul
// que personne ne peut aller chercher dans l'application : un demandeur bloqué
// sur l'écran d'attente n'a aucun moyen de se signaler.
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyAccessRequest } from "@/lib/email/brevo";

export interface RequestResult {
  ok: boolean;
  error?: string;
  /**
   * Vrai si la demande est enregistrée mais que l'e-mail n'est pas parti. On
   * ne fait PAS échouer pour autant : la demande existe, elle se voit dans
   * l'écran des comptes. On le dit, c'est tout.
   */
  mailFailed?: boolean;
}

function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "https://mg2030.vercel.app";
}

/**
 * Dépose la demande d'accès de l'utilisateur connecté.
 *
 * Idempotente : redéposer met à jour le nom et le message plutôt que d'échouer
 * sur l'unicité. Quelqu'un qui corrige son intitulé de poste ne doit pas se
 * heurter à une erreur technique.
 */
export async function submitAccessRequest(input: {
  fullName: string;
  jobTitle: string | null;
  message: string | null;
}): Promise<RequestResult> {
  const fullName = input.fullName.trim();
  if (fullName === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { ok: false, error: "unauthenticated" };

  // Déjà membre : la demande n'a pas lieu d'être, et l'écrire embrouillerait
  // l'écran d'administration.
  const { data: member } = await supabase
    .from("mg2030_app_user")
    .select("id")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (member) return { ok: false, error: "alreadyMember" };

  const row = {
    auth_user_id: auth.user.id,
    email: auth.user.email,
    full_name: fullName,
    job_title: input.jobTitle?.trim() || null,
    message: input.message?.trim() || null,
  };

  const { error } = await supabase
    .from("mg2030_access_request")
    .upsert(row, { onConflict: "auth_user_id" });
  if (error) return { ok: false, error: "writeFailed" };

  // La demande est écrite. À partir d'ici, un échec d'envoi ne remet rien en
  // cause : on le signale sans annuler.
  const mail = await notifyAccessRequest({
    email: auth.user.email,
    fullName,
    jobTitle: row.job_title,
    message: row.message,
    appUrl: appUrl(),
  });

  revalidatePath("/admin/users");
  return { ok: true, mailFailed: !mail.sent };
}

/**
 * Approuve une demande : crée le membre, puis marque la demande traitée.
 *
 * Dans cet ordre, et pas l'inverse : si la création du membre échoue, la
 * demande reste en attente et reparaîtra. Marquer d'abord aurait pu faire
 * disparaître une demande sans avoir ouvert le compte.
 *
 * Le compte est créé INACTIF et sans périmètre. Il faut donc encore l'activer
 * et lui régler rôle et périmètre depuis l'écran des comptes — un compte
 * approuvé n'est pas un compte configuré.
 */
export async function approveAccessRequest(
  requestId: string,
  organisationId: string,
  functionalRoleId: string,
): Promise<RequestResult> {
  const supabase = await createClient();

  const { data: request, error: readError } = await supabase
    .from("mg2030_access_request")
    .select("id, auth_user_id, email, full_name, job_title, status")
    .eq("id", requestId)
    .single();
  if (readError || !request) return { ok: false, error: "notFound" };
  if (request.status !== "pending") return { ok: false, error: "alreadyHandled" };

  const { data: me } = await supabase.auth.getUser();
  const { data: admin } = await supabase
    .from("mg2030_app_user")
    .select("id")
    .eq("auth_user_id", me.user?.id ?? "")
    .maybeSingle();

  const { error: insertError } = await supabase.from("mg2030_app_user").insert({
    auth_user_id: request.auth_user_id,
    email: request.email,
    full_name: request.full_name,
    job_title: request.job_title,
    organisation_id: organisationId,
    functional_role_id: functionalRoleId,
    is_active: false,
  });
  if (insertError) return { ok: false, error: "writeFailed" };

  const { error: updateError } = await supabase
    .from("mg2030_access_request")
    .update({
      status: "approved",
      handled_by: admin?.id ?? null,
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (updateError) return { ok: false, error: "writeFailed" };

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Refuse une demande. Le compte d'authentification subsiste, sans accès. */
export async function rejectAccessRequest(requestId: string): Promise<RequestResult> {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  const { data: admin } = await supabase
    .from("mg2030_app_user")
    .select("id")
    .eq("auth_user_id", me.user?.id ?? "")
    .maybeSingle();

  const { error } = await supabase
    .from("mg2030_access_request")
    .update({
      status: "rejected",
      handled_by: admin?.id ?? null,
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId);
  if (error) return { ok: false, error: "writeFailed" };

  revalidatePath("/admin/users");
  return { ok: true };
}
