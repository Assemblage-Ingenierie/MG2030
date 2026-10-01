"use client";

// ============================================================
// components/library/tag-admin.tsx — créer et renommer une étiquette.
//
// Le CODE est dérivé du libellé et montré avant d'enregistrer : il entre dans
// les autorisations (`mg2030_tag_access`) et dans le tag par défaut des
// dossiers, où on le lit en SQL. Le laisser se fabriquer en silence
// obligerait à aller le chercher en base la première fois qu'on en a besoin.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { createTag, renameTag } from "@/app/(app)/library/actions";

/** Même règle que l'action serveur, pour que l'aperçu ne mente pas. */
function toCode(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function TagName({ tagId, label }: { tagId: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(label);
            setEditing(false);
          } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() === "" || draft === label) {
            setDraft(label);
            return;
          }
          setError(false);
          start(async () => {
            const result = await renameTag(tagId, draft);
            if (!result.ok) {
              setError(true);
              setDraft(label);
            } else router.refresh();
          });
        }}
        className={fieldClasses({ focusStyle: "border" }) + " py-1 text-sm"}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(label);
        setEditing(true);
      }}
      disabled={pending}
      title={t("tags.renameHint")}
      className="rounded px-1 font-medium text-[var(--text)] hover:bg-[var(--app-bg)] disabled:opacity-60"
    >
      {label}
      {error && (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
          style={{ backgroundColor: "var(--danger)" }}
        />
      )}
    </button>
  );
}

export function NewTag() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#646b78");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {t("tags.add")}
      </button>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const result = await createTag(toCode(label), label, color);
      if (!result.ok) {
        setError(t(`library.error_${result.error ?? "writeFailed"}`));
        return;
      }
      setLabel("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px]">
        <Field
          label={t("tags.label")}
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="tag-colour">{t("tags.colour")}</Label>
        <input
          id="tag-colour"
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="mt-1 h-9 w-14 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)]"
        />
      </div>
      {/* Le code, montré AVANT d'enregistrer : c'est lui qu'on écrira en SQL
          pour accorder l'étiquette, et il ne se changera plus. */}
      <p className="pb-2 font-mono text-xs text-[var(--text-muted)]">
        {toCode(label) || "—"}
      </p>
      <span className="flex items-center gap-2 pb-1">
        <Button variant="primary" size="sm" type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.add")}
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
      </span>
      {error && (
        <span className="pb-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </span>
      )}
    </form>
  );
}
