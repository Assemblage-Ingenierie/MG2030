import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth/server";
import { getI18n } from "@/lib/i18n/server";
import { PanelCard } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { FunderMark, KosovoEmblem } from "@/components/shell/brand-mark";
import { LanguageSwitch } from "@/components/shell/language-switch";

/**
 * Connexion.
 *
 * L'inscription est LIBRE depuis le 21/08/2026, mais elle ne donne accès à
 * rien : le compte créé n'est membre d'aucun projet tant qu'un administrateur
 * ne l'a pas rattaché. Le brief §3 prévoyait des comptes créés à la main ;
 * en ouvrir une trentaine ainsi s'est révélé impraticable, et le modèle de
 * droits rend l'ouverture sans danger.
 *
 * LA BASCULE DE LANGUE EST ICI, avant la connexion. Les utilisateurs sont
 * des agents du ministère à Prishtina : leur demander de se connecter en
 * anglais pour découvrir ensuite qu'un albanais existait prenait le problème
 * à l'envers. La bascule passe par une Server Action et fonctionne donc sans
 * session comme sans JavaScript.
 *
 * Les logos institutionnels y sont aussi. C'est le premier écran que voit
 * chacun, et l'unique qui doit tenir seul : bailleur et maître d'ouvrage y
 * disent de quelle plateforme il s'agit.
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
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-4 py-8">
      <PanelCard className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3">
          {/* Bailleur, séparateur, maître d'ouvrage — même ordre que le header. */}
          <div className="flex items-center gap-3">
            <FunderMark />
            <span className="h-9 w-px bg-[var(--border)]" aria-hidden="true" />
            <KosovoEmblem className="h-[38px] w-auto" />
            <span className="sr-only">{t("app.owner")}</span>
          </div>
          <h1 className="text-center text-lg font-semibold tracking-tight text-[var(--text)]">
            {t("app.name")}
          </h1>
          <p className="text-center text-sm text-[var(--text-muted)]">{t("app.subtitle")}</p>
        </div>

        <LoginForm redirectTo={safeRedirect(target)} />

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          {t("auth.noAccount")}{" "}
          <Link href="/signup" className="underline" style={{ color: "var(--accent)" }}>
            {t("auth.createAccount")}
          </Link>
        </p>
      </PanelCard>

      <LanguageSwitch />
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
