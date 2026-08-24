"use client";

// ============================================================
// components/auth/forgot-password-form.tsx — demande de réinitialisation.
//
// ⚠ MÊME MESSAGE, adresse connue ou pas. Supabase répond toujours sans
// erreur : dire « e-mail envoyé » à une adresse inconnue ne révèle rien, dire
// « cette adresse n'existe pas » le révélerait. On garde la même discipline
// que sur l'inscription (GAPS 68) — sauf que Supabase fait ici lui-même le
// travail, on n'a rien à détecter.
// ============================================================

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <p
        className="mt-6 rounded-md px-3 py-2 text-sm"
        style={{
          backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
          color: "var(--accent)",
        }}
      >
        {t("auth.resetLinkSent")}
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      // /auth/callback échange le code contre une session PUIS redirige vers
      // la page qui pose le nouveau mot de passe.
      redirectTo: `${window.location.origin}/auth/callback?next=/account/reset-password`,
    });

    setLoading(false);
    // Un envoi refusé (adresse malformée, service indisponible) est la seule
    // chose qu'on affiche en clair : ce n'est pas une information sur
    // l'existence du compte.
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <Field
        label={t("auth.email")}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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

      <Button type="submit" variant="primary" block disabled={loading}>
        {loading ? t("auth.sending") : t("auth.sendResetLink")}
      </Button>
    </form>
  );
}
