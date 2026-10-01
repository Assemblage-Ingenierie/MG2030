"use client";

// ============================================================
// components/acronyms/acronym-table.tsx — le glossaire, modifiable en place.
//
// Trente-trois lignes de deux champs : une fenêtre d'édition par ligne serait
// trois clics pour corriger une faute de frappe. On modifie dans la cellule,
// comme dans la roadmap.
//
// La RECHERCHE est locale et immédiate : le glossaire tient en mémoire, et un
// aller-retour serveur pour filtrer trente lignes serait absurde. C'est
// l'inverse du choix fait pour la bibliothèque, où l'on cherche dans un fonds
// qu'on ne charge jamais en entier.
// ============================================================

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { usePermissions } from "@/components/auth/auth-context";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, fieldClasses } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { SearchIcon, TrashIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import {
  createAcronym,
  deleteAcronym,
  updateAcronym,
  type AcronymResult,
} from "@/app/(app)/acronyms/actions";

export interface AcronymRow {
  id: string;
  code: string;
  meaning: string;
}

export function AcronymTable({ acronyms }: { acronyms: AcronymRow[] }) {
  const t = useT();
  const { can } = usePermissions();
  const editable = can("document.upload");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === "") return acronyms;
    return acronyms.filter(
      (a) =>
        a.code.toLowerCase().includes(needle) || a.meaning.toLowerCase().includes(needle),
    );
  }, [acronyms, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex items-center sm:max-w-sm">
        <SearchIcon
          className="pointer-events-none absolute left-2.5 h-4 w-4 text-[var(--text-muted)]"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("acronyms.searchPlaceholder")}
          aria-label={t("acronyms.searchPlaceholder")}
          className={cn(fieldClasses(), "pl-8")}
        />
      </div>

      <Card className="overflow-hidden">
        <Table className="min-w-[560px]">
          <Thead>
            <Th className="w-[18%]">{t("acronyms.code")}</Th>
            <Th>{t("acronyms.meaning")}</Th>
            {editable && <Th align="right">{t("common.actions")}</Th>}
          </Thead>
          <tbody>
            {shown.length === 0 && (
              <EmptyRow colSpan={editable ? 3 : 2}>
                {query === "" ? t("common.empty") : t("acronyms.noMatch")}
              </EmptyRow>
            )}
            {shown.map((acronym) => (
              <AcronymLine key={acronym.id} acronym={acronym} editable={editable} />
            ))}
          </tbody>
        </Table>
        {editable && (
          <div className="border-t border-[var(--border)] px-3 py-2">
            <NewAcronym />
          </div>
        )}
      </Card>
    </div>
  );
}

function AcronymLine({ acronym, editable }: { acronym: AcronymRow; editable: boolean }) {
  const t = useT();
  const router = useRouter();
  const [code, setCode] = useState(acronym.code);
  const [meaning, setMeaning] = useState(acronym.meaning);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dirty = code !== acronym.code || meaning !== acronym.meaning;

  function run(fn: () => Promise<AcronymResult>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(t(`acronyms.error_${result.error}`));
      else router.refresh();
    });
  }

  if (!editable) {
    return (
      <Tr>
        <Td className="font-mono text-sm font-medium text-[var(--text)]">{acronym.code}</Td>
        <Td className="text-sm">{acronym.meaning}</Td>
      </Tr>
    );
  }

  return (
    <Tr>
      <Td>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={cn(fieldClasses({ focusStyle: "border" }), "py-1 font-mono text-sm")}
        />
      </Td>
      <Td>
        <input
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
          className={cn(fieldClasses({ focusStyle: "border" }), "py-1 text-sm")}
        />
      </Td>
      <Td align="right">
        <span className="flex items-center justify-end gap-2">
          {error && (
            <span className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
          {/* Le bouton n'apparaît QUE si quelque chose a changé : un
              « Enregistrer » permanent sur trente-trois lignes se lit comme
              trente-trois choses à faire. */}
          {dirty && (
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() => run(() => updateAcronym(acronym.id, code, meaning))}
            >
              {t("common.save")}
            </Button>
          )}
          <ConfirmAction
            message={t("acronyms.confirmDelete", { code: acronym.code })}
            disabled={pending}
            onConfirm={() => run(() => deleteAcronym(acronym.id))}
          >
            {(arm) => (
              <IconButton
                label={t("acronyms.delete")}
                disabled={pending}
                onClick={arm}
                className="h-7 w-7"
              >
                <TrashIcon className="h-4 w-4" />
              </IconButton>
            )}
          </ConfirmAction>
        </span>
      </Td>
    </Tr>
  );
}

function NewAcronym() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [meaning, setMeaning] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {t("acronyms.add")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createAcronym(code, meaning);
          if (!result.ok) {
            setError(t(`acronyms.error_${result.error}`));
            return;
          }
          setCode("");
          setMeaning("");
          setOpen(false);
          router.refresh();
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-32">
        <Field label={t("acronyms.code")} required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="min-w-[240px] flex-1">
        <Field
          label={t("acronyms.meaning")}
          required
          value={meaning}
          onChange={(e) => setMeaning(e.target.value)}
        />
      </div>
      <span className="flex items-center gap-2 pb-1">
        <Button size="sm" variant="primary" type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.add")}
        </Button>
        <Button size="sm" variant="secondary" type="button" onClick={() => setOpen(false)}>
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
