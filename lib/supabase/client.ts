"use client";

// ============================================================
// lib/supabase/client.ts — client Supabase pour le NAVIGATEUR.
//
// Ne jamais y mettre de clé de service. La clé publiable ne donne aucun droit
// par elle-même : tout passe par la RLS, qui exige une ligne dans
// `mg2030_app_user` (docs/SCHEMA.md §1).
// ============================================================

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
