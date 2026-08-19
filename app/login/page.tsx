import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { PanelCard } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";

/**
 * Connexion.
 *
 * Pas d'inscription libre : les comptes sont créés par un administrateur
 * (brief §3). Le formulaire ne propose donc ni « créer un compte », ni Google.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const state = await getAuthState();
  const { redirect: target } = await searchParams;

  // Déjà connecté : on ne réaffiche pas le formulaire. Le garde d'accès dira
  // ensuite s'il s'agit d'un compte MG2030 ou d'un compte étranger.
  if (state.status !== "anonymous") {
    redirect(safeRedirect(target));
  }

  const { t } = await getI18n();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <PanelCard className="w-full max-w-sm">
        <h1 className="text-center text-lg font-semibold tracking-tight text-[var(--text)]">
          {t("app.name")}
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--text-muted)]">
          {t("app.subtitle")}
        </p>
        <LoginForm redirectTo={safeRedirect(target)} />
        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          {t("auth.invitationOnly")}
        </p>
      </PanelCard>
    </div>
  );
}

/**
 * N'accepte qu'un chemin interne.
 *
 * Sans ce filtre, `?redirect=https://ailleurs.example` transformerait l'écran
 * de connexion en tremplin de redirection ouverte. On refuse aussi `//host`,
 * qui est un chemin absolu de protocole.
 */
function safeRedirect(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
