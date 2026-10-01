"use client";

// ============================================================
// components/library/document-row.tsx — une ligne de document, vivante.
//
// Avant : le nom ouvrait le fichier, la description s'écrivait en entier sous
// lui — trois lignes pour certaines — et la seule action était de supprimer.
// Corriger un nom mal orthographié demandait de re-téléverser le fichier.
//
// ⚠ L'APERÇU NE CONCERNE QUE CE QUE LE NAVIGATEUR SAIT RENDRE : PDF et images.
// Word, Excel et PowerPoint ne s'affichent pas nativement, et les seuls
// visionneuses en ligne (Microsoft, Google) exigent qu'on leur ENVOIE une URL
// publique du document. Nos URL pré-signées ouvrent le fichier à qui les
// détient : les confier à un tiers reviendrait à publier chez lui les pièces
// de passation du projet. On télécharge donc, et on le dit — c'est moins
// commode et c'est le seul choix défendable ici.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Modal } from "@/components/ui/modal";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { DownloadIcon, EditIcon, EyeIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  moveDocument,
  renameDocument,
  setDocumentDescription,
  setDocumentVersion,
} from "@/app/(app)/library/actions";

/** Un dossier proposé comme emplacement, déjà indenté. */
export interface FolderChoice {
  id: string;
  label: string;
}

export interface DocumentRowData {
  /** Emplacement actuel, pour que la fiche sache d'où l'on part. */
  folderId: string;
  id: string;
  originalFilename: string;
  mimeType: string;
  description: string | null;
  version: string | null;
}

