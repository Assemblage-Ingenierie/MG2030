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
// TROIS issues, et la deuxième est un piège de Supabase Auth.
//
//   • session immédiate → la demande d'accès est déposée dans la foulée ;
//   • confirmation par e-mail requise → on le dit, et la demande sera
//     proposée à la première connexion (écran d'attente) ;
//   • L'ADRESSE A DÉJÀ UN COMPTE — `auth.users` est PARTAGÉ avec l'autre
//     application du projet (GAPS 52). Pour ne pas révéler qu'une adresse est
//     déjà enregistrée, Supabase répond alors SANS ERREUR et sans session :
//     `data.user.identities` est un tableau VIDE. Rien ne distingue cette
//     réponse d'une inscription réussie en attente de confirmation, sauf ce
//     tableau vide. Ne pas le vérifier, c'était dire « vérifiez vos e-mails »
//     à quelqu'un qui n'allait jamais rien recevoir — c'est ce qui a bloqué
//     le premier utilisateur ayant essayé (GAPS 67).
// ============================================================

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { PasswordField } from "./password-field";
import { submitAccessRequest } from "@/app/actions/access-request";

/** Longueur minimale imposée par Supabase Auth ; on le dit avant l'aller-retour. */
const MIN_PASSWORD = 8;

export interface OrganisationChoice {
  id: string;
  code: string;
  name: string;
}

/**
 * Entité d'appartenance : assistance technique, AFD, ou unité d'exécution.
 *
 * Ce n'est pas une formalité. L'entité colore les barres du plan de charge, si
 * bien qu'une affectation approximative se lit ensuite comme un fait sur un
 * diagramme envoyé à l'AFD. Elle reste néanmoins une DÉCLARATION : l'écran
 * d'approbation la montre à l'administrateur, qui tranche.
 *
 * Facultative, et délibérément : un champ obligatoire mal compris se remplit
 * au hasard, et une entité fausse est pire qu'une entité absente — l'absence,
 * elle, se voit.
 */
function EntityChoice({
  organisations,
  value,
  onChange,
  label,
  hint,
  emptyLabel,
}: {
  organisations: OrganisationChoice[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  hint: string;
  emptyLabel: string;
}) {
  if (organisations.length === 0) return null;
  return (
    <div>
      <Label>{label}</Label>
      <select
        className={fieldClasses() + " mt-1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{emptyLabel}</option>
        {organisations.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{hint}</p>
    </div>
  );
}

export function SignUpForm({ organisations }: { organisations: OrganisationChoice[] }) {
  const t = useT();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [organisationId, setOrganisationId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingAccount, setExistingAccount] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setExistingAccount(false);

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
      // Un compte existant remonte ici DANS CERTAINES CONFIGURATIONS
      // seulement — voir le cas ci-dessous pour l'autre.
      setError(authError.message);
      setLoading(false);
      return;
    }

    // `identities` vide et pas d'erreur : l'adresse a déjà un compte.
    // Supabase le tait pour ne pas révéler qu'une adresse est enregistrée ;
    // nous, en revanche, sommes une plateforme fermée à une trentaine de
    // personnes connues — le dire est utile et ne révèle rien qu'un
    // administrateur ne sache déjà.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setExistingAccount(true);
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
      organisationId: organisationId || null,
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
      <EntityChoice
        organisations={organisations}
        value={organisationId}
        onChange={setOrganisationId}
        label={t("auth.entity")}
        hint={t("auth.entityHint")}
        emptyLabel={t("auth.entityUnspecified")}
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

      {existingAccount && (
        <p
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            color: "var(--danger)",
          }}
        >
          {t("auth.existingAccount")}{" "}
          <Link href="/login" className="underline">
            {t("auth.signIn")}
          </Link>
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
export function AccessRequestForm({
  defaultName,
  organisations,
}: {
  defaultName: string;
  /**
   * Les trois entités du projet : assistance technique, AFD, unité d'exécution.
   * Elles viennent de `mg2030_organisation` — la même table que celle qui
   * colore les barres du Gantt, pour que déclaration et affichage ne puissent
   * pas diverger.
   */
  organisations: OrganisationChoice[];
}) {
  const t = useT();
  const router = useRouter();

  const [fullName, setFullName] = useState(defaultName);
  const [jobTitle, setJobTitle] = useState("");
  const [organisationId, setOrganisationId] = useState("");
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
      organisationId: organisationId || null,
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
      <EntityChoice
        organisations={organisations}
        value={organisationId}
        onChange={setOrganisationId}
        label={t("auth.entity")}
        hint={t("auth.entityHint")}
        emptyLabel={t("auth.entityUnspecified")}
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
