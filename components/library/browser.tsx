"use client";

// ============================================================
// components/library/browser.tsx — le contenu d'une partie, d'un seul coup.
//
// ⚠ TOUT EST DÉJÀ CHARGÉ : DÉPLIER NE DEMANDE RIEN AU SERVEUR.
//
// Chaque sous-dossier était un lien : cliquer rechargeait la page, refaisait
// l'arborescence, la liste des documents et celle des étiquettes, pour ne
// changer qu'un tableau. D'où l'attente signalée le 01/10/2026 — « il y a un
// lag quand on clique sur un dossier ». La page charge maintenant la BRANCHE
// ENTIÈRE de la partie sélectionnée, et le dépliement est un état local :
// instantané, et sans aller-retour.
//
// ⚠ LES DOCUMENTS SONT SOUS LEUR SOUS-DOSSIER, DÉPLIÉS PAR DÉFAUT.
//
// C'était la question posée : est-ce conforme aux bons usages ? Oui, à une
// condition — que la liste reste courte. Un arbre qui montre son contenu en
// place évite l'aller-retour « j'ouvre, je regarde, je reviens, j'ouvre le
// suivant », qui est le défaut classique d'un explorateur à deux panneaux : on
// ne peut pas comparer, et on perd sa place à chaque retour. En revanche, tout
// déplier sur une partie de deux cents documents produit une page qu'on ne
// parcourt plus.
//
// D'où le compromis : déplié par défaut, repliable d'un clic, et REPLIÉ
// D'OFFICE au-delà d'un seuil (voir `AUTO_COLLAPSE`). Le dossier le plus
// fourni reste alors accessible en un clic, sans que la page devienne un mur.
// ============================================================

import { useMemo, useState } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Card } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { formatDateTime } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";
import { DocumentTags, type TagChoice } from "./document-tags";
import { DocumentActions, DocumentName, DocumentVersion } from "./document-row";
import { DeleteDocumentButton } from "./document-actions";
import { FolderHeading, folderLabel, type FolderView } from "./folder-panel";
import type { FolderChoice } from "./document-row";

export interface BrowserDocument {
  id: string;
  folderId: string;
  folderPath: string;
  originalFilename: string;
  mimeType: string;
  description: string | null;
  version: string | null;
  uploadedAt: string;
  uploadedByName: string | null;
  tags: { id: string; code: string; label: string; color: string | null }[];
}

/**
 * Au-delà de ce nombre de documents dans la partie, les sous-dossiers
 * s'ouvrent repliés. Quarante lignes tiennent sur deux écrans ; deux cents
 * font une page qu'on ne parcourt plus.
 */
const AUTO_COLLAPSE = 40;

export function LibraryBrowser({
  root,
  documents,
  allTags,
  folders,
}: {
  root: FolderView;
  documents: BrowserDocument[];
  allTags: TagChoice[];
  /** Tous les dossiers, pour le sélecteur d'emplacement de la fiche. */
  folders: FolderChoice[];
}) {
  const t = useT();

  const byFolder = useMemo(() => {
    const map = new Map<string, BrowserDocument[]>();
    for (const doc of documents) {
      const found = map.get(doc.folderId);
      if (found) found.push(doc);
      else map.set(doc.folderId, [doc]);
    }
    return map;
  }, [documents]);

  // `null` = on n'a touché à rien, le défaut s'applique. Un `Set` initialisé
  // au défaut se figerait au premier rendu et ne suivrait plus un changement
  // de partie.
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  const openByDefault = documents.length <= AUTO_COLLAPSE;

  const isOpen = (id: string) => overrides.get(id) ?? openByDefault;
  const toggle = (id: string) =>
    setOverrides((previous) => {
      const next = new Map(previous);
      next.set(id, !isOpen(id));
      return next;
    });

  const sections = [
    // Les documents posés DIRECTEMENT dans la partie, avant ses sous-parties :
    // ils n'ont pas de sous-dossier où aller se ranger.
    { folder: root, docs: byFolder.get(root.id) ?? [], isRoot: true },
    ...root.children.map((child) => ({
      folder: child,
      docs: byFolder.get(child.id) ?? [],
      isRoot: false,
    })),
  ];

  const allOpen = sections.every((s) => s.docs.length === 0 || isOpen(s.folder.id));

  return (
    <Card className="overflow-visible">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="truncate text-sm font-semibold text-[var(--text)]">
          {folderLabel(root.name)}
        </h2>
        {documents.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setOverrides(new Map(sections.map((s) => [s.folder.id, !allOpen])))
            }
            className="shrink-0 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            {t(allOpen ? "library.collapseAll" : "library.expandAll")}
          </button>
        )}
      </div>

      {sections.map((section) => {
        if (section.isRoot && section.docs.length === 0) return null;
        const open = isOpen(section.folder.id);

        return (
          <section key={section.folder.id}>
            <FolderHeading
              folder={section.folder}
              isRoot={section.isRoot}
              expanded={section.docs.length > 0 ? open : null}
              onToggle={() => toggle(section.folder.id)}
              siblings={root.children}
            />

            {open && section.docs.length > 0 && (
              <DocumentTable docs={section.docs} allTags={allTags} folders={folders} />
            )}
          </section>
        );
      })}

      {documents.length === 0 && (
        <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">
          {t("library.emptyFolder")}
        </p>
      )}
    </Card>
  );
}

