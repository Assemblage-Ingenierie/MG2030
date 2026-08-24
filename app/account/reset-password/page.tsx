import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { PanelCard } from "@/components/ui/card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/**
 * Pose du nouveau mot de passe, après le lien reçu par e-mail.
 *
 * ⚠ Hors du groupe `(app)` DÉLIBÉRÉMENT : la personne qui arrive ici porte une
 * session de RÉCUPÉRATION valide (posée par /auth/callback), mais n'est pas
 * forcément membre de MG2030 — parfois même l'inverse : c'est précisément le
 * cas d'un compte étranger au projet qui a oublié le mot de passe de l'autre
 * application (`auth.users` est partagé, GAPS 52). Le garde d'accès du groupe
 * `(app)` la renverrait vers l'écran d'attente avant qu'elle ait pu changer
 * quoi que ce soit.
 *
 * Sans session du tout, on renvoie vers la demande : personne n'atterrit ici
 * par un lien direct sans être passé par /auth/callback.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password");

  const { t } = await getI18n();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <PanelCard className="w-full max-w-sm">
        <h1 className="text-center text-lg font-semibold tracking-tight text-[var(--text)]">
          {t("auth.resetPasswordTitle")}
        </h1>
        <p className="mt-1 text-center text-sm text-[var(--text-muted)]">{data.user.email}</p>

        <ResetPasswordForm />
      </PanelCard>
    </div>
  );
}
