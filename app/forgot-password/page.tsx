import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { PanelCard } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

/**
 * Demande de réinitialisation de mot de passe.
 *
 * Hors du groupe `(app)` : pas de chrome, pas de garde d'accès — la même
 * raison que /login et /signup (voir app/layout.tsx).
 */
export default async function ForgotPasswordPage() {
  const state = await getAuthState();
  if (state.status !== "anonymous") redirect("/");

  const { t } = await getI18n();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <PanelCard className="w-full max-w-sm">
        <h1 className="text-center text-lg font-semibold tracking-tight text-[var(--text)]">
          {t("auth.forgotPasswordTitle")}
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--text-muted)]">
          {t("auth.forgotPasswordIntro")}
        </p>

        <ForgotPasswordForm />

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          <Link href="/login" className="underline" style={{ color: "var(--accent)" }}>
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </PanelCard>
    </div>
  );
}
