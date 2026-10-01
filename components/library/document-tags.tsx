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
import { PopoverPanel } from "@/components/ui/popover";
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

        {/* ⚠ UN « + », PAS UNE LISTE DÉROULANTE. La liste occupait la largeur
            de son plus long libellé sur CHAQUE ligne, soit une colonne de
            boîtes vides en face de documents qui n'ont rien à étiqueter — et
            elle se lisait comme un champ à remplir. Demandé le 01/10/2026. */}
        {available.length > 0 && (
          <AddTagButton
            available={available}
            pending={pending}
            onPick={(tagId) => toggle(tagId, true)}
          />
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

function AddTagButton({
  available,
  pending,
  onPick,
}: {
  available: TagChoice[];
  pending: boolean;
  onPick: (tagId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  /* En ÉTAT et non en ref : une ref lue pendant le rendu vaut `null` au premier
     passage et ne redéclenche rien quand elle se remplit. */
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);

  return (
    <>
      <button
        ref={setTrigger}
        type="button"
        disabled={pending}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("library.addTag")}
        title={t("library.addTag")}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)] text-[13px] leading-none text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text)] disabled:opacity-50"
      >
        +
      </button>

      {/* Par un portail : la cellule vit dans un tableau, que `Table` enveloppe
          dans un `overflow-x-auto` — lequel rogne aussi en hauteur. */}
      <PopoverPanel anchor={trigger} open={open} onClose={() => setOpen(false)} width={200}>
        <div className="p-1">
          {available.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                onPick(tag.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-[var(--text)] hover:bg-[var(--app-bg)]"
            >
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: tag.color ?? "var(--border)" }}
              />
              <span className="truncate">{tag.label}</span>
            </button>
          ))}
        </div>
      </PopoverPanel>
    </>
  );
}
