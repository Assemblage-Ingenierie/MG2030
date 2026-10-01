"use client";

// ============================================================
// components/account/profile-form.tsx — sa fiche, modifiable.
//
// Ce qu'on peut changer soi-même, et ce qu'on ne peut pas, sont SÉPARÉS À
// L'ÉCRAN et non mélangés en grisé : l'organisation, le rôle, le périmètre et
// le niveau d'accès relèvent d'une décision d'administration, et les afficher
// comme des champs désactivés ferait croire à une permission qu'on aurait
// perdue, plutôt qu'à une décision qui n'appartient pas à soi.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requestEmailChange, updateOwnProfile } from "@/app/(app)/account/actions";

export function ProfileForm({
  firstName: initialFirst,
  lastName: initialLast,
  jobTitle: initialJob,
  email: currentEmail,
}: {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
}) {
  const t = useT();
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [jobTitle, setJobTitle] = useState(initialJob);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [email, setEmail] = useState(currentEmail);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailPending, startEmail] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await updateOwnProfile({
        firstName,
        lastName,
        jobTitle: jobTitle || null,
        // La langue se change par le sélecteur du cadre, pas ici : deux
        // endroits pour un même réglage finissent par se contredire.
        locale: document.documentElement.lang || "en",
      });
      if (!result.ok) setError(t(`account.error_${result.error}`));
      else setSaved(true);
    });
  }

  function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSent(false);
    startEmail(async () => {
      const result = await requestEmailChange(email);
      if (!result.ok) setEmailError(t(`account.error_${result.error}`));
      else setEmailSent(true);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("auth.firstName")}
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(ev) => setFirstName(ev.target.value)}
            />
            <Field
              label={t("auth.lastName")}
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(ev) => setLastName(ev.target.value)}
            />
          </div>
          <Field
            label={t("users.jobTitle")}
            optionalText={t("common.optional")}
            value={jobTitle}
            onChange={(ev) => setJobTitle(ev.target.value)}
          />

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={pending}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
            {saved && (
              <span className="text-sm text-[var(--text-muted)]">{t("account.saved")}</span>
            )}
            {error && (
              <span role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
                {error}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card className="p-4">
        <form onSubmit={changeEmail} className="flex flex-col gap-3">
          <Field
            label={t("users.email")}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
          />
          {/* ⚠ DIT AVANT, PAS APRÈS. L'adresse ne change qu'une fois le lien
              suivi depuis la NOUVELLE boîte ; annoncer « enregistré » ferait
              croire le changement acquis, et quelqu'un se retrouverait dehors
              en pensant avoir changé d'adresse. */}
          <p className="text-xs text-[var(--text-muted)]">{t("account.emailNotice")}</p>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              type="submit"
              disabled={emailPending || email.trim().toLowerCase() === currentEmail.toLowerCase()}
            >
              {emailPending ? t("common.saving") : t("account.changeEmail")}
            </Button>
            {emailSent && (
              <span className="text-sm text-[var(--text-muted)]">
                {t("account.emailSent", { email })}
              </span>
            )}
            {emailError && (
              <span role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
                {emailError}
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}
