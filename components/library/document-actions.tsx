"use client";

// ============================================================
// components/library/document-actions.tsx — supprimer un document.
//
// Demandé le 16/09/2026 : « Ajoute une option pour supprimer un document
// enregistré. » Un dépôt raté — mauvais dossier, mauvaise version, fichier de
// test — restait sinon en place indéfiniment.
//
// CONFIRMATION EN DEUX TEMPS, dans le bouton lui-même. La suppression efface
// aussi l'objet dans R2 : elle est irréversible, et il n'y a pas de corbeille.
// Une boîte de dialogue serait plus lourde ; un simple second clic suffit à
// écarter le clic accidentel, qui est le seul risque réel ici.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { deleteDocument } from "@/app/(app)/library/actions";

export function DeleteDocumentButton({
  documentId,
  filename,
}: {
  documentId: string;
  filename: string;
}) {
  const t = useT();
  const router = useRouter();
  const { can } = usePermissions();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // La RLS tranchera de toute façon : ce test évite seulement d'afficher un
  // bouton qui ne pourrait qu'échouer.
  if (!can("document.upload")) return null;

  function remove() {
    start(async () => {
      const result = await deleteDocument(documentId);
      if (!result.ok) {
        setError(t(`library.error_delete_${result.error ?? "generic"}`));
        setArmed(false);
        return;
      }
      router.refresh();
    });
  }

  if (error) {
    return (
      <span className="text-xs" style={{ color: "var(--danger)" }}>
        {error}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => (armed ? remove() : setArmed(true))}
      onBlur={() => setArmed(false)}
      title={t("library.deleteDocument", { name: filename })}
      className="text-xs underline disabled:opacity-60"
      style={{ color: armed ? "var(--danger)" : "var(--text-muted)" }}
    >
      {pending ? t("common.saving") : armed ? t("common.confirm") : t("common.delete")}
    </button>
  );
}
