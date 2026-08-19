"use server";

// ============================================================
// app/actions/locale.ts — changement de langue, côté serveur.
//
// Écrire le cookie ici plutôt que par `document.cookie` a trois avantages :
//   • la bascule fonctionne SANS JavaScript (le bouton est un <button> de
//     formulaire) — utile sur un poste bridé, fréquent en administration ;
//   • aucune mutation d'objet global côté client, donc rien à réconcilier avec
//     le rendu React ;
//   • `revalidatePath` force le re-rendu des Server Components dans la nouvelle
//     langue, sans rechargement complet.
// ============================================================

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

export async function setLocale(formData: FormData): Promise<void> {
  const requested = formData.get("locale");
  // Une valeur inconnue retombe sur l'anglais : ce champ vient du client, il
  // n'est jamais digne de confiance.
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    // Pas `httpOnly` : aucune information sensible, et un futur composant
    // client pourrait avoir besoin de lire la préférence.
    httpOnly: false,
  });

  revalidatePath("/", "layout");
}
