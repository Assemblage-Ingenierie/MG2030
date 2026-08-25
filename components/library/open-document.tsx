"use client";

// ============================================================
// components/library/open-document.tsx — ouvrir un document.
//
// Le nom de fichier était du texte brut : rien dans l'écran n'appelait
// /api/documents/presign-download, la seule route qui sache produire une URL
// vers le fichier réel.
//
// URL PRÉ-SIGNÉE À CHAQUE CLIC, jamais mise en cache : elle expire en 5
// minutes (voir la route) et échappe à la RLS une fois émise. En redemander
// une à chaque ouverture limite la fenêtre pendant laquelle un lien copié
// reste utilisable.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";

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

  function open() {
    setError(null);
    start(async () => {
      const response = await fetch(`/api/documents/presign-download?id=${documentId}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(t(`library.error_${body.error ?? "downloadFailed"}`));
        return;
      }
      const { downloadUrl } = (await response.json()) as { downloadUrl: string };
      // Nouvel onglet : un PDF ou une image s'affiche, le reste se télécharge —
      // c'est le comportement natif du navigateur selon le type du fichier.
      window.open(downloadUrl, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <span className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="block truncate text-left font-medium text-[var(--text)] underline-offset-2 hover:underline disabled:opacity-60"
        title={t("library.openHint")}
      >
        {filename}
      </button>
      {error && (
        <span role="alert" className="text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
