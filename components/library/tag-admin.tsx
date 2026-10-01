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
import { createTag, renameTag, setTagColour } from "@/app/(app)/library/actions";

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
      /* `text-left` : un `<button>` centre son texte par défaut, et un libellé
         de deux lignes sortait centré au milieu d'une colonne alignée à
         gauche. */
      className="rounded px-1 text-left font-medium text-[var(--text)] hover:bg-[var(--app-bg)] disabled:opacity-60"
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

/**
 * Nuancier d'une étiquette.
 *
 * `<input type="color">` : c'est le seul contrôle que tout navigateur sait
 * rendre, et le seul qui n'oblige pas à connaître la notation hexadécimale. La
 * valeur part à l'écriture sur `onBlur` et non à chaque mouvement du curseur —
 * un nuancier émet une valeur par pixel parcouru, ce qui ferait des centaines
 * d'écritures pour un choix.
 */
export function TagColour({ tagId, colour }: { tagId: string; colour: string | null }) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState(colour ?? "#646b78");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function commit(next: string | null) {
    setError(false);
    start(async () => {
      const result = await setTagColour(tagId, next);
      if (!result.ok) setError(true);
      else router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center justify-end gap-2">
      {error && (
        <span className="text-[11px]" style={{ color: "var(--danger)" }}>
          {t("library.error_writeFailed")}
        </span>
      )}
      <input
        type="color"
        value={value}
        disabled={pending}
        aria-label={t("tags.colour")}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.toLowerCase() === (colour ?? "").toLowerCase()) return;
          commit(value);
        }}
        className="h-7 w-10 cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] disabled:opacity-50"
      />
      <span className="w-16 font-mono text-xs text-[var(--text-muted)]">{colour ?? "—"}</span>
      {colour && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setValue("#646b78");
            commit(null);
          }}
          title={t("tags.clearColour")}
          aria-label={t("tags.clearColour")}
          className="text-xs text-[var(--text-muted)] hover:text-[var(--text)] disabled:opacity-50"
        >
          ×
        </button>
      )}
    </span>
  );
}
