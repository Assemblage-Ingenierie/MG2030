import { getI18n } from "@/lib/i18n/server";
import { formatBytes, listDocuments, loadFolderTree, type FolderNode } from "@/lib/queries/library";
import { formatDateTime } from "@/lib/i18n/format";
import { readR2Config } from "@/lib/r2/presign";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
import { FolderTree } from "@/components/library/folder-tree";
import { UploadPanel } from "@/components/library/upload-panel";

/**
 * Bibliothèque documentaire.
 *
 * Volume cible 10 à 50 Go (brief §4) : les fichiers vivent dans R2, jamais
 * dans Postgres, et l'upload est direct depuis le navigateur.
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const { t } = await getI18n();
  const { folder: folderId } = await searchParams;

  const [tree, documents] = await Promise.all([loadFolderTree(), listDocuments(folderId)]);
  const r2Ready = readR2Config() !== null;

  const selected = folderId ? findFolder(tree, folderId) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section title={t("library.title")} description={t("library.intro")}>
        {/* Sans configuration R2, le dépôt est impossible. On le dit avant que
            l'utilisateur ne cherche un bouton qui ne marcherait pas. */}
        {!r2Ready && <SourceNote>{t("library.r2NotConfigured")}</SourceNote>}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="p-2">
            <FolderTree nodes={tree} selectedId={folderId ?? null} />
          </Card>

          <div className="flex min-w-0 flex-col gap-4">
            {selected && r2Ready && (
              <UploadPanel folderId={selected.id} folderPath={selected.path} />
            )}

            <Card className="overflow-hidden">
              <Table>
                <Thead>
                  <Th>{t("library.file")}</Th>
                  <Th>{t("library.tags")}</Th>
                  <Th align="right">{t("library.size")}</Th>
                  <Th align="right">{t("library.uploaded")}</Th>
                  <Th>{t("library.uploadedBy")}</Th>
                </Thead>
                <tbody>
                  {documents.length === 0 && (
                    <EmptyRow colSpan={5}>{t("library.emptyFolder")}</EmptyRow>
                  )}
                  {documents.map((doc) => (
                    <Tr key={doc.id}>
                      <Td>
                        <span className="block font-medium">{doc.originalFilename}</span>
                        {doc.description && (
                          <span className="block text-xs text-[var(--text-muted)]">
                            {doc.description}
                          </span>
                        )}
                        {!folderId && (
                          <span className="block font-mono text-[11px] text-[var(--text-muted)]">
                            {doc.folderPath}
                          </span>
                        )}
                      </Td>
                      <Td>
                        {doc.tags.length === 0 ? (
                          /* Un document sans tag est visible de TOUS les
                             membres actifs (brief §7) : le dire évite de
                             croire à une restriction implicite. */
                          <span
                            className="text-xs text-[var(--text-muted)]"
                            title={t("library.noTagNote")}
                          >
                            {t("library.noTag")}
                          </span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {doc.tags.map((tag) => (
                              <Chip key={tag.code}>{tag.label}</Chip>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatBytes(doc.sizeBytes)}
                      </Td>
                      <Td align="right" className="tabular-nums">
                        {formatDateTime(doc.uploadedAt)}
                      </Td>
                      <Td className="text-xs text-[var(--text-muted)]">
                        {doc.uploadedByName ?? "—"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </Card>

            {documents.length === 0 && <SourceNote>{t("library.emptyNote")}</SourceNote>}
          </div>
        </div>
      </Section>
    </div>
  );
}

function findFolder(nodes: FolderNode[], id: string): FolderNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findFolder(node.children, id);
    if (found) return found;
  }
  return null;
}
