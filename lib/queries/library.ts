import "server-only";

// ============================================================
// lib/queries/library.ts — arborescence documentaire et documents.
//
// La lecture des documents est gouvernée par les TAGS, indépendamment des trois
// dimensions de droits (brief §8). C'est la RLS qui l'applique : ce module ne
// refiltre rien.
//
// Règle multi-tags : UNION — un seul tag autorisé suffit (décision GAPS 33).
// ============================================================

import { createClient } from "@/lib/supabase/server";

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
  defaultTagCode: string | null;
  documentCount: number;
  children: FolderNode[];
}

export interface DocumentRow {
  id: string;
  folderId: string;
  folderPath: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  description: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
  tags: { code: string; label: string; color: string | null }[];
}

/** Arborescence complète, assemblée en arbre. 39 dossiers au chargement. */
export async function loadFolderTree(): Promise<FolderNode[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("mg2030_folder")
    .select(
      `id, name, path, parent_id, sort_order,
       mg2030_tag ( code ),
       mg2030_document ( count )`,
    )
    .order("path");

  if (error) throw new Error(`Lecture de l'arborescence : ${error.message}`);

  const nodes = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const row of data ?? []) {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_tag: { code: string } | null;
      mg2030_document: { count: number }[];
    };
    nodes.set(r.id as string, {
      id: r.id as string,
      name: r.name as string,
      path: r.path as string,
      parentId: (r.parent_id as string) ?? null,
      defaultTagCode: r.mg2030_tag?.code ?? null,
      documentCount: r.mg2030_document?.[0]?.count ?? 0,
      children: [],
    });
  }

  // Le tri par `path` garantit qu'un parent précède ses enfants.
  for (const node of nodes.values()) {
    if (node.parentId) nodes.get(node.parentId)?.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export async function listDocuments(folderId?: string): Promise<DocumentRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("mg2030_document")
    .select(
      `id, folder_id, original_filename, size_bytes, mime_type, description, uploaded_at,
       mg2030_folder!inner ( path ),
       uploader:mg2030_app_user!mg2030_document_uploaded_by_fkey ( full_name ),
       mg2030_document_tag ( mg2030_tag ( code, label, color ) )`,
    )
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(200);

  if (folderId) query = query.eq("folder_id", folderId);

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des documents : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_folder: { path: string };
      uploader: { full_name: string } | null;
      mg2030_document_tag: { mg2030_tag: { code: string; label: string; color: string | null } }[];
    };
    return {
      id: r.id as string,
      folderId: r.folder_id as string,
      folderPath: r.mg2030_folder.path,
      originalFilename: r.original_filename as string,
      sizeBytes: r.size_bytes as number,
      mimeType: r.mime_type as string,
      description: (r.description as string) ?? null,
      uploadedAt: r.uploaded_at as string,
      uploadedByName: r.uploader?.full_name ?? null,
      tags: (r.mg2030_document_tag ?? []).map((dt) => dt.mg2030_tag),
    };
  });
}

/** Taille lisible. Base 1024, unités décimales — l'usage courant. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}
