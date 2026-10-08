"use client";

// ============================================================
// components/library/folder-panel.tsx — naviguer et tenir l'arborescence.
//
// ⚠ DEUX NIVEAUX, DEUX ENDROITS. L'arbre entier tenait dans une colonne de
// 280 px : trente-neuf dossiers empilés, indentés de quatorze pixels, où l'on
// cherchait longtemps la grande partie dont on venait de lire le nom. Demandé
// le 01/10/2026 : les GRANDES PARTIES restent à gauche, et le détail d'une
// partie s'ouvre à droite, repliable.
//
// On y gagne autre chose : la colonne de gauche cesse de bouger quand on
// explore. Un arbre qui se déplie pousse ses voisins vers le bas, et le dossier
// qu'on visait n'est plus sous le curseur.
//
// Les gestes de tenue — renommer, ajouter, supprimer, réordonner — n'avaient
// AUCUN écran : les politiques existaient depuis l'origine (`folder.admin`),
// mais créer un dossier demandait du SQL. Ils apparaissent au survol, parce
// qu'on les fait trois fois par an.
// ============================================================

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { IconButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { DownIcon, TrashIcon, UpIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { createFolder, deleteFolder, moveFolder, renameFolder } from "@/app/(app)/library/actions";

export interface FolderView {
  id: string;
  name: string;
  documentCount: number;
  branchCount: number;
  children: FolderView[];
}

/**
 * Nom lisible d'un dossier.
 *
 * Le seed nomme les racines « 01_Project_governance », « 02_Procurement »… Le
 * préfixe numérique n'existe que pour IMPOSER L'ORDRE D'AFFICHAGE : il n'a
 * aucun sens pour le lecteur. On le retire à l'affichage ; le tri s'appuie sur
 * `sort_order` et sur le chemin stocké, qui ne changent pas.
 *
 * Le motif exige le SÉPARATEUR : « 2030_report » garde son 2030, qui fait
 * partie du nom, tandis que « 01_… » perd bien son rang.
 */
export function folderLabel(name: string): string {
  return name.replace(/^\d+[_-]/, "").replace(/_/g, " ");
}

// ── Colonne de gauche : les grandes parties ────────────────────────────────

export function RootList({
  roots,
  selectedRootId,
  searching = false,
}: {
  roots: FolderView[];
  selectedRootId: string | null;
  /**
   * Une recherche est en cours : AUCUNE entrée n'est marquée courante, et
   * « tous les documents » devient le chemin de retour. La marquer courante
   * la ferait lire comme l'endroit où l'on est déjà, donc comme un lien mort.
   */
  searching?: boolean;
}) {
  const t = useT();
  const { can } = usePermissions();
  const atRoot = !searching && selectedRootId === null;

  return (
    <nav aria-label={t("library.folders")} className="flex flex-col gap-0.5">
      <Link
        href="/library"
        aria-current={atRoot ? "true" : undefined}
        className={cn(
          "rounded-md px-2 py-1.5 text-sm transition-colors",
          atRoot
            ? "bg-[var(--app-bg)] font-medium text-[var(--text)]"
            : "text-[var(--text-muted)] hover:bg-[var(--app-bg)]",
        )}
      >
        {t("library.allDocuments")}
      </Link>

      {roots.map((root) => (
        <Link
          key={root.id}
          href={`/library?folder=${root.id}`}
          aria-current={root.id === selectedRootId ? "true" : undefined}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
            root.id === selectedRootId
              ? "bg-[var(--app-bg)] font-semibold text-[var(--text)]"
              : "font-medium text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)]",
          )}
        >
          <span className="truncate">{folderLabel(root.name)}</span>
          {/* Le compte de TOUTE LA BRANCHE. Un « 0 » en face de « Procurement »
              alors que ses sous-dossiers en portent quarante ferait croire la
              partie vide, et personne ne cliquerait. */}
          {root.branchCount > 0 && (
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
              {root.branchCount}
            </span>
          )}
        </Link>
      ))}

      {can("document.upload") && <AddFolder parentId={null} label={t("library.addPart")} />}
    </nav>
  );
}

// ── Intertitre d'un dossier, avec ses commandes de tenue ──────────────────
//
// Rendu par `browser.tsx`, qui sait quels documents il contient. L'intertitre
// ne NAVIGUE plus : il déplie. C'est tout l'objet du changement — cliquer un
// sous-dossier ne recharge plus la page.

