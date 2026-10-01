"use client";

// ============================================================
// components/shell/app-shell.tsx — cadre applicatif : sidebar + header + contenu.
//
// `min-w-0` sur la colonne de contenu est INDISPENSABLE : sans lui, les tableaux
// larges et le Gantt débordent sur la sidebar en fenêtre réduite.
// ============================================================

import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { hiddenRouteFor } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { AlertIcon } from "@/components/ui/icons";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useSidebarCollapsed } from "./use-sidebar";

/** Ce que le serveur a résolu du menu. Voir app/(app)/layout.tsx. */
export interface NavState {
  isAdmin: boolean;
  isTa: boolean;
  /** Sérialisé en tableau : un `Set` ne traverse pas la frontière serveur. */
  hidden: string[];
}

export function AppShell({
  children,
  nav,
  /** Rendu côté serveur puis transmis : voir app/(app)/layout.tsx. */
  bell,
}: {
  children: React.ReactNode;
  nav: NavState;
  bell?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);

  /* Replié ou non : voir use-sidebar.ts. Le réglage vit dans le navigateur de
     chacun — c'est une commodité de poste, pas une donnée du projet — et le
     rendu serveur part toujours de « déplié ». */
  const [collapsed, toggleSidebar] = useSidebarCollapsed();

  const t = useT();
  const pathname = usePathname();

  const hidden = useMemo(() => new Set(nav.hidden), [nav.hidden]);

  // Un onglet retiré du menu mais qu'un signet rouvre n'est pas masqué, il est
  // seulement discret. L'administrateur, lui, garde l'accès : c'est souvent
  // lui qui finit le module.
  //
  // ⚠ C'est un refus d'AFFICHAGE : la page a déjà été rendue côté serveur
  // quand on arrive ici. Ce qui protège les données reste la RLS, et elle
  // seule (brief §8).
  const blocked = nav.isAdmin ? null : hiddenRouteFor(pathname, hidden);

  return (
    <div
      /* ⚠ ON RETIRE LA GRILLE, ON NE MET PAS SA PREMIÈRE COLONNE À ZÉRO.
         Essayé d'abord : `lg:grid-cols-[0_minmax(0,1fr)]` avec le volet en
         `lg:hidden`. Or `display: none` SORT l'élément du placement de la
         grille — le contenu devenait alors le premier enfant et atterrissait
         dans la colonne de zéro pixel. La page entière se retrouvait large de
         cent cinquante pixels. Sans grille, le contenu s'étale simplement. */
      className={cn(
        "min-h-screen",
        !collapsed && "lg:grid lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      {/* Replié, la colonne fait zéro : le volet doit disparaître AVEC elle,
          sinon son contenu déborde sur la page. Le tiroir mobile, lui, est
          `fixed` et reste commandé par le bouton hamburger — `lg:hidden` ne
          le concerne pas. */}
      <Sidebar
        mobileOpen={mobileOpen}
        onNavigate={close}
        nav={nav}
        hidden={hidden}
        className={collapsed ? "lg:hidden" : undefined}
      />

      {mobileOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          onClick={close}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <div className="flex min-h-screen min-w-0 flex-col">
        <Header
          onMenu={() => setMobileOpen(true)}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={collapsed}
          bell={bell}
        />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          {blocked ? (
            <Card className="mx-auto max-w-md p-8 text-center">
              <AlertIcon
                className="mx-auto h-7 w-7"
                style={{ color: "var(--text-muted)" }}
                aria-hidden="true"
              />
              <p className="mt-3 text-sm text-[var(--text-muted)]">{t("nav.hiddenTab")}</p>
            </Card>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
