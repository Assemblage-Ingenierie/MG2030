"use client";

// ============================================================
// Utilisateur courant, mis à disposition des Client Components.
// Fourni UNE FOIS par le garde d'accès : aucun composant client ne requête
// la base pour savoir qui il est.
// ============================================================

import { createContext, useContext } from "react";
import type { AppUser } from "@/lib/auth/types";
import { canDo, canWrite, isPlatformAdmin } from "@/lib/auth/types";

const AuthUserContext = createContext<AppUser | null>(null);

export function AuthUserProvider({
  user,
  children,
}: {
  user: AppUser;
  children: React.ReactNode;
}) {
  return <AuthUserContext.Provider value={user}>{children}</AuthUserContext.Provider>;
}

/** `null` hors du garde d'accès (page de connexion, écrans de refus). */
export function useAuthUser(): AppUser | null {
  return useContext(AuthUserContext);
}

/**
 * Confort d'interface : masquer un bouton dont l'action serait refusée.
 * Ne remplace JAMAIS la RLS — c'est elle qui protège les données (brief §8).
 */
export function usePermissions() {
  const user = useAuthUser();
  return {
    user,
    isAdmin: isPlatformAdmin(user),
    canWrite: canWrite(user),
    can: (permission: string) => canDo(user, permission),
  };
}
