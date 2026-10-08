"use client";

// ============================================================
// components/library/add-document.tsx — déposer un document, par un formulaire.
//
// ⚠ UN BOUTON, PAS UN PANNEAU PERMANENT. La zone de dépôt était affichée en
// tête de chaque dossier, avec sa description et son bouton « Choose a file » :
// elle occupait un tiers de l'écran sur un geste qu'on fait quelques fois par
// semaine, et poussait les documents sous le pli. Demandé le 01/10/2026.
//
// L'ENVOI EST DIRECT NAVIGATEUR → R2, le fichier ne traverse jamais une
// fonction serveur (brief §4) :
//   1. le serveur délivre une URL pré-signée (route presign-upload) ;
//   2. le navigateur envoie le fichier À R2, en PUT direct ;
//   3. le serveur enregistre les métadonnées.
//
// `XMLHttpRequest` et non `fetch` : c'est la seule API qui expose la
// progression d'un envoi. Sur un fichier d'un gigaoctet et une liaison lente,
// une barre figée fait annuler l'opération.
// ============================================================

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { registerDocument, setDocumentVersion } from "@/app/(app)/library/actions";
import type { FolderChoice } from "./document-row";

type Phase = "idle" | "signing" | "uploading" | "recording" | "error";

export function AddDocumentButton({
  folders,
  defaultFolderId,
  ready,
}: {
  folders: FolderChoice[];
  /** Dossier présélectionné : celui qu'on regarde. */
  defaultFolderId: string | null;
  /** R2 configuré. Sans cela, le bouton mentirait. */
  ready: boolean;
}) {
  const t = useT();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  if (!can("document.upload") || !ready || folders.length === 0) return null;

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        {t("library.upload")}
      </Button>
      {open && (
        <UploadForm
          folders={folders}
          defaultFolderId={defaultFolderId ?? folders[0].id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function UploadForm({
  folders,
  defaultFolderId,
  onClose,
}: {
  folders: FolderChoice[];
  defaultFolderId: string;
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [folderId, setFolderId] = useState(defaultFolderId);
  const [description, setDescription] = useState("");
  const [version, setVersion] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const busy = phase === "signing" || phase === "uploading" || phase === "recording";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setMessage(null);
    setProgress(0);
    setPhase("signing");

    // ── 1. URL pré-signée ─────────────────────────────────────────────────
    const signResponse = await fetch("/api/documents/presign-upload", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        folderId,
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      }),
    });

    if (!signResponse.ok) {
      const { error } = (await signResponse.json().catch(() => ({}))) as { error?: string };
      setPhase("error");
      setMessage(t(`library.error_${error ?? "generic"}`));
      return;
    }

    const { uploadUrl, objectKey, requiredHeaders } = (await signResponse.json()) as {
      uploadUrl: string;
      objectKey: string;
      requiredHeaders: Record<string, string>;
    };

    // ── 2. Envoi direct vers R2 ───────────────────────────────────────────
    setPhase("uploading");
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", uploadUrl, true);
      for (const [header, value] of Object.entries(requiredHeaders)) {
        xhr.setRequestHeader(header, value);
      }
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.onabort = () => resolve(false);
      xhr.send(file);
    });
    xhrRef.current = null;

    if (!ok) {
      setPhase("error");
      setMessage(t("library.error_upload_failed"));
      return;
    }

    // ── 3. Métadonnées ────────────────────────────────────────────────────
    // Le fichier est déjà dans R2 : si cette étape échoue, l'objet devient
    // orphelin. On le signale explicitement plutôt que de faire croire à un
    // échec complet — l'administrateur saura qu'il reste un objet à nettoyer.
    setPhase("recording");
    const result = await registerDocument({
      folderId,
      objectKey,
      originalFilename: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
      description: description.trim() || undefined,
    });

    if (!result.ok || !result.documentId) {
      setPhase("error");
      setMessage(t("library.error_orphan", { key: objectKey }));
      return;
    }

    // La version est une écriture à part : `registerDocument` écrit la ligne
    // sous la politique d'insertion, qui exige `uploaded_by = auth.uid()`.
    // L'y ajouter aurait mêlé deux règles pour un champ facultatif.
    if (version.trim() !== "") await setDocumentVersion(result.documentId, version);

    onClose();
    router.refresh();
  }

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      closeLabel={t("common.close")}
      title={t("library.upload")}
      maxWidth="max-w-xl"
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="upload-folder">{t("library.location")}</Label>
          <select
            id="upload-folder"
            className={fieldClasses() + " mt-1"}
            value={folderId}
            disabled={busy}
            onChange={(e) => setFolderId(e.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.label}
              </option>
            ))}
          </select>
        </div>

        {/* Le champ de fichier NATIF est masqué : son bouton et son « aucun
            fichier choisi » sont écrits par le navigateur, dans la langue du
            poste — en français sur un Windows français, au milieu d'une
            interface anglaise (08/10/2026). Le bouton et le libellé visibles
            sont ceux de l'application ; le champ caché garde `required`. */}
        <div>
          <Label htmlFor="upload-file">{t("library.file")}</Label>
          <input
            id="upload-file"
            ref={inputRef}
            type="file"
            required
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <div className="mt-1 flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {t("library.chooseFile")}
            </Button>
            <span className="min-w-0 truncate text-sm text-[var(--text-muted)]">
              {file ? file.name : t("library.noFileChosen")}
            </span>
          </div>
        </div>

        {/* La description se saisit AVANT l'envoi : au moment où l'on choisit
            le fichier, on sait ce qu'il contient ; une fois la barre de
            progression terminée, on est déjà passé à autre chose. */}
        <div>
          <Label htmlFor="upload-description" optionalText={t("common.optional")}>
            {t("library.description")}
          </Label>
          <textarea
            id="upload-description"
            rows={3}
            disabled={busy}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("library.descriptionPlaceholder")}
            className={fieldClasses() + " mt-1"}
          />
        </div>

        <Field
          label={t("library.version")}
          optionalText={t("common.optional")}
          placeholder={t("library.versionPlaceholder")}
          disabled={busy}
          value={version}
          onChange={(e) => setVersion(e.target.value)}
        />

        {busy && (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--app-bg)]">
              <div
                className="h-full rounded-full transition-[width] duration-150"
                style={{ width: `${progress}%`, backgroundColor: "var(--accent)" }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-[var(--text-muted)]">
              {phase === "uploading" ? `${progress}%` : t(`library.phase_${phase}`)}
            </span>
          </div>
        )}

        {message && (
          <p
            role="alert"
            className="rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
              color: "var(--danger)",
            }}
          >
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              xhrRef.current?.abort();
              onClose();
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || file === null}>
            {busy ? t("library.uploading") : t("library.upload")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
