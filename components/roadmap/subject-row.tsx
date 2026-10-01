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
// de tableau. Pas d'écran d'administration : ces gestes sont tout ce qu'on fait
// d'un sujet.
//
// S'y ajoutent le 01/10/2026 le RANG et la SUPPRESSION. L'ordre des sujets est
// celui du plan, pas celui des créations : un sujet ouvert en cours de route
// atterrissait en queue de liste quelle que soit sa place réelle. Et un sujet
// créé par erreur était indestructible dès qu'il portait une action — la clé
// étrangère est maintenant en `set null` (migration 0040), ses actions
// survivent sous « sans sujet ».
// ============================================================

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { cn } from "@/lib/cn";
import { DownIcon, TrashIcon, UpIcon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import {
  createRoadmapSubject,
  deleteRoadmapSubject,
  moveRoadmapSubject,
  renameRoadmapSubject,
} from "@/app/(app)/roadmap/actions";

export function SubjectTitle({
  subjectId,
  name,
  count,
  canMoveUp,
  canMoveDown,
}: {
  subjectId: string;
  name: string;
  count: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
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

  /* Les commandes ne s'affichent qu'au SURVOL de la ligne (`group-hover`) :
     trois boutons par intertitre, sur sept sujets, c'est vingt-et-un boutons
     en permanence pour des gestes qu'on fait trois fois par an. */
  return (
    <span className="flex items-center gap-1">
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

      <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <IconButton
          label={t("roadmap.subjectUp")}
          disabled={!canMoveUp || pending}
          onClick={() => move("up")}
          className="h-6 w-6"
        >
          <UpIcon className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton
          label={t("roadmap.subjectDown")}
          disabled={!canMoveDown || pending}
          onClick={() => move("down")}
          className="h-6 w-6"
        >
          <DownIcon className="h-3.5 w-3.5" />
        </IconButton>
        {/* La confirmation DIT CE QUI ARRIVE AUX ACTIONS. « Supprimer ce
            sujet ? » laisserait croire qu'on supprime aussi son contenu, et
            personne ne cliquerait. */}
        {/* `normal-case` : l'intertitre du sujet est en capitales, et la
            phrase de confirmation en héritait — une question de deux lignes
            tout en majuscules se lit mal et crie. */}
        <ConfirmAction
          className="normal-case tracking-normal"
          message={t("roadmap.confirmDeleteSubject", { name, count: String(count) })}
          disabled={pending}
          onConfirm={() =>
            start(async () => {
              const result = await deleteRoadmapSubject(subjectId);
              if (!result.ok) setError(true);
              else router.refresh();
            })
          }
        >
          {(arm) => (
            <IconButton
              label={t("roadmap.deleteSubject")}
              disabled={pending}
              onClick={arm}
              className="h-6 w-6"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </ConfirmAction>
      </span>
    </span>
  );

  function move(direction: "up" | "down") {
    setError(false);
    start(async () => {
      const result = await moveRoadmapSubject(subjectId, direction);
      if (!result.ok) setError(true);
      else router.refresh();
    });
  }
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
