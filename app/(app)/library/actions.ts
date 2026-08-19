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
