import { AppShell } from "@/components/shell/app-shell";
import { AccessGuard } from "@/components/auth/access-guard";
import { AuthUserProvider } from "@/components/auth/auth-context";
import { getAuthState } from "@/lib/auth/server";

/**
 * Layout des écrans métier.
 *
 * Le garde d'accès est À L'INTÉRIEUR du cadre applicatif : un compte refusé
 * voit quand même la sidebar et le header, donc il sait où il est et peut se
 * déconnecter. Un écran de refus nu, sans repère, se lit comme une panne.
 *
 * ⚠ LE FOURNISSEUR D'IDENTITÉ ENVELOPPE LE CADRE, PAS SEULEMENT LE CONTENU.
 * Il vivait dans `AccessGuard`, donc sous le header — `useAuthUser()` y
 * renvoyait `null`, et le menu de compte (avec sa déconnexion) ne s'affichait
 * jamais. Il doit envelopper `AppShell` pour que le header sache qui est
 * connecté.
 *
 * L'onglet Notifications et sa cloche ont été retirés le 25/09/2026. La table
 * et l'évaluation périodique restent en place côté serveur.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();

  const shell = (
    <AppShell>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );

  // Compte en attente, étranger ou anonyme : pas d'identité à fournir. Ces
  // écrans portent leur propre bouton de déconnexion (voir access-guard.tsx).
  return state.status === "active" ? (
    <AuthUserProvider user={state.user}>{shell}</AuthUserProvider>
  ) : (
    shell
  );
}
