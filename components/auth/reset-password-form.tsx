"use client";

// ============================================================
// components/auth/reset-password-form.tsx — nouveau mot de passe.
//
// Après validation, `router.refresh()` + `push("/")` : la racine décide alors
// normalement — écran d'attente pour un compte pas encore membre, application
// pour un membre actif. On ne suppose rien ici sur ce que la personne va voir.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { PasswordField } from "./password-field";

const MIN_PASSWORD = 8;

export function ResetPasswordForm() {
  const t = useT();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD) {
      setError(t("auth.error_shortPassword", { min: String(MIN_PASSWORD) }));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.error_passwordMismatch"));
      return;
    }

    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <PasswordField
        label={t("auth.newPassword")}
        autoComplete="new-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordField
        label={t("auth.confirmPassword")}
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
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
        {loading ? t("auth.saving") : t("auth.setNewPassword")}
      </Button>
    </form>
  );
}