/** Le tableau d'un sous-dossier, ou celui d'une recherche. */
export function DocumentTable({
  docs,
  allTags,
  folders,
  showPath = false,
}: {
  docs: BrowserDocument[];
  allTags: TagChoice[];
  folders: FolderChoice[];
  /**
   * Le chemin n'apparaît QUE dans les résultats de recherche. Sous un
   * intertitre de dossier il répéterait sur chaque ligne ce que l'intertitre
   * vient de dire — c'est pourquoi il a été retiré le 01/10/2026.
   */
  showPath?: boolean;
}) {
  const t = useT();

  return (
    <Table className="min-w-[720px]">
      <Thead>
        <Th className="w-[44%]">{t("library.file")}</Th>
        <Th>{t("library.version")}</Th>
        <Th>{t("library.tags")}</Th>
        <Th align="right">{t("library.uploaded")}</Th>
        <Th align="right">{t("library.actions")}</Th>
      </Thead>
      <tbody>
        {docs.map((doc) => (
          <Tr key={doc.id}>
            <Td>
              <DocumentName doc={doc} />
              {showPath && (
                <span className="mt-0.5 block font-mono text-[11px] text-[var(--text-muted)]">
                  {doc.folderPath}
                </span>
              )}
            </Td>
            <Td>
              <DocumentVersion doc={doc} />
            </Td>
            <Td>
              <DocumentTags documentId={doc.id} tags={doc.tags} allTags={allTags} />
            </Td>
            <Td align="right" className="whitespace-nowrap text-xs tabular-nums">
              <span className="block">{formatDateTime(doc.uploadedAt)}</span>
              <span className="block text-[var(--text-muted)]">{doc.uploadedByName ?? "—"}</span>
            </Td>
            <Td align="right">
              <span className="flex items-center justify-end gap-0.5">
                <DocumentActions doc={doc} folders={folders} />
                <DeleteDocumentButton documentId={doc.id} filename={doc.originalFilename} />
              </span>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Résultats de recherche : à plat, avec le chemin, sans arborescence. */
export function SearchResults({
  documents,
  allTags,
  folders,
  query,
}: {
  documents: BrowserDocument[];
  allTags: TagChoice[];
  folders: FolderChoice[];
  query: string;
}) {
  const t = useT();

  return (
    <Card className="overflow-visible">
      <p className="border-b border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)]">
        {t("library.searchResults", { count: String(documents.length), query })}
      </p>
      {documents.length === 0 ? (
        <p className={cn("px-3 py-8 text-center text-sm text-[var(--text-muted)]")}>
          {t("library.searchEmpty")}
        </p>
      ) : (
        <DocumentTable docs={documents} allTags={allTags} folders={folders} showPath />
      )}
    </Card>
  );
}
