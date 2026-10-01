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

// ── Métadonnées d'un document ───────────────────────────────────────────────

/**
 * Renomme un document.
 *
 * ⚠ LE NOM AFFICHÉ, PAS LA CLÉ R2. `r2_object_key` identifie l'objet stocké et
 * ne bouge jamais : la renommer casserait le lien vers le fichier. Seul
 * `original_filename` change — c'est lui que l'écran montre, et c'est lui que
 * la route de téléchargement pose en `Content-Disposition`.
 */
export async function renameDocument(
  documentId: string,
  filename: string,
): Promise<ActionResult> {
  const clean = filename.trim();
  if (clean === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_document")
    .update({ original_filename: clean }, { count: "exact" })
    .eq("id", documentId);

  if (error) return { ok: false, error: error.message };
  // Zéro ligne : la RLS a refusé en silence. Sans ce test, l'écran annoncerait
  // un renommage qui n'a pas eu lieu.
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/library");
  return { ok: true };
}

/** Version telle que le projet l'écrit — texte libre (migration 0044). */
export async function setDocumentVersion(
  documentId: string,
  version: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const clean = version.trim();

  const { error, count } = await supabase
    .from("mg2030_document")
    .update({ version: clean === "" ? null : clean }, { count: "exact" })
    .eq("id", documentId);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/library");
  return { ok: true };
}

// ── Dossiers ────────────────────────────────────────────────────────────────
//
// Les politiques existent depuis l'origine (`folder.admin`) : il n'y avait
// simplement aucun écran pour les exercer, et créer un dossier demandait du
// SQL. Depuis la migration 0037, `folder.admin` vaut pour tout éditeur.

export async function createFolder(
  parentId: string | null,
  name: string,
): Promise<ActionResult> {
  const clean = name.trim();
  if (clean === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();

  // Rang en queue de fratrie : un dossier créé s'ajoute à la fin, il ne
  // s'insère pas au milieu de l'ordre que quelqu'un a posé.
  const siblings = supabase.from("mg2030_folder").select("sort_order");
  const { data: last } = await (parentId === null
    ? siblings.is("parent_id", null)
    : siblings.eq("parent_id", parentId)
  )
    .order("sort_order", { ascending: false })
    .limit(1);

  const rank = ((last?.[0]?.sort_order as number) ?? 0) + 10;

  const { error } = await supabase
    .from("mg2030_folder")
    .insert({ parent_id: parentId, name: clean, sort_order: rank });

  // `unique (parent_id, name)` : deux dossiers frères ne portent pas le même
  // nom, sinon le chemin matérialisé entrerait en collision.
  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicateFolder" : error.message };
  }

  revalidatePath("/library");
  return { ok: true };
}

export async function renameFolder(folderId: string, name: string): Promise<ActionResult> {
  const clean = name.trim();
  if (clean === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  // `path` est recalculé par le déclencheur `folder_set_path` (migration 0012),
  // pour ce dossier ET pour sa descendance : on ne l'écrit pas à la main.
  const { error, count } = await supabase
    .from("mg2030_folder")
    .update({ name: clean }, { count: "exact" })
    .eq("id", folderId);

  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicateFolder" : error.message };
  }
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/library");
  return { ok: true };
}

/**
 * Supprime un dossier VIDE.
 *
 * ⚠ ON NE SUPPRIME PAS CE QU'IL CONTIENT, et contrairement aux sujets de la
 * roadmap on ne délie pas non plus. Un document sans dossier n'existe pas :
 * `folder_id` est obligatoire, et le fichier lui-même vit dans R2 — une ligne
 * orpheline laisserait un objet payant que plus aucune URL ne peut atteindre.
 * La base refuse déjà (`on delete restrict`) ; on traduit son refus en une
 * phrase plutôt qu'en un code d'erreur.
 */
export async function deleteFolder(folderId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const [{ count: docs }, { count: children }] = await Promise.all([
    supabase
      .from("mg2030_document")
      .select("id", { count: "exact", head: true })
      .eq("folder_id", folderId),
    supabase
      .from("mg2030_folder")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", folderId),
  ]);

  if ((docs ?? 0) > 0) return { ok: false, error: "folderHasDocuments" };
  if ((children ?? 0) > 0) return { ok: false, error: "folderHasChildren" };

  const { error, count } = await supabase
    .from("mg2030_folder")
    .delete({ count: "exact" })
    .eq("id", folderId);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/library");
  return { ok: true };
}

/**
 * Déplace un dossier d'un rang parmi ses frères.
 *
 * On ÉCHANGE deux `sort_order`, on ne renumérote pas la fratrie : même raison
 * que pour les sujets de la roadmap — une renumérotation écrit autant de lignes
 * qu'il y a de frères à chaque clic, et deux personnes qui réordonnent en même
 * temps se marchent dessus sur toute la fratrie au lieu de deux lignes.
 */
export async function moveFolder(
  folderId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: me } = await supabase
    .from("mg2030_folder")
    .select("id, parent_id, sort_order")
    .eq("id", folderId)
    .maybeSingle();
  if (!me) return { ok: false, error: "not_found" };

  const parentId = (me.parent_id as string) ?? null;
  const base = supabase.from("mg2030_folder").select("id, sort_order, path");
  const { data: siblings } = await (parentId === null
    ? base.is("parent_id", null)
    : base.eq("parent_id", parentId)
  )
    .order("sort_order")
    .order("path");

  if (!siblings) return { ok: false, error: "not_found" };

  const index = siblings.findIndex((s) => s.id === folderId);
  const other = siblings[index + (direction === "up" ? -1 : 1)];
  // Déjà au bout : rien à faire, et ce n'est pas une erreur.
  if (index === -1 || !other) return { ok: true };

  const [a, b] = await Promise.all([
    supabase.from("mg2030_folder").update({ sort_order: other.sort_order }).eq("id", folderId),
    supabase.from("mg2030_folder").update({ sort_order: me.sort_order }).eq("id", other.id),
  ]);
  if (a.error || b.error) return { ok: false, error: "writeFailed" };

  revalidatePath("/library");
  return { ok: true };
}

// ── Étiquettes ──────────────────────────────────────────────────────────────

/**
 * Crée une étiquette. Réservée à l'administrateur par la RLS.
 *
 * ⚠ CRÉER UNE ÉTIQUETTE NE DONNE ACCÈS À RIEN. La lecture documentaire est
 * gouvernée par `mg2030_tag_access` : une étiquette neuve n'est accordée à
 * personne, donc un document qui ne porterait qu'elle deviendrait invisible de
 * tous sauf d'un administrateur. L'écran le dit — c'est le piège exact qui
 * avait rendu la bibliothèque vide en septembre (migration 0026).
 */
export async function createTag(
  code: string,
  label: string,
  color: string | null,
): Promise<ActionResult> {
  const cleanCode = code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const cleanLabel = label.trim();

  if (cleanCode === "" || cleanLabel === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("mg2030_tag")
    .insert({ code: cleanCode, label: cleanLabel, color: color || null });

  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicateTag" : error.message };
  }

  revalidatePath("/library");
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function renameTag(tagId: string, label: string): Promise<ActionResult> {
  const clean = label.trim();
  if (clean === "") return { ok: false, error: "emptyName" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("mg2030_tag")
    .update({ label: clean }, { count: "exact" })
    .eq("id", tagId);

  if (error) return { ok: false, error: error.message };
  if (count === 0) return { ok: false, error: "forbidden" };

  revalidatePath("/library");
  revalidatePath("/admin/tags");
  return { ok: true };
}
