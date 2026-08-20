import { AppShell } from "@/components/shell/app-shell";
import { AccessGuard } from "@/components/auth/access-guard";
import { NotificationBell } from "@/components/shell/notification-bell";

/**
 * Layout des écrans métier.
 *
 * Le garde d'accès est À L'INTÉRIEUR du cadre applicatif : un compte refusé
 * voit quand même la sidebar et le header, donc il sait où il est et peut se
 * déconnecter. Un écran de refus nu, sans repère, se lit comme une panne.
 *
 * La cloche est un Server Component (elle lit le compteur en base) alors que le
 * cadre est client : elle est donc passée en NŒUD, pas importée par le header.
 * C'est le seul moyen de mêler les deux sans faire descendre une requête dans
 * le navigateur.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell bell={<NotificationBell />}>
      <AccessGuard>{children}</AccessGuard>
    </AppShell>
  );
}
