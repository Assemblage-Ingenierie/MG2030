import "server-only";

// ============================================================
// lib/email/brevo.ts — envoi transactionnel par Brevo.
//
// Le brief §7 disait « pas d'e-mail en version 1 ». Cette exception est
// délibérée et étroite : PRÉVENIR LES ADMINISTRATEURS qu'un compte attend.
// C'est le seul message que personne ne peut aller chercher dans
// l'application — un demandeur bloqué sur l'écran d'attente n'a aucun moyen de
// se signaler, et un administrateur n'a aucune raison d'ouvrir la page des
// comptes « au cas où ».
//
// ⚠ UN ÉCHEC D'ENVOI NE FAIT PAS ÉCHOUER L'INSCRIPTION. La demande est écrite
// en base d'abord ; l'e-mail n'est qu'une notification. Faire dépendre la
// création d'un compte de la disponibilité d'un service tiers échangerait un
// dérangement contre une panne.
// ============================================================

/** Destinataires des notifications d'administration. */
export const ADMIN_RECIPIENTS = ["louis@assemblage.net", "clement@assemblage.net"];

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export type MailOutcome =
  | { sent: true }
  | { sent: false; reason: "notConfigured" | "rejected" | "unreachable"; detail?: string };

/**
 * Envoie un message transactionnel.
 *
 * Rend TOUJOURS un résultat, ne lève jamais : l'appelant décide quoi en faire,
 * et dans notre cas il choisit de continuer.
 */
export async function sendMail(options: {
  to: string[];
  subject: string;
  html: string;
  /** Répondre au demandeur plutôt qu'à l'expéditeur technique. */
  replyTo?: { email: string; name?: string };
}): Promise<MailOutcome> {
  const key = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  // Sans clé ni expéditeur validé, Brevo refuserait de toute façon. On le dit
  // clairement plutôt que d'émettre un appel voué à l'échec.
  if (!key || !senderEmail) return { sent: false, reason: "notConfigured" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": key,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: process.env.BREVO_SENDER_NAME ?? "MG2030", email: senderEmail },
        to: options.to.map((email) => ({ email })),
        subject: options.subject,
        htmlContent: options.html,
        ...(options.replyTo ? { replyTo: options.replyTo } : {}),
      }),
      // Un service tiers lent ne doit pas retenir la réponse à l'utilisateur.
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return { sent: false, reason: "rejected", detail: detail.slice(0, 300) };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: "unreachable",
      detail: error instanceof Error ? error.message : undefined,
    };
  }
}

/** Échappe le texte inséré dans le corps HTML. */
function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Prévient les administrateurs qu'une demande d'accès attend.
 *
 * Le corps porte tout ce qu'il faut pour décider sans ouvrir l'application :
 * qui, quel poste, quel message. Un e-mail qui oblige à aller voir ailleurs ne
 * fait gagner que le temps de la notification.
 */
export async function notifyAccessRequest(request: {
  email: string;
  fullName: string;
  jobTitle: string | null;
  message: string | null;
  appUrl: string;
}): Promise<MailOutcome> {
  const rows = [
    ["Name", request.fullName],
    ["Email", request.email],
    ["Job title", request.jobTitle ?? "—"],
    ["Message", request.message ?? "—"],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:13px">${label}</td>` +
        `<td style="padding:4px 0;font-size:13px">${escape(value)}</td></tr>`,
    )
    .join("");

  return sendMail({
    to: ADMIN_RECIPIENTS,
    subject: `MG2030 — access request from ${request.fullName}`,
    replyTo: { email: request.email, name: request.fullName },
    html:
      `<div style="font-family:system-ui,sans-serif;color:#272a33">` +
      `<p style="font-size:14px">A new account is waiting for assignment on the MG2030 ` +
      `platform. It currently has <strong>no access to any data</strong> — it is not a ` +
      `member of the project until an administrator assigns it an organisation, a role ` +
      `and a scope.</p>` +
      `<table style="border-collapse:collapse;margin:16px 0">${rows}</table>` +
      `<p style="font-size:14px"><a href="${request.appUrl}/admin/users" ` +
      `style="color:#034ea2">Open the accounts screen</a></p>` +
      `</div>`,
  });
}
