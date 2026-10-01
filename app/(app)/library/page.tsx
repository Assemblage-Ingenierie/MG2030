import { getI18n } from "@/lib/i18n/server";
import {
  branchCount,
  branchIds,
  flatten,
  listDocuments,
  listTagOptions,
  loadFolderTree,
  locate,
  type FolderNode,
} from "@/lib/queries/library";
import { readR2Config } from "@/lib/r2/presign";
import { Card, Section } from "@/components/ui/card";
import { RootList, type FolderView } from "@/components/library/folder-panel";
import { LibraryBrowser, SearchResults } from "@/components/library/browser";
import { LibrarySearch } from "@/components/library/search-bar";
import { AddDocumentButton } from "@/components/library/add-document";

/**
 * Bibliothèque documentaire.
 *
 * Volume cible 10 à 50 Go (brief §4) : les fichiers vivent dans R2, jamais
 * dans Postgres, et l'envoi est direct depuis le navigateur.
 *
 * ⚠ UNE SEULE NAVIGATION PAR PARTIE, PAS UNE PAR DOSSIER.
 *
 * Chaque sous-dossier était un lien : cliquer rechargeait la page entière pour
 * ne changer qu'un tableau, d'où l'attente signalée le 01/10/2026. La page
 * charge maintenant la BRANCHE ENTIÈRE de la partie choisie, et le dépliement
 * des sous-dossiers est purement local (voir `browser.tsx`). On passe de
 * « une requête par dossier ouvert » à « une requête par partie ».
 */
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; q?: string }>;
}) {
  const { t } = await getI18n();
  const { folder: folderId, q } = await searchParams;
  const search = q?.trim() ?? "";

  /* L'arborescence et les étiquettes EN PARALLÈLE : elles ne dépendent pas
     l'une de l'autre. Les documents viennent après, parce qu'il faut l'arbre
     pour savoir quels dossiers composent la branche — un aller-retour de plus,
     mais le seul qui soit vraiment séquentiel. */
  const [tree, allTags] = await Promise.all([loadFolderTree(), listTagOptions()]);
  const { root } = locate(tree, folderId ?? null);

  // Première partie par défaut : un écran qui s'ouvre sur rien oblige à un
  // clic avant de montrer quoi que ce soit.
  const current = root ?? tree[0] ?? null;

  const documents = await listDocuments(
    search !== "" ? { search } : { folderIds: current ? branchIds(current) : [] },
  );

  const view = (node: FolderNode): FolderView => ({
    id: node.id,
    name: node.name,
    documentCount: node.documentCount,
    branchCount: branchCount(node),
    children: node.children.map(view),
  });

  const roots = tree.map(view);
  const folders = flatten(tree);
  const openRoot = current ? view(current) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      {/* Sans sous-titre : la phrase expliquait où vivent les fichiers, ce qui
          regarde le développeur et non la personne qui cherche un document.
          Retirée le 01/10/2026. */}
      <Section
        title={t("library.title")}
        actions={
          <AddDocumentButton
            folders={folders}
            defaultFolderId={current?.id ?? null}
            ready={readR2Config() !== null}
          />
        }
      >
        <LibrarySearch initial={search} />

        {search !== "" ? (
          <SearchResults
            documents={documents}
            allTags={allTags}
            folders={folders}
            query={search}
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <Card className="h-max p-2">
              <RootList roots={roots} selectedRootId={current?.id ?? null} />
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
              {openRoot && (
                <LibraryBrowser
                  root={openRoot}
                  documents={documents}
                  allTags={allTags}
                  folders={folders}
                />
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
