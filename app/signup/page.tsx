import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { PanelCard } from "@/components/ui/card";
import { SignUpForm } from "@/components/auth/signup-form";
import { FunderMark, KosovoEmblem } from "@/components/shell/brand-mark";
import { LanguageSwitch } from "@/components/shell/language-switch";

/**
 * Création de compte.
 *
 * ⚠ S'INSCRIRE NE DONNE ACCÈS À RIEN, et la page le dit avant le formulaire.
 * Le compte créé est un compte d'authentification ; il n'est membre d'aucun
 * projet tant qu'un administrateur ne l'a pas rattaché. Toute la RLS passe par
 * `is_member()` : sans ligne dans `mg2030_app_user`, zéro donnée sur les
 * 30 tables.
 *
 * Le brief §3 excluait l'inscription libre. Décision du 21/08/2026 de
 * l'autoriser : ouvrir une trentaine de comptes à la main s'est révélé
 * impraticable, et le modèle de droits rend l'ouverture sans danger.
 */
export default async function SignUpPage() {
  const state = await getAuthState();
  if (state.status !== "anonymous") redirect("/");

  const { t } = await getI18n();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 py-8">
      <PanelCard className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <FunderMark />
            <span className="h-9 w-px bg-[var(--border)]" aria-hidden="true" />
            <KosovoEmblem className="h-[38px] w-auto" />
            <span className="sr-only">{t("app.owner")}</span>
          </div>
          <h1 className="text-center text-lg font-semibold tracking-tight text-[var(--text)]">
            {t("auth.createAccount")}
          </h1>
        </div>

        {/* Ce que l'inscription produit, dit AVANT de la remplir. */}
        <p
          className="mt-4 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: "color-mix(in srgb, var(--accent-2) 12%, transparent)",
            color: "var(--text)",
          }}
        >
          {t("auth.signUpNotice")}
        </p>

        <SignUpForm />

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          {t("auth.haveAccount")}{" "}
          <Link href="/login" className="underline" style={{ color: "var(--accent)" }}>
            {t("auth.signIn")}
          </Link>
        </p>
      </PanelCard>

      <LanguageSwitch />
    </div>
  );
}
