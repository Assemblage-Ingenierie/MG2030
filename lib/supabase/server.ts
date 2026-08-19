import "server-only";

// ============================================================
// lib/supabase/server.ts — client Supabase pour les Server Components,
// Server Actions et Route Handlers.
//
// Le client lit et écrit les cookies de session via `next/headers`. Dans un
// Server Component, l'écriture de cookie est refusée par Next : c'est normal,
// le rafraîchissement de session est fait par le middleware. On avale donc
// l'erreur, comme le recommande la documentation @supabase/ssr.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export async function createClient() {
  const store = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : Next interdit d'y écrire un
          // cookie. Sans conséquence, le middleware s'en charge à la requête
          // suivante.
        }
      },
    },
  });
}