export function FolderHeading({
  folder,
  expanded,
  onToggle,
  siblings,
  isRoot = false,
}: {
  folder: FolderView;
  /** `null` quand le dossier est vide : il n'y a rien à déplier. */
  expanded: boolean | null;
  onToggle: () => void;
  /** La fratrie, pour griser les flèches aux extrémités. */
  siblings: FolderView[];
  isRoot?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { can } = usePermissions();
  const editable = can("document.upload");

  const index = siblings.findIndex((c) => c.id === folder.id);
  const position = {
    first: isRoot || index <= 0,
    last: isRoot || index === siblings.length - 1,
  };
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(t(`library.error_${result.error ?? "writeFailed"}`));
      else router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "group flex flex-col border-b border-[var(--border)]",
        isRoot ? "bg-[var(--app-bg)]" : "bg-[var(--surface)]",
      )}
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5"
        style={{ paddingLeft: isRoot ? 8 : 10 }}
      >
        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setDraft(folder.name);
                setRenaming(false);
              } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onBlur={() => {
              setRenaming(false);
              if (draft.trim() === "" || draft === folder.name) {
                setDraft(folder.name);
                return;
              }
              run(() => renameFolder(folder.id, draft));
            }}
            className="w-64 rounded border bg-[var(--surface)] px-2 py-0.5 text-sm outline-none"
            style={{ borderColor: "var(--focus)" }}
          />
        ) : (
          /* Un BOUTON et non un lien : déplier n'est pas naviguer, et
             l'ancienne version rechargeait la page pour n'en changer qu'un
             tableau. Un dossier vide n'est pas cliquable — un chevron qui
             ne déplie rien se clique deux fois. */
          <button
            type="button"
            onClick={onToggle}
            disabled={expanded === null}
            aria-expanded={expanded ?? undefined}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 text-left text-sm",
              expanded !== null && "hover:bg-[var(--border)]",
              isRoot ? "font-semibold text-[var(--text)]" : "text-[var(--text)]",
              expanded === null && "cursor-default text-[var(--text-muted)]",
            )}
          >
            <Chevron open={expanded === true} hidden={expanded === null} />
            <span className="truncate">{folderLabel(folder.name)}</span>
            {folder.documentCount > 0 && (
              <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                {folder.documentCount}
              </span>
            )}
          </button>
        )}

        {editable && !renaming && (
          <span className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <IconButton
              label={t("library.renameFolder")}
              disabled={pending}
              onClick={() => {
                setDraft(folder.name);
                setRenaming(true);
              }}
              className="h-6 w-6"
            >
              <PencilGlyph />
            </IconButton>
            <IconButton
              label={t("library.folderUp")}
              disabled={pending || position.first}
              onClick={() => run(() => moveFolder(folder.id, "up"))}
              className="h-6 w-6"
            >
              <UpIcon className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton
              label={t("library.folderDown")}
              disabled={pending || position.last}
              onClick={() => run(() => moveFolder(folder.id, "down"))}
              className="h-6 w-6"
            >
              <DownIcon className="h-3.5 w-3.5" />
            </IconButton>
            {/* ⚠ UN DOSSIER NE SE SUPPRIME QUE VIDE. Un document sans dossier
                n'existe pas, et son fichier vit dans R2 : une ligne orpheline
                laisserait un objet payant qu'aucune URL ne peut plus
                atteindre. L'action refuse et le dit. */}
            <ConfirmAction
              message={t("library.confirmDeleteFolder", { name: folderLabel(folder.name) })}
              disabled={pending}
              onConfirm={() => run(() => deleteFolder(folder.id))}
            >
              {(arm) => (
                <IconButton
                  label={t("library.deleteFolder")}
                  disabled={pending}
                  onClick={arm}
                  className="h-6 w-6"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </IconButton>
              )}
            </ConfirmAction>
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="px-3 pb-1.5 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function AddFolder({ parentId, label }: { parentId: string | null; label: string }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (name.trim() === "") {
      setOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      const result = await createFolder(parentId, name);
      if (!result.ok) {
        setError(t(`library.error_${result.error ?? "writeFailed"}`));
        return;
      }
      setName("");
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded px-2 py-1 text-left text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 py-1">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          } else if (e.key === "Enter") submit();
        }}
        placeholder={t("library.folderName")}
        className="w-48 rounded border bg-[var(--surface)] px-2 py-1 text-xs outline-none"
        style={{ borderColor: "var(--focus)" }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="rounded px-2 py-1 text-xs font-medium disabled:opacity-50"
        style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
      >
        {pending ? t("common.saving") : t("common.add")}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}

/** Chevron de dépliement. Invisible — mais présent — quand il n'y a rien à ouvrir. */
function Chevron({ open, hidden }: { open: boolean; hidden: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={cn("shrink-0 transition-transform", hidden && "invisible")}
      style={{ transform: open ? "rotate(90deg)" : undefined }}
    >
      <path d="M3 1l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Crayon discret, à la taille des autres commandes de dossier. */
function PencilGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}
