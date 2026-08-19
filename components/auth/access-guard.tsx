import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { PanelCard } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import { SignOutButton } from "./sign-out-button";
import { AuthUserProvider } from "./auth-context";

/**
 * Garde d'accès. Enveloppe tout écran métier.
 *
 * ⚠ Ce n'est PAS la protection des données — c'est la RLS qui l'assure, et
 * elle seule (brief §8). Ce composant choisit l'écran à montrer.
 *
 * Trois refus DISTINCTS, et la distinction n'est pas cosmétique :
 *
 *   • `foreign` — authentifié mais absent de `mg2030_app_user`. `auth.users`
 *     est PARTAGÉ avec une autre application du projet Supabase : ces comptes
 *     existent et se connecteront. Leur afficher « en attente de validation »
 *     les ferait attendre indéfiniment une validation que personne n'a à faire.
 *     Le message dit donc clairement que ce compte n'a pas accès à MG2030.
 *
 *   • `pending` — compte MG2030 créé par un administrateur, pas encore activé.
 *     Là, l'attente est réelle et le message le dit.
 *
 *   • `anonymous` — le middleware a déjà redirigé vers /login ; ce cas ne
 *     devrait pas se produire, mais on ne rend rien plutôt que de supposer.
 */
export async function AccessGuard({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  const { t } = await getI18n();

  if (state.status === "anonymous") return null;

  if (state.status === "foreign") {
    return (
      <Refusal
        title={t("auth.noAccessTitle")}
        body={t("auth.noAccessBody")}
        email={state.email}
        signOutLabel={t("common.signOut")}
      />
    );
  }

  if (state.status === "pending") {
    return (
      <Refusal
        title={t("auth.pendingTitle")}
        body={t("auth.pendingBody")}
        email={state.user.email}
        signOutLabel={t("common.signOut")}
      />
    );
  }

  return <AuthUserProvider user={state.user}>{children}</AuthUserProvider>;
}

function Refusal({
  title,
  body,
  email,
  signOutLabel,
}: {
  title: string;
  body: string;
  email: string;
  signOutLabel: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <PanelCard className="w-full max-w-md text-center">
        <AlertIcon
          className="mx-auto h-8 w-8"
          style={{ color: "var(--danger)" }}
          aria-hidden="true"
        />
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{body}</p>
        <p className="mt-4 truncate text-xs text-[var(--text-muted)]">{email}</p>
        <div className="mt-6">
          <SignOutButton label={signOutLabel} />
        </div>
      </PanelCard>
    </div>
  );
}
