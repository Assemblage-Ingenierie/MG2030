"use client";

// ============================================================
// components/shell/app-shell.tsx — cadre applicatif : sidebar + header + contenu.
//
// `min-w-0` sur la colonne de contenu est INDISPENSABLE : sans lui, les tableaux
// larges et le Gantt débordent sur la sidebar en fenêtre réduite.
// ============================================================

import { useCallback, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

export function AppShell({
  children,
  /** Rendu côté serveur puis transmis : voir app/(app)/layout.tsx. */
  bell,
}: {
  children: React.ReactNode;
  bell?: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = useCallback(() => setMobileOpen(false), []);
  const t = useT();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <Sidebar mobileOpen={mobileOpen} onNavigate={close} />

      {mobileOpen && (
        <button
          type="button"
          aria-label={t("nav.closeMenu")}
          onClick={close}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <div className="flex min-h-screen min-w-0 flex-col">
        <Header onMenu={() => setMobileOpen(true)} bell={bell} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
