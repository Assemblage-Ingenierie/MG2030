// ============================================================
// app/auth/callback/route.ts — échange du code Supabase contre une session.
//
// Point de retour UNIQUE pour tout lien envoyé par e-mail : réinitialisation
// de mot de passe aujourd'hui, confirmation d'adresse le cas échéant. Supabase
// redirige ici avec un paramètre `code` ; on l'échange contre une session,
// puis on suit `next` (jamais une valeur en dur) vers l'écran qui a du sens
// pour CE lien précis.
//
// ⚠ `next` N'ACCEPTE QU'UN CHEMIN INTERNE — même filtre que /login (voir
// `safeRedirect` ci-dessous). Sans lui, ce point d'entrée deviendrait une
// redirection ouverte : quiconque construit un lien avec `next=` pointant
// ailleurs.
// ============================================================

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirect(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Code absent ou refusé — lien expiré, déjà utilisé, ou altéré. On renvoie
  // vers la connexion plutôt que vers un écran d'erreur générique : la
  // personne peut redemander un lien depuis là.
  return NextResponse.redirect(`${origin}/login`);
}

function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
