"use client";

// ============================================================
// components/auth/signup-form.tsx — création de compte.
//
// ⚠ S'INSCRIRE NE DONNE ACCÈS À RIEN. Le compte créé est un compte
// d'authentification ; il n'est membre d'aucun projet tant qu'un
// administrateur ne l'a pas rattaché. Le formulaire le dit AVANT l'envoi, pas
// après : découvrir un écran d'attente sans y avoir été préparé se lit comme
// une panne.
//
// Deux issues selon la configuration de Supabase :
//   • session immédiate → la demande d'accès est déposée dans la foulée ;
//   • confirmation par e-mail requise → on le dit, et la demande sera
//     proposée à la première connexion (écran d'attente).
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "./password-field";
import { submitAccessRequest } from "@/app/actions/access-request";

/** Longueur minimale imposée par Supabase Auth ; on le dit avant l'aller-retour. */
const MIN_PASSWORD = 8;

export function SignUpForm() {
  const t = useT();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (fullName.trim() === "") {
      setError(t("auth.error_emptyName"));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t("auth.error_shortPassword", { min: String(MIN_PASSWORD) }));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (authError) {
      // Un compte existant remonte ici. On ne cherche pas à masquer le cas :
      // sur une plateforme fermée à trente personnes, dire « cette adresse a
      // déjà un compte » est utile et ne révèle rien qu'un administrateur ne
      // sache déjà.
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // Confirmation par e-mail exigée : rien à déposer tant qu'il n'y a pas de
      // session, la politique d'insertion exige `auth.uid() = auth_user_id`.
      setNotice(t("auth.confirmEmailNotice"));
      setLoading(false);
      return;
    }

    const result = await submitAccessRequest({
      fullName: fullName.trim(),
      jobTitle: jobTitle.trim() || null,
      message: message.trim() || null,
    });
    setLoading(false);

    if (!result.ok) {
      setError(t(`auth.error_${result.error}`));
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field
        label={t("auth.fullName")}
        autoComplete="name"
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Field
        label={t("auth.jobTitle")}
        optionalText={t("common.optional")}
        autoComplete="organization-title"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
      />
      <Field
        label={t("auth.email")}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordField
        label={t("auth.password")}
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Field
        label={t("auth.requestMessage")}
        optionalText={t("common.optional")}
        hint={t("auth.requestMessageHint")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      {error && (
        <p
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
            color: "var(--accent)",
          }}
        >
          {notice}
        </p>
      )}

      <Button type="submit" variant="primary" block disabled={loading}>
        {loading ? t("auth.creating") : t("auth.createAccount")}
      </Button>
    </form>
  );
}

/**
 * Dépôt de la demande depuis l'écran d'attente.
 *
 * Sert à deux cas : la confirmation par e-mail a différé le dépôt, ou bien la
 * personne possède déjà un compte de l'autre application du projet et souhaite
 * accéder à MG2030.
 */
export function AccessRequestForm({ defaultName }: { defaultName: string }) {
  const t = useT();
  const router = useRouter();

  const [fullName, setFullName] = useState(defaultName);
  const [jobTitle, setJobTitle] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <p className="mt-4 text-sm" style={{ color: "var(--accent)" }}>
        {t("auth.requestSent")}
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setState("sending");
    const result = await submitAccessRequest({
      fullName: fullName.trim(),
      jobTitle: jobTitle.trim() || null,
      message: message.trim() || null,
    });
    if (!result.ok) {
      setError(t(`auth.error_${result.error}`));
      setState("idle");
      return;
    }
    setState("sent");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 text-left">
      <Field
        label={t("auth.fullName")}
        required
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <Field
        label={t("auth.jobTitle")}
        optionalText={t("common.optional")}
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
      />
      <Field
        label={t("auth.requestMessage")}
        optionalText={t("common.optional")}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" block disabled={state === "sending"}>
        {state === "sending" ? t("auth.creating") : t("auth.requestAccess")}
      </Button>
    </form>
  );
}
