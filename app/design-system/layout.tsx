import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getAuthState } from "@/lib/auth/server";
import { isTechnicalAssistance } from "@/lib/auth/types";
import { AuthUserProvider } from "@/components/auth/auth-context";

/**
 * Revue de charte — cadre applicatif SANS garde d'accès.
 *
 * Cette page ne lit aucune donnée projet : elle n'affiche que des tokens et
 * quelques valeurs d'exemple écrites en dur. Elle est donc accessible sans
 * session EN DÉVELOPPEMENT, pour que la charte puisse être relue avant même
 * qu'un compte n'existe — le premier administrateur se crée par SQL
 * (docs/ADMIN.md), et il serait absurde d'exiger cette manipulation pour
 * regarder des couleurs.
 *
 * EN PRODUCTION, elle exige une session : une page interne accessible
 * publiquement est le genre de commodité qui survit au déploiement.
 */
export default async function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getAuthState();
  // En production, écran réservé à l'assistance technique (25/09/2026) : un
  // autre compte reçoit une page introuvable, comme sans session.
  if (
    process.env.NODE_ENV === "production" &&
    (state.status !== "active" || !isTechnicalAssistance(state.user))
  ) {
    notFound();
  }

  const shell = <AppShell>{children}</AppShell>;
  // Identité fournie au cadre, pour que la barre latérale sache quels items
  // montrer — dont celui-ci.
  return state.status === "active" ? (
    <AuthUserProvider user={state.user}>{shell}</AuthUserProvider>
  ) : (
    shell
  );
}
