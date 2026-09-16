"use server";

// ============================================================
// Enregistrement des metadonnees d'un document, APRES envoi vers R2.
//
// Le fichier est deja dans R2 quand cette action s execute : elle ne fait
// qu ecrire la ligne. La RLS refuse l ecriture si l appelant n a pas
// document.upload, ou s il tente d attribuer le depot a quelqu un d autre
// (politique mg2030_document_insert, clause uploaded_by = auth.uid()).
// ============================================================

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/server";
import { presignUrl, readR2Config } from "@/lib/r2/presign";

export interface RegisterInput {
  folderId: string;
  objectKey: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  description?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  documentId?: string;
}

export async function registerDocument(input: RegisterInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_document")
    .insert({
      folder_id: input.folderId,
      r2_object_key: input.objectKey,
      original_filename: input.originalFilename,
      size_bytes: input.sizeBytes,
      mime_type: input.mimeType,
      description: input.description ?? null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Le tag par defaut du dossier est applique automatiquement : sans cela, un
  // document depose dans « 02_Procurement » serait visible de tous, ce qui
  // n est pas ce que la structure du dossier laisse attendre.
  const { data: folder } = await supabase
    .from("mg2030_folder")
    .select("default_tag_id")
    .eq("id", input.folderId)
    .maybeSingle();

  if (folder?.default_tag_id) {
    await supabase
      .from("mg2030_document_tag")
      .insert({ document_id: data.id, tag_id: folder.default_tag_id });
  }

  revalidatePath("/library");
  return { ok: true, documentId: data.id as string };
}

/**
 * Supprime un document : la ligne, puis l objet R2.
 *
 * Dans cet ordre, et c est deliberé. La RLS (politique
 * `mg2030_document_delete_own`) n autorise la suppression qu au deposant ou a
 * un administrateur : tant qu elle n a pas tranche, on ne touche pas au
 * stockage. Effacer le fichier d abord, puis se voir refuser la ligne, aurait
 * laisse une entree pointant vers le vide — la pire des deux issues.
 *
 * L echec du DELETE sur R2 n est PAS remonte comme une erreur : le document a
 * bien disparu de la bibliotheque, ce que l utilisateur a demande. Il reste un
 * objet orphelin, qui ne coute que du stockage et qu aucune URL pre-signee ne
 * peut plus atteindre, faute de ligne pour en donner la cle.
 */
export async function deleteDocument(documentId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: doc, error: readError } = await supabase
    .from("mg2030_document")
    .select("r2_object_key")
    .eq("id", documentId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!doc) return { ok: false, error: "not_found" };

  const { error, count } = await supabase
    .from("mg2030_document")
    .delete({ count: "exact" })
    .eq("id", documentId);

  if (error) return { ok: false, error: error.message };
  // Zero ligne supprimee : la RLS a refuse en silence, comme elle le fait
  // toujours. Sans ce test, l ecran annoncerait une suppression qui n a pas eu
  // lieu.
  if (count === 0) return { ok: false, error: "forbidden" };

  const config = readR2Config();
  if (config) {
    try {
      await fetch(presignUrl(config, "DELETE", doc.r2_object_key as string, 60), {
        method: "DELETE",
      });
    } catch {
      // Objet orphelin ; voir le commentaire ci-dessus.
    }
  }

  revalidatePath("/library");
  return { ok: true };
}

/** Description libre du document, modifiable apres coup. */
export async function setDocumentDescription(
  documentId: string,
  description: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = description.trim();

  const { error } = await supabase
    .from("mg2030_document")
    .update({ description: trimmed === "" ? null : trimmed })
    .eq("id", documentId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/library");
  return { ok: true };
}

/** Ajoute ou retire un tag. La RLS verifie que l appelant peut lire le document. */
export async function toggleDocumentTag(
  documentId: string,
  tagId: string,
  attach: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { error } = attach
    ? await supabase.from("mg2030_document_tag").insert({ document_id: documentId, tag_id: tagId })
    : await supabase
        .from("mg2030_document_tag")
        .delete()
        .eq("document_id", documentId)
        .eq("tag_id", tagId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/library");
  return { ok: true };
}
