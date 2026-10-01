import { AppShell } from "@/components/shell/app-shell";
import { AccessGuard } from "@/components/auth/access-guard";
import { AuthUserProvider } from "@/components/auth/auth-context";
import { getAuthState } from "@/lib/auth/server";
import { isPlatformAdmin, isTechnicalAssistance } from "@/lib/auth/types";
import { listHiddenNav } from "@/lib/queries/nav";
import { listAcronyms } from "@/lib/queries/acronyms";
import { GlossaryProvider } from "@/components/acronyms/glossary";

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
  const user = state.status === "active" ? state.user : null;

  // Les onglets masques ne se lisent que pour un compte actif : un anonyme ou
  // un compte etranger n'a de toute facon pas de menu a dessiner, et la RLS
  // refuserait la lecture.
  const hidden = user ? await listHiddenNav() : new Set<string>();

  /* Le GLOSSAIRE accompagne le menu : les sigles se développent au survol sur
     tous les écrans (01/10/2026), donc il se charge là où tous les écrans
     passent. Une seule requête, trente-deux lignes, et `cache()` la partage
     avec l'onglet Acronyms quand c'est lui qu'on ouvre. */
  const acronyms = user ? await listAcronyms() : [];

  const shell = (
    <AppShell
      nav={{
        isAdmin: isPlatformAdmin(user),
        isTa: isTechnicalAssistance(user),
        hidden: [...hidden],
      }}
    >
      <AccessGuard>
        <GlossaryProvider acronyms={acronyms}>{children}</GlossaryProvider>
      </AccessGuard>
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
