"use client";

// ============================================================
// components/shell/account-menu.tsx — nom du compte et déconnexion.
//
// ⚠ La déconnexion n'existait QUE sur les écrans de refus (compte en attente,
// compte étranger). Un membre pleinement actif n'avait AUCUN moyen de se
// déconnecter depuis l'application — signalé après qu'un utilisateur s'est
// retrouvé bloqué sans bouton visible.
//
// `details/summary` natif : pas de dépendance, se ferme au clic extérieur et
// à Échap sans code JavaScript supplémentaire.
// ============================================================

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/i18n/i18n-context";
import { useAuthUser } from "@/components/auth/auth-context";

export function AccountMenu() {
  const t = useT();
  const user = useAuthUser();
  const router = useRouter();
  const [pending, start] = useTransition();

  if (!user) return null;

  function signOut() {
    start(async () => {
      await createClient().auth.signOut();
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <details className="relative">
      <summary
        className={
          "flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-1 " +
          "text-sm text-[var(--text)] hover:bg-[var(--app-bg)]"
        }
      >
        <span
          aria-hidden="true"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
          style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
        >
          {initials(user.fullName)}
        </span>
        <span className="hidden max-w-[140px] truncate sm:inline">{user.fullName}</span>
      </summary>

      <div
        className={
          "absolute right-0 z-30 mt-1 w-56 rounded-md border border-[var(--border)] " +
          "bg-[var(--surface)] p-1 shadow-lg"
        }
      >
        <div className="border-b border-[var(--border)] px-3 py-2">
          <p className="truncate text-sm font-medium text-[var(--text)]">{user.fullName}</p>
          <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{user.role.title}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={signOut}
          className="mt-1 w-full rounded px-3 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--app-bg)] disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("common.signOut")}
        </button>
      </div>
    </details>
  );
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length >= 2 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
