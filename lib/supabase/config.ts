// ============================================================
// lib/supabase/config.ts — lecture et validation de la configuration.
// ISOMORPHE : ces deux variables sont publiques (préfixe NEXT_PUBLIC_).
//
// On échoue au démarrage plutôt qu'à la première requête : une application qui
// se lance sans base et rend des pages vides est plus coûteuse à diagnostiquer
// qu'une qui refuse de démarrer.
// ============================================================

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Copier .env.example en .env.local et la renseigner.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
