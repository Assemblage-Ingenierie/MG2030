import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import type { FolderNode } from "@/lib/queries/library";
import { cn } from "@/lib/cn";

/**
 * Arborescence documentaire.
 *
 * Les 39 dossiers du seed sont une PROPOSITION, pas une donnée projet
 * (`seed/folder_tree.csv`, colonne `note`). Les administrateurs peuvent tout
 * réorganiser — d'où le rappel en pied d'arbre.
 *
 * De vrais liens, pas un composant à état : la vue est partageable et survit
 * au rechargement.
 */
export async function FolderTree({
  nodes,
  selectedId,
}: {
  nodes: FolderNode[];
  selectedId: string | null;
}) {
  const { t } = await getI18n();

  return (
    <nav aria-label={t("library.folders")} className="flex flex-col gap-0.5">
      <Link
        href="/library"
        className={cn(
          "rounded-md px-2 py-1.5 text-sm transition-colors",
          selectedId === null
            ? "bg-[var(--app-bg)] font-medium text-[var(--text)]"
            : "text-[var(--text-muted)] hover:bg-[var(--app-bg)]",
        )}
      >
        {t("library.allDocuments")}
      </Link>

      {nodes.map((node) => (
        <FolderBranch key={node.id} node={node} depth={0} selectedId={selectedId} />
      ))}

      <p className="mt-2 border-t border-[var(--border)] px-2 pt-2 text-[11px] text-[var(--text-muted)]">
        {t("library.treeIsProposal")}
      </p>
    </nav>
  );
}

function FolderBranch({
  node,
  depth,
  selectedId,
}: {
  node: FolderNode;
  depth: number;
  selectedId: string | null;
}) {
  const active = node.id === selectedId;

  return (
    <>
      <Link
        href={`/library?folder=${node.id}`}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
          active
            ? "bg-[var(--app-bg)] font-medium text-[var(--text)]"
            : "text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="truncate">{node.name.replace(/_/g, " ")}</span>
        {node.documentCount > 0 && (
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
            {node.documentCount}
          </span>
        )}
      </Link>

      {node.children.map((child) => (
        <FolderBranch key={child.id} node={child} depth={depth + 1} selectedId={selectedId} />
      ))}
    </>
  );
}
