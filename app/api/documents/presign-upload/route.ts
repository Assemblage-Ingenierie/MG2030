// ============================================================
// Délivre une URL pré-signée pour un dépôt DIRECT vers R2.
//
// Le fichier ne traverse JAMAIS cette route : elle ne renvoie qu'une URL. Le
// brief §4 l'impose (limite de charge utile des fonctions serveur), et c'est
// aussi ce qui permet de déposer un fichier de plusieurs gigaoctets.
//
// Contrôles effectués ici, avant de signer :
//   • l'appelant est un membre MG2030 actif ET porteur de `document.upload` ;
//   • le dossier existe et lui est visible — vérifié PAR LA RLS, en lisant la
//     ligne : si elle ne remonte pas, il n'y a pas accès ;
//   • le type et la taille sont acceptables.
//
// Une URL signée est un droit d'accès transportable : elle échappe à la RLS une
// fois émise. D'où la durée courte et les contrôles préalables.
// ============================================================

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { canDo } from "@/lib/auth/types";
import { buildObjectKey, presignUrl, readR2Config } from "@/lib/r2/presign";

/** 5 Go : au-delà, S3 impose un envoi en plusieurs parties. */
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

/**
 * Types refusés parce qu'exécutables ou porteurs de macros.
 *
 * Ce n'est PAS un antivirus — il n'y en a pas (docs/GAPS.md point 36). C'est
 * un garde-fou minimal contre le dépôt accidentel d'un exécutable dans une
 * bibliothèque documentaire consultée par 30 personnes.
 */
const BLOCKED = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-sh",
  "application/x-executable",
  "application/vnd.microsoft.portable-executable",
];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (!canDo(user, "document.upload")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const config = readR2Config();
  if (!config) {
    // Configuration absente : on le dit clairement plutôt que de renvoyer une
    // URL invalide que le navigateur échouerait à utiliser sans explication.
    return NextResponse.json({ error: "r2_not_configured" }, { status: 503 });
  }

  let body: { folderId?: string; filename?: string; mimeType?: string; size?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { folderId, filename, mimeType, size } = body;
  if (!folderId || !filename || !mimeType || typeof size !== "number") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "size_out_of_range" }, { status: 400 });
  }
  if (BLOCKED.includes(mimeType)) {
    return NextResponse.json({ error: "mime_type_blocked" }, { status: 400 });
  }

  // C'est la RLS qui décide : si le dossier ne remonte pas, l'appelant n'y a
  // pas accès. On ne refait pas le contrôle de périmètre en applicatif.
  const supabase = await createClient();
  const { data: folder } = await supabase
    .from("mg2030_folder")
    .select("id, path")
    .eq("id", folderId)
    .maybeSingle();

  if (!folder) {
    return NextResponse.json({ error: "folder_not_found" }, { status: 404 });
  }

  const objectKey = buildObjectKey(folder.path as string, filename);
  const uploadUrl = presignUrl(config, "PUT", objectKey, 900, {
    "content-type": mimeType,
  });

  return NextResponse.json({
    uploadUrl,
    objectKey,
    // 15 minutes : de quoi téléverser un gros fichier sur une liaison lente,
    // sans laisser traîner un droit d'écriture.
    expiresIn: 900,
    requiredHeaders: { "content-type": mimeType },
  });
}
