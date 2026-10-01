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
  /** Version telle que le projet l'écrit : V1.0, Rev B… (migration 0044). */
  version: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
  tags: { id: string; code: string; label: string; color: string | null }[];
}

export interface TagOption {
  id: string;
  code: string;
  label: string;
  color: string | null;
}

/** Arborescence complète, assemblée en arbre. 39 dossiers au chargement. */
export async function loadFolderTree(): Promise<FolderNode[]> {
  const supabase = await createClient();

  /* ⚠ ORDRE PAR `sort_order`, PUIS par chemin. L'arbre se triait sur le seul
     chemin, c'est-à-dire alphabétiquement : le rang existait en base mais rien
     ne le lisait, et réordonner un dossier n'avait aucun effet visible. Le
     chemin reste le départage — deux frères de même rang se rangent alors
     comme avant, et l'ordre ne saute pas. */
  const { data, error } = await supabase
    .from("mg2030_folder")
    .select(
      `id, name, path, parent_id, sort_order,
       mg2030_tag ( code ),
       mg2030_document ( count )`,
    )
    .order("sort_order")
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

  /* Deux temps, et c'est nécessaire depuis le tri par rang : un parent ne
     précède plus forcément ses enfants dans la liste, puisque les rangs sont
     comparés sans tenir compte de la profondeur. On a d'abord créé TOUS les
     nœuds (boucle ci-dessus), on les rattache seulement maintenant. */
  for (const node of nodes.values()) {
    if (node.parentId) nodes.get(node.parentId)?.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export interface DocumentQuery {
  /**
   * Dossiers retenus. On charge la BRANCHE ENTIÈRE d'une partie et non un seul
   * dossier : l'écran montre les documents sous chaque sous-partie, et les
   * demander dossier par dossier voudrait dire un aller-retour serveur à
   * chaque dépliement — c'est précisément la lenteur signalée le 01/10/2026.
   */
  folderIds?: string[];
  /** Recherche libre, sur le nom de fichier et sur la description. */
  search?: string;
}

export async function listDocuments(q: DocumentQuery = {}): Promise<DocumentRow[]> {
  const supabase = await createClient();

  // Une liste de dossiers VIDE veut dire « aucun », pas « tous ». Sans ce
  // court-circuit, une partie sans dossier afficherait toute la bibliothèque.
  if (q.folderIds && q.folderIds.length === 0) return [];

  let query = supabase
    .from("mg2030_document")
    .select(
      `id, folder_id, original_filename, size_bytes, mime_type, description, version, uploaded_at,
       mg2030_folder!inner ( path ),
       uploader:mg2030_app_user!mg2030_document_uploaded_by_fkey ( full_name ),
       mg2030_document_tag ( mg2030_tag ( id, code, label, color ) )`,
    )
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(200);

  if (q.folderIds) query = query.in("folder_id", q.folderIds);

  const search = q.search?.trim() ?? "";
  if (search !== "") {
    /* ⚠ LES JOKERS DE L'UTILISATEUR SONT ÉCHAPPÉS. Un `%` tapé dans la barre
       de recherche signifierait « n'importe quoi » et un `_` « n'importe quel
       caractère » : la recherche rendrait des résultats que personne ne
       comprend. La barre oblique inverse d'abord, sinon on échapperait les
       échappements eux-mêmes. */
    const safe = search.replace(/\\/g, "\\\\").replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(`original_filename.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Lecture des documents : ${error.message}`);

  return (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown> & {
      mg2030_folder: { path: string };
      uploader: { full_name: string } | null;
      mg2030_document_tag: {
        mg2030_tag: { id: string; code: string; label: string; color: string | null };
      }[];
    };
    return {
      id: r.id as string,
      folderId: r.folder_id as string,
      folderPath: r.mg2030_folder.path,
      originalFilename: r.original_filename as string,
      sizeBytes: r.size_bytes as number,
      mimeType: r.mime_type as string,
      description: (r.description as string) ?? null,
      version: (r.version as string) ?? null,
      uploadedAt: r.uploaded_at as string,
      uploadedByName: r.uploader?.full_name ?? null,
      tags: (r.mg2030_document_tag ?? []).map((dt) => dt.mg2030_tag),
    };
  });
}

/** Identifiants d'un dossier et de toute sa descendance, lui compris. */
export function branchIds(node: FolderNode): string[] {
  return [node.id, ...node.children.flatMap(branchIds)];
}

/**
 * Tous les dossiers à plat, indentés, pour un sélecteur d'emplacement.
 *
 * L'indentation tient lieu de chemin : « Procurement » tout court serait
 * ambigu dès qu'un sous-dossier du même nom existe ailleurs, et choisir un
 * emplacement demande précisément de savoir où l'on est.
 */
export function flatten(nodes: FolderNode[], depth = 0): { id: string; label: string }[] {
  return nodes.flatMap((node) => [
    { id: node.id, label: `${"\u00a0\u00a0\u00a0".repeat(depth)}${node.name}` },
    ...flatten(node.children, depth + 1),
  ]);
}

/**
 * Nombre de documents d'un dossier ET de toute sa descendance.
 *
 * La colonne de gauche ne montre que les grandes parties : un « 0 » en face de
 * « Procurement » alors que ses sous-dossiers en contiennent quarante ferait
 * croire la partie vide, et personne ne cliquerait.
 */
export function branchCount(node: FolderNode): number {
  return node.documentCount + node.children.reduce((n, c) => n + branchCount(c), 0);
}

/** Retrouve un dossier dans l'arbre, et la racine dont il descend. */
export function locate(
  nodes: FolderNode[],
  id: string | null,
): { folder: FolderNode | null; root: FolderNode | null } {
  if (id === null) return { folder: null, root: null };

  const walk = (node: FolderNode, root: FolderNode): FolderNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = walk(child, root);
      if (found) return found;
    }
    return null;
  };

  for (const root of nodes) {
    const found = walk(root, root);
    if (found) return { folder: found, root };
  }
  return { folder: null, root: null };
}

/**
 * Tous les tags, pour les proposer à l'ajout.
 *
 * 4 lignes en système (GAPS §7) : lus en bloc, sans pagination.
 */
export async function listTagOptions(): Promise<TagOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("mg2030_tag")
    .select("id, code, label, color")
    .order("label");

  if (error) throw new Error(`Lecture des tags : ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    code: r.code as string,
    label: r.label as string,
    color: (r.color as string) ?? null,
  }));
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
