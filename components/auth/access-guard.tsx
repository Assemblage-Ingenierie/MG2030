import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PanelCard } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import { SignOutButton } from "./sign-out-button";
import { AuthUserProvider } from "./auth-context";
import { AccessRequestForm } from "./signup-form";

/**
 * Garde d'accès. Enveloppe tout écran métier.
 *
 * ⚠ Ce n'est PAS la protection des données — c'est la RLS qui l'assure, et
 * elle seule (brief §8). Ce composant choisit l'écran à montrer.
 *
 * Trois refus DISTINCTS, et la distinction n'est pas cosmétique :
 *
 *   • `foreign` — authentifié mais absent de `mg2030_app_user`. Deux
 *     situations s'y ressemblent, et les confondre serait cruel :
 *
 *       — la personne S'EST INSCRITE et attend une affectation. On le lui dit,
 *         avec le nom des administrateurs à contacter ;
 *       — la personne vient de l'AUTRE application du projet (`auth.users` est
 *         partagé, GAPS 52) et n'a rien demandé. Lui afficher « en attente »
 *         la ferait patienter indéfiniment. On lui propose donc de DEMANDER
 *         l'accès, ce qui est l'action utile.
 *
 *     La table `mg2030_access_request` tranche entre les deux.
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
    // Une demande déjà déposée ? La réponse change tout le message.
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const { data: request } = await supabase
      .from("mg2030_access_request")
      .select("status, full_name, created_at")
      .eq("auth_user_id", auth.user?.id ?? "")
      .maybeSingle();

    if (request?.status === "pending") {
      return (
        <Refusal
          title={t("auth.awaitingTitle")}
          body={t("auth.awaitingBody", { admins: ADMIN_CONTACTS })}
          email={state.email}
          signOutLabel={t("common.signOut")}
          tone="wait"
        />
      );
    }

    if (request?.status === "rejected") {
      return (
        <Refusal
          title={t("auth.rejectedTitle")}
          body={t("auth.rejectedBody", { admins: ADMIN_CONTACTS })}
          email={state.email}
          signOutLabel={t("common.signOut")}
        />
      );
    }

    return (
      <Refusal
        title={t("auth.noAccessTitle")}
        body={t("auth.noAccessBody")}
        email={state.email}
        signOutLabel={t("common.signOut")}
        tone="wait"
      >
        <AccessRequestForm
          defaultName={
            (auth.user?.user_metadata?.full_name as string | undefined) ?? ""
          }
        />
      </Refusal>
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

/** Adresses affichées à qui attend une affectation. */
const ADMIN_CONTACTS = "louis@assemblage.net, clement@assemblage.net";

function Refusal({
  title,
  body,
  email,
  signOutLabel,
  tone = "refusal",
  children,
}: {
  title: string;
  body: string;
  email: string;
  signOutLabel: string;
  /**
   * `wait` pour une attente légitime : le rouge du refus dirait « on vous a
   * refusé » à quelqu'un dont le dossier n'a simplement pas encore été traité.
   */
  tone?: "refusal" | "wait";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <PanelCard className="w-full max-w-md text-center">
        <AlertIcon
          className="mx-auto h-8 w-8"
          style={{ color: tone === "wait" ? "var(--accent-2)" : "var(--danger)" }}
          aria-hidden="true"
        />
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-[var(--text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">{body}</p>
        <p className="mt-4 truncate text-xs text-[var(--text-muted)]">{email}</p>
        {children}
        <div className="mt-6">
          <SignOutButton label={signOutLabel} />
        </div>
      </PanelCard>
    </div>
  );
}
