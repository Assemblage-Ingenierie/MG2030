import { getI18n } from "@/lib/i18n/server";
import {
  branchCount,
  listDocuments,
  listTagOptions,
  loadFolderTree,
  locate,
  type FolderNode,
} from "@/lib/queries/library";
import { formatDateTime } from "@/lib/i18n/format";
import { readR2Config } from "@/lib/r2/presign";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { RootList, SubfolderPanel, type FolderView } from "@/components/library/folder-panel";
import { UploadPanel } from "@/components/library/upload-panel";
import { DocumentTags } from "@/components/library/document-tags";
import {
  DocumentActions,
  DocumentName,
  DocumentVersion,
} from "@/components/library/document-row";
import { DeleteDocumentButton } from "@/components/library/document-actions";

/**
 * Bibliothèque documentaire.
 *
 * Volume cible 10 à 50 Go (brief §4) : les fichiers vivent dans R2, jamais
 * dans Postgres, et l'envoi est direct depuis le navigateur.
 *
 * ⚠ DEUX NIVEAUX DE NAVIGATION, ET C'EST LE SUJET DE L'ÉCRAN. Les trente-neuf
 * dossiers tenaient dans une colonne de 280 px, indentés les uns sous les
 * autres : on y cherchait longtemps la partie dont on venait de lire le nom.
 * Les GRANDES PARTIES restent à gauche, le détail d'une partie s'ouvre à
 * droite. Demandé le 01/10/2026.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { t } = await getI18n();
  const { folder: folderId } = await searchParams;

  const [tree, documents, allTags] = await Promise.all([
    loadFolderTree(),
    listDocuments(folderId),
    listTagOptions(),
  ]);
  const r2Ready = readR2Config() !== null;

  const { folder: selected, root } = locate(tree, folderId ?? null);

  const view = (node: FolderNode): FolderView => ({
    id: node.id,
    name: node.name,
    documentCount: node.documentCount,
    branchCount: branchCount(node),
    children: node.children.map(view),
  });

  const roots = tree.map(view);
  const openRoot = root ? view(root) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section title={t("library.title")} description={t("library.intro")}>
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <Card className="p-2">
            <RootList roots={roots} selectedRootId={root?.id ?? null} />
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            {openRoot && (
              <Card className="overflow-hidden">
                <SubfolderPanel root={openRoot} openId={selected?.id ?? null} />
              </Card>
            )}

            {selected && r2Ready && (
              <UploadPanel folderId={selected.id} folderPath={selected.path} />
            )}

            <Card className="overflow-visible">
              <Table className="min-w-[760px]">
                <Thead>
                  <Th className="w-[42%]">{t("library.file")}</Th>
                  <Th>{t("library.version")}</Th>
                  <Th>{t("library.tags")}</Th>
                  <Th align="right">{t("library.uploaded")}</Th>
                  <Th>{t("library.uploadedBy")}</Th>
                  <Th align="right">{t("library.actions")}</Th>
                </Thead>
                <tbody>
                  {documents.length === 0 && (
                    <EmptyRow colSpan={6}>{t("library.emptyFolder")}</EmptyRow>
                  )}
                  {documents.map((doc) => (
                    <Tr key={doc.id}>
                      <Td>
                        <DocumentName doc={doc} />
                        {/* Le chemin n'apparaît QUE dans la vue « tous les
                            documents » : dans un dossier, il répéterait sur
                            chaque ligne ce que l'en-tête vient de dire. */}
                        {!folderId && (
                          <span className="block font-mono text-[11px] text-[var(--text-muted)]">
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
                      <Td align="right" className="whitespace-nowrap tabular-nums text-xs">
                        {formatDateTime(doc.uploadedAt)}
                      </Td>
                      <Td className="text-xs text-[var(--text-muted)]">
                        {doc.uploadedByName ?? "—"}
                      </Td>
                      <Td align="right">
                        <span className="flex items-center justify-end gap-0.5">
                          <DocumentActions doc={doc} />
                          <DeleteDocumentButton
                            documentId={doc.id}
                            filename={doc.originalFilename}
                          />
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </div>
      </Section>
    </div>
  );
}
