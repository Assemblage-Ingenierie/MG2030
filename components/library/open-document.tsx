"use client";

// ============================================================
// components/library/open-document.tsx — voir ou télécharger un document.
//
// Le nom de fichier était du texte brut : rien dans l'écran n'appelait
// /api/documents/presign-download, la seule route qui sache produire une URL
// vers le fichier réel.
//
// DEUX ACTIONS, PAS UNE. « Voir » ouvre un nouvel onglet — un PDF ou une image
// s'y affiche, le reste s'y télécharge selon le comportement natif du
// navigateur. « Télécharger » FORCE l'enregistrement, quel que soit le type,
// sans quitter la page : R2 répond avec un en-tête `Content-Disposition:
// attachment`, que le navigateur honore comme un téléchargement plutôt que
// comme une navigation.
//
// URL PRÉ-SIGNÉE À CHAQUE CLIC, jamais mise en cache : elle expire en 5
// minutes (voir la route) et échappe à la RLS une fois émise. En redemander
// une à chaque usage limite la fenêtre pendant laquelle un lien copié reste
// utilisable.
//
// LE NOM ENREGISTRÉ EST PROPRE. La route renvoie désormais un en-tête
// `Content-Disposition` portant `original_filename` : le navigateur ne
// retombe plus sur le dernier segment de la clé R2, qui porte un préfixe
// UUID destiné à l'unicité de l'objet, jamais destiné à l'affichage.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";

type Mode = "inline" | "attachment";

async function fetchDownloadUrl(documentId: string, mode: Mode): Promise<string> {
  const response = await fetch(
    `/api/documents/presign-download?id=${documentId}&mode=${mode}`,
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? "downloadFailed");
  }
  const { downloadUrl } = (await response.json()) as { downloadUrl: string };
  return downloadUrl;
}

export function OpenDocumentLink({
  documentId,
  filename,
}: {
  documentId: string;
  filename: string;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function view() {
    setError(null);
    start(async () => {
      try {
        const url = await fetchDownloadUrl(documentId, "inline");
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        setError(t(`library.error_${e instanceof Error ? e.message : "downloadFailed"}`));
      }
    });
  }

  function download() {
    setError(null);
    start(async () => {
      try {
        const url = await fetchDownloadUrl(documentId, "attachment");
        // Navigation de la page courante, PAS un nouvel onglet : l'en-tête
        // `Content-Disposition: attachment` fait que le navigateur traite
        // cela comme un téléchargement plutôt que comme un changement de
        // page — on ne quitte donc pas réellement la bibliothèque.
        const link = document.createElement("a");
        link.href = url;
        link.rel = "noopener noreferrer";
        document.body.appendChild(link);
        link.click();
        link.remove();
      } catch (e) {
        setError(t(`library.error_${e instanceof Error ? e.message : "downloadFailed"}`));
      }
    });
  }

  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-baseline gap-2">
        <button
          type="button"
          onClick={view}
          disabled={pending}
          className="min-w-0 truncate text-left font-medium text-[var(--text)] underline-offset-2 hover:underline disabled:opacity-60"
          title={t("library.viewHint")}
        >
          {filename}
        </button>
        <button
          type="button"
          onClick={download}
          disabled={pending}
          title={t("library.downloadHint")}
          aria-label={t("library.downloadHint")}
          className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </span>
      {error && (
        <span role="alert" className="text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
