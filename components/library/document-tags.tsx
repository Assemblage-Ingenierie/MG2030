"use client";

// ============================================================
// components/library/document-tags.tsx — tags d'un document.
//
// ⚠ `toggleDocumentTag` existait depuis le premier jour sans jamais être
// appelé : les tags s'affichaient, mais rien dans l'écran ne les modifiait.
//
// Les tags gouvernent la LECTURE (brief §8, règle d'union — GAPS 33) : retirer
// le dernier tag rend un document visible de TOUT le monde, ajouter un tag le
// restreint. On le dit dans l'interface, pas seulement dans la RLS qui
// l'applique — sinon un tag ajouté par erreur cache un document sans
// explication.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Chip } from "@/components/ui/badge";
import { toggleDocumentTag } from "@/app/(app)/library/actions";

export interface TagChoice {
  id: string;
  code: string;
  label: string;
  color: string | null;
}

export interface DocumentTag {
  id: string;
  code: string;
  label: string;
  color: string | null;
}

export function DocumentTags({
  documentId,
  tags,
  allTags,
}: {
  documentId: string;
  tags: DocumentTag[];
  allTags: TagChoice[];
}) {
  const t = useT();
  const { can } = usePermissions();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editable = can("document.upload");
  const attached = new Set(tags.map((tag) => tag.id));
  const available = allTags.filter((tag) => !attached.has(tag.id));

  function toggle(tagId: string, attach: boolean) {
    setError(null);
    start(async () => {
      const result = await toggleDocumentTag(documentId, tagId, attach);
      if (!result.ok) setError(result.error ?? t("library.error_tagFailed"));
    });
  }

  if (!editable) {
    return tags.length === 0 ? (
      <span className="text-xs text-[var(--text-muted)]" title={t("library.noTagNote")}>
        {t("library.noTag")}
      </span>
    ) : (
      <span className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <Chip key={tag.id}>{tag.label}</Chip>
        ))}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1">
        {tags.length === 0 && (
          <span className="text-xs text-[var(--text-muted)]" title={t("library.noTagNote")}>
            {t("library.noTag")}
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            style={{
              backgroundColor: tag.color
                ? `color-mix(in srgb, ${tag.color} 18%, transparent)`
                : "var(--app-bg)",
            }}
          >
            {tag.label}
            <button
              type="button"
              disabled={pending}
              onClick={() => toggle(tag.id, false)}
              aria-label={t("library.removeTag", { tag: tag.label })}
              className="text-[var(--text-muted)] hover:text-[var(--danger)]"
            >
              ×
            </button>
          </span>
        ))}

        {available.length > 0 && (
          <select
            disabled={pending}
            aria-label={t("library.addTag")}
            className="h-6 rounded border border-[var(--border)] bg-[var(--surface)] px-1 text-xs"
            value=""
            onChange={(e) => {
              if (e.target.value) toggle(e.target.value, true);
            }}
          >
            <option value="">{t("library.addTag")}</option>
            {available.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.label}
              </option>
            ))}
          </select>
        )}
      </span>

      {error && (
        <span role="alert" className="text-[11px]" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
