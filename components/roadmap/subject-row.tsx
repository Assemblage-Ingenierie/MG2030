"use client";

// ============================================================
// components/roadmap/subject-row.tsx — la ligne grise d'un sujet, éditable.
//
// Les sujets n'avaient aucun écran. Ils étaient entrés par une migration de
// reprise, et en ajouter un demandait du SQL — c'est-à-dire, en pratique,
// d'attendre quelqu'un. Or un sujet naît en réunion : « on ouvre un
// chantier Communication ». S'il faut demander, l'action part dans un sujet
// approchant et la roadmap se déforme.
//
// On renomme donc en cliquant l'intertitre, et on ajoute par le bouton en pied
// de tableau. Pas d'écran d'administration : ces deux gestes sont tout ce qu'on
// fait d'un sujet.
// ============================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { cn } from "@/lib/cn";
import { createRoadmapSubject, renameRoadmapSubject } from "@/app/(app)/roadmap/actions";

export function SubjectTitle({
  subjectId,
  name,
  count,
}: {
  subjectId: string;
  name: string;
  count: number;
}) {
  const t = useT();
  const router = useRouter();
  const { can } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const label = (
    <>
      {name}
      {/* Le compte dit tout de suite si un filtre a vidé le sujet. */}
      <span className="ml-2 font-normal normal-case tabular-nums text-[var(--text-muted)]">
        {count}
      </span>
    </>
  );

  if (!can("roadmap.write")) return <>{label}</>;

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(name);
            setEditing(false);
          } else if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={() => {
          setEditing(false);
          if (draft.trim() === "" || draft === name) {
            setDraft(name);
            return;
          }
          setError(false);
          start(async () => {
            const result = await renameRoadmapSubject(subjectId, draft);
            if (!result.ok) {
              setError(true);
              setDraft(name);
            } else router.refresh();
          });
        }}
        className="w-64 rounded border bg-[var(--surface)] px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide outline-none"
        style={{ borderColor: "var(--focus)" }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      disabled={pending}
      title={t("roadmap.renameSubject")}
      className={cn("rounded px-1 hover:bg-[var(--border)]", pending && "opacity-50")}
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

/**
 * Ajout d'un sujet, en pied de tableau.
 *
 * Le champ n'apparaît qu'au clic : un champ de saisie posé en permanence sous
 * la liste se remplit par accident, et la roadmap gagne un sujet vide.
 */
export function AddSubject() {
  const t = useT();
  const router = useRouter();
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  if (!can("roadmap.write")) return null;

  function submit() {
    if (name.trim() === "") {
      setOpen(false);
      return;
    }
    setError(null);
    start(async () => {
      const result = await createRoadmapSubject(name);
      if (!result.ok) {
        setError(t(`roadmap.error_${result.error}`));
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
        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {t("roadmap.addSubject")}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        ref={input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setName("");
            setOpen(false);
          } else if (e.key === "Enter") submit();
        }}
        placeholder={t("roadmap.subjectName")}
        className="w-64 rounded border bg-[var(--surface)] px-2 py-1 text-xs outline-none"
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
