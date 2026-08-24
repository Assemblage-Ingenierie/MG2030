"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "./password-field";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const t = useT();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await createClient().auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Message volontairement générique : distinguer « compte inconnu » de
      // « mot de passe faux » renseignerait un attaquant sur l'existence d'une
      // adresse. Le brief prévoit ~30 comptes nominatifs, tous connus.
      setError(t("auth.invalidCredentials"));
      setLoading(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
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
      <PasswordField
        label={t("auth.password")}
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <Link
        href="/forgot-password"
        className="block text-right text-xs underline"
        style={{ color: "var(--accent)" }}
      >
        {t("auth.forgotPassword")}
      </Link>

      {error && (
        <p
          role="alert"
          className="rounded-md px-3 py-2 text-sm"
          style={{ backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)", color: "var(--danger)" }}
        >
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" block disabled={loading}>
        {loading ? t("auth.signingIn") : t("auth.signIn")}
      </Button>
    </form>
  );
}
