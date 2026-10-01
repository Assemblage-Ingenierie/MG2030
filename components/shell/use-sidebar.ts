"use client";

// ============================================================
// components/shell/use-sidebar.ts — le menu est-il replié ?
//
// ⚠ C'EST UN RÉGLAGE DE POSTE, PAS UNE DONNÉE DU PROJET. Il reste donc dans le
// navigateur de chacun : il ne traverse ni la base, ni les autres appareils,
// et personne d'autre ne le voit. Le mettre en base aurait voulu dire une
// écriture à chaque clic sur un bouton d'affichage.
//
// `useSyncExternalStore` plutôt qu'un `useEffect` qui appellerait `setState` :
// le stockage local EST un système extérieur à React, et c'est l'outil prévu
// pour en lire l'état. On y gagne trois choses :
//   • le rendu serveur reçoit explicitement « non replié » (`getServerSnapshot`),
//     donc aucune divergence d'hydratation ;
//   • pas de rendu en cascade — ce que la règle `set-state-in-effect` interdit
//     justement ;
//   • deux onglets ouverts restent d'accord, par l'événement `storage`.
//
// Conséquence assumée : qui a replié son menu le voit une image ouvert au
// rechargement. L'éviter demanderait un script bloquant avant la peinture, ou
// un cookie lu par le serveur — cher pour un clignotement d'une frame.
// ============================================================

import { useCallback, useSyncExternalStore } from "react";

const KEY = "mg2030.sidebar";

/** Abonnés du même onglet : `storage` ne se déclenche QUE dans les autres. */
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "closed";
  } catch {
    // Navigation privée, stockage bloqué : le menu reste ouvert, c'est tout.
    return false;
  }
}

function write(collapsed: boolean): void {
  try {
    window.localStorage.setItem(KEY, collapsed ? "closed" : "open");
  } catch {
    // Sans mémoire, le repli vaut pour la session en cours. Suffisant.
  }
  for (const notify of listeners) notify();
}

export function useSidebarCollapsed(): [boolean, () => void] {
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify);
    window.addEventListener("storage", notify);
    return () => {
      listeners.delete(notify);
      window.removeEventListener("storage", notify);
    };
  }, []);

  const collapsed = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => write(!read()), []);

  return [collapsed, toggle];
}