/** Ce que le navigateur sait afficher lui-même. Voir l'avertissement en tête. */
export function isPreviewable(filename: string, mimeType: string | null): boolean {
  const name = filename.toLowerCase();
  return (
    mimeType === "application/pdf" ||
    name.endsWith(".pdf") ||
    (mimeType ?? "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|svg)$/.test(name)
  );
}

async function presign(documentId: string, mode: "inline" | "attachment"): Promise<string> {
  const response = await fetch(`/api/documents/presign-download?id=${documentId}&mode=${mode}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "downloadFailed");
  }
  const { downloadUrl } = (await response.json()) as { downloadUrl: string };
  return downloadUrl;
}

/** Longueur au-delà de laquelle la description est repliée. */
const CROP = 110;

/**
 * Le droit d'écrire, lu DANS la cellule.
 *
 * ⚠ IL NE PEUT PAS ÊTRE PASSÉ EN PROP DEPUIS LA PAGE. Celle-ci est un composant
 * SERVEUR, et le droit vit dans le contexte d'identité, qui est client. Une
 * première version passait un `children: (canEdit) => …` à un petit composant
 * client : une FONCTION ne traverse pas la frontière serveur / client, et React
 * refusait l'écran entier à l'exécution — ce que ni le typage ni le build ne
 * voient, puisque la frontière n'est pas une affaire de types.
 *
 * Ce n'est qu'un confort d'interface : masquer un bouton dont l'action serait
 * refusée. La RLS reste la seule protection (brief §8), et chaque action
 * vérifie le nombre de lignes réellement écrites.
 */
function useCanEditLibrary(): boolean {
  const { can } = usePermissions();
  return can("document.upload");
}

export function DocumentName({ doc }: { doc: DocumentRowData }) {
  const t = useT();
  const canEdit = useCanEditLibrary();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.originalFilename);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  const description = doc.description ?? "";
  const long = description.length > CROP;
  const shown = expanded || !long ? description : `${description.slice(0, CROP).trimEnd()}…`;

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(doc.originalFilename);
            setEditing(false);
          } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() === "" || draft === doc.originalFilename) {
            setDraft(doc.originalFilename);
            return;
          }
          setError(false);
          start(async () => {
            const result = await renameDocument(doc.id, draft);
            if (!result.ok) {
              setError(true);
              setDraft(doc.originalFilename);
            } else router.refresh();
          });
        }}
        className={cn(fieldClasses({ focusStyle: "border" }), "py-1 text-sm")}
      />
    );
  }

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="flex items-baseline gap-1.5">
        {canEdit ? (
          <button
            type="button"
            onClick={() => {
              setDraft(doc.originalFilename);
              setEditing(true);
            }}
            disabled={pending}
            title={t("library.renameHint")}
            className="min-w-0 truncate rounded text-left font-medium text-[var(--text)] hover:bg-[var(--app-bg)] disabled:opacity-60"
          >
            {doc.originalFilename}
          </button>
        ) : (
          <span className="min-w-0 truncate font-medium text-[var(--text)]">
            {doc.originalFilename}
          </span>
        )}
        {error && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: "var(--danger)" }}
          />
        )}
      </span>

      {/* La description est REPLIÉE au-delà de cent dix signes : certaines font
          un paragraphe, et trois lignes par document transforment un tableau
          de vingt fichiers en page de texte. Un clic la déplie. */}
      {description !== "" && (
        <button
          type="button"
          onClick={() => long && setExpanded(!expanded)}
          aria-expanded={long ? expanded : undefined}
          className={cn(
            "text-left text-xs text-[var(--text-muted)]",
            long && "hover:text-[var(--text)]",
          )}
          title={long ? t(expanded ? "library.collapseDescription" : "library.expandDescription") : undefined}
        >
          {shown}
        </button>
      )}
    </span>
  );
}

/** Version en texte libre, modifiable d'un clic. */
export function DocumentVersion({ doc }: { doc: DocumentRowData }) {
  const t = useT();
  const canEdit = useCanEditLibrary();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(doc.version ?? "");
  const [, start] = useTransition();

  if (!canEdit) {
    return doc.version ? (
      <span className="tabular-nums">{doc.version}</span>
    ) : (
      <span className="text-[var(--text-muted)]">—</span>
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder={t("library.versionPlaceholder")}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(doc.version ?? "");
            setEditing(false);
          } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={() => {
          setEditing(false);
          if (draft === (doc.version ?? "")) return;
          start(async () => {
            await setDocumentVersion(doc.id, draft);
            router.refresh();
          });
        }}
        className={cn(fieldClasses({ focusStyle: "border" }), "w-24 py-0.5 text-xs")}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(doc.version ?? "");
        setEditing(true);
      }}
      className="rounded px-1 text-xs tabular-nums hover:bg-[var(--app-bg)]"
    >
      {doc.version ?? <span className="text-[var(--text-muted)]">—</span>}
    </button>
  );
}

/** Aperçu, téléchargement, fiche. Trois icônes, trois gestes distincts. */
export function DocumentActions({
  doc,
  folders,
}: {
  doc: DocumentRowData;
  folders: FolderChoice[];
}) {
  const t = useT();
  const canEdit = useCanEditLibrary();
  const router = useRouter();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const previewable = isPreviewable(doc.originalFilename, doc.mimeType);

  function open(mode: "inline" | "attachment") {
    setError(null);
    start(async () => {
      try {
        const url = await presign(doc.id, mode);
        if (mode === "attachment") {
          // Navigation de la page courante, pas un onglet : R2 répond avec un
          // `Content-Disposition: attachment`, que le navigateur traite comme
          // un téléchargement — on ne quitte donc pas la bibliothèque.
          const link = document.createElement("a");
          link.href = url;
          link.rel = "noopener noreferrer";
          document.body.appendChild(link);
          link.click();
          link.remove();
        } else setPreviewUrl(url);
      } catch (e) {
        setError(t(`library.error_${e instanceof Error ? e.message : "downloadFailed"}`));
      }
    });
  }

  return (
    <span className="flex items-center justify-end gap-0.5">
      {error && (
        <span className="mr-1 text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}

      <IconButton
        label={previewable ? t("library.previewHint") : t("library.noPreviewHint")}
        disabled={pending || !previewable}
        onClick={() => open("inline")}
        className="h-7 w-7"
      >
        <EyeIcon className="h-4 w-4" />
      </IconButton>

      <IconButton
        label={t("library.downloadHint")}
        disabled={pending}
        onClick={() => open("attachment")}
        className="h-7 w-7"
      >
        <DownloadIcon className="h-4 w-4" />
      </IconButton>

      {canEdit && (
        <IconButton label={t("library.editHint")} onClick={() => setForm(true)} className="h-7 w-7">
          <EditIcon className="h-4 w-4" />
        </IconButton>
      )}

      <Modal
        open={previewUrl !== null}
        onClose={() => setPreviewUrl(null)}
        closeLabel={t("common.close")}
        title={doc.originalFilename}
        maxWidth="max-w-6xl"
      >
        {previewUrl && (
          <div className="flex flex-col gap-3">
            {/* Lecteur natif du navigateur : aucune dépendance ajoutée, et le
                fichier ne sort pas chez un tiers. */}
            <iframe
              src={previewUrl}
              title={doc.originalFilename}
              className="h-[65vh] w-full rounded border border-[var(--border)]"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
              >
                {t("library.openInNewTab")}
              </Button>
              <Button variant="primary" size="sm" type="button" onClick={() => open("attachment")}>
                {t("library.downloadHint")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {form && (
        <EditForm
          doc={doc}
          folders={folders}
          onClose={() => {
            setForm(false);
            router.refresh();
          }}
        />
      )}
    </span>
  );
}

/** La fiche : ce qui se modifie sans re-téléverser le fichier. */
function EditForm({
  doc,
  folders,
  onClose,
}: {
  doc: DocumentRowData;
  folders: FolderChoice[];
  onClose: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(doc.originalFilename);
  const [version, setVersion] = useState(doc.version ?? "");
  const [description, setDescription] = useState(doc.description ?? "");
  const [folderId, setFolderId] = useState(doc.folderId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      // Trois écritures distinctes plutôt qu'une : chaque champ a sa politique
      // et son action, déjà utilisées par l'édition en ligne. Une quatrième
      // action « tout enregistrer » aurait dupliqué les trois.
      const results = await Promise.all([
        name !== doc.originalFilename ? renameDocument(doc.id, name) : { ok: true as const },
        version !== (doc.version ?? "")
          ? setDocumentVersion(doc.id, version)
          : { ok: true as const },
        description !== (doc.description ?? "")
          ? setDocumentDescription(doc.id, description)
          : { ok: true as const },
        // ⚠ DÉPLACER NE TOUCHE PAS AU FICHIER. La clé R2 ne bouge pas : elle
        // identifie l'objet stocké, pas son rangement. Seul `folder_id`
        // change — le document se retrouve ailleurs dans l'arborescence, et
        // le fichier reste exactement là où il a été déposé.
        folderId !== doc.folderId ? moveDocument(doc.id, folderId) : { ok: true as const },
      ]);
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setError(t("library.error_writeFailed"));
        return;
      }
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("library.editTitle")}
      maxWidth="max-w-xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label={t("library.file")}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label={t("library.version")}
          optionalText={t("common.optional")}
          placeholder={t("library.versionPlaceholder")}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />
        <div>
          <Label htmlFor="doc-folder">{t("library.location")}</Label>
          <select
            id="doc-folder"
            className={fieldClasses() + " mt-1"}
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="doc-description" optionalText={t("common.optional")}>
            {t("library.description")}
          </Label>
          <textarea
            id="doc-description"
            rows={4}
            className={fieldClasses() + " mt-1"}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
