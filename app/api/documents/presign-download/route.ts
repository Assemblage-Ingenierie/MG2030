// ============================================================
// Délivre une URL pré-signée de TÉLÉCHARGEMENT, à durée courte.
//
// Le contrôle d'accès documentaire est gouverné par les TAGS, indépendamment
// des trois dimensions de droits (brief §8). Il est appliqué par la RLS : on
// lit la ligne `mg2030_document`, et si elle ne remonte pas, l'appelant n'a
// pas accès. Aucun filtrage applicatif ne double ce contrôle — il donnerait
// l'illusion d'une sécurité qui n'est pas là.
//
// ⚠ Une URL signée échappe à la RLS une fois émise : celui qui la reçoit peut
// la transmettre. D'où les 5 minutes, et non une heure.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { presignUrl, readR2Config } from "@/lib/r2/presign";

const EXPIRES_IN = 300;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const documentId = new URL(request.url).searchParams.get("id");
  if (!documentId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const config = readR2Config();
  if (!config) {
    return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
  }

  // La RLS applique la règle des tags (union : un seul tag autorisé suffit,
  // décision GAPS 33). Une ligne absente signifie « pas d'accès », et on ne
  // distingue pas ce cas de « document inexistant » : le faire révélerait
  // l'existence d'un document qu'on n'a pas le droit de voir.
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("mg2030_document")
    .select("r2_object_key, original_filename, mime_type")
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const downloadUrl = presignUrl(
    config,
    "GET",
    document.r2_object_key as string,
    EXPIRES_IN,
  );

  return NextResponse.json({
    downloadUrl,
    filename: document.original_filename,
    mimeType: document.mime_type,
    expiresIn: EXPIRES_IN,
  });
}
