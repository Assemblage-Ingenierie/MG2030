import { AppShell } from "@/components/shell/app-shell";
import { AccessGuard } from "@/components/auth/access-guard";

/**
 * Layout des écrans métier.
 *
 * Le garde d'accès est À L'INTÉRIEUR du cadre applicatif : un compte refusé
 * voit quand même la sidebar et le header, donc il sait où il est et peut se
 * déconnecter. Un écran de refus nu, sans repère, se lit comme une panne.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );
}
