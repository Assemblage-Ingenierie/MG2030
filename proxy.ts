// ============================================================
// proxy.ts — rafraîchissement de la session Supabase à chaque requête.
//
// Next 16 remplace la convention `middleware.ts` par `proxy.ts` (même rôle,
// même API). Le dépôt de charte utilise déjà cette convention.
//
// Rôle EXACT et limité : renouveler le jeton et propager les cookies. Il ne
// décide PAS des droits — c'est la RLS qui le fait, et elle seule (brief §8).
// Un middleware qui autoriserait serait un filtrage applicatif, précisément ce
// que le brief interdit.
//
// Il redirige tout de même les visiteurs sans session vers /login : sans cela,
// chaque page rendrait un écran vide plutôt qu'un formulaire de connexion.
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes accessibles sans session. */
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/error",
  // Revue de charte : aucune donnée projet, et son propre layout exige une
  // session EN PRODUCTION (app/design-system/layout.tsx). Hors production,
  // elle reste ouverte pour qu'on puisse relire la charte avant même qu'un
  // compte n'existe.
  "/design-system",
];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Cet appel DOIT rester juste après la création du client et avant tout
  // retour : c'est lui qui déclenche le renouvellement du jeton.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // On mémorise la destination pour y revenir après connexion.
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    "/((?!_next/static|_next/image|favicon.ico|logos/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
