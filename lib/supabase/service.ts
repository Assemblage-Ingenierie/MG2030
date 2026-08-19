import "server-only";

// ============================================================
// lib/supabase/service.ts — client à RÔLE DE SERVICE.
//
// ⚠ CE CLIENT CONTOURNE LA RLS. C'est le seul de l'application, et il n'a
// qu'un usage : la route d'évaluation périodique `/api/cron/schedule-checks`.
//
// POURQUOI IL EST NÉCESSAIRE. Le brief §7 demande des notifications de
// « franchissement de jalon » et de « retard ». Ce sont des ÉTATS, pas des
// événements : personne ne fait l'action de dépasser une échéance. Il faut donc
// une évaluation périodique, déclenchée par un ordonnanceur — qui n'a pas de
// session utilisateur. Sans session, `auth.uid()` est nul et la RLS masque
// tout : le travail verrait zéro ligne et n'écrirait rien.
//
// POURQUOI CE N'EST PAS UN CONTOURNEMENT DE LA RÈGLE. Le brief §8 interdit de
// remplacer la RLS par du filtrage applicatif pour l'accès des UTILISATEURS.
// Ici l'acteur n'est pas un utilisateur : c'est un travail système, qui
// n'expose aucune donnée — il écrit des notifications destinées au responsable
// déjà désigné de chaque tâche.
//
// GARDE-FOUS :
//   • une seule route l'importe, et un lint le vérifie (scripts/check-service-key.mjs) ;
//   • la route exige un secret partagé (`CRON_SECRET`) ;
//   • le client n'est jamais transmis à un composant ni à une action ;
//   • la clé n'est PAS préfixée `NEXT_PUBLIC_` : elle ne peut pas fuir au
//     navigateur.
// ============================================================

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY absente. Elle n'est requise que par " +
        "/api/cron/schedule-checks ; le reste de l'application n'en a pas besoin.",
    );
  }

  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
