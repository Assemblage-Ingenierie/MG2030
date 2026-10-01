"use client";

// ============================================================
// components/admin/org-admin.tsx — organisations et postes, modifiables.
//
// Deux tables très liées : un poste appartient à une organisation, et la liste
// des postes proposés à l'approbation d'un compte en découle. Elles tiennent
// donc sur un seul écran — les séparer obligerait à faire l'aller-retour pour
// créer l'organisation puis ses postes.
//
// On MODIFIE EN PLACE plutôt que par une fenêtre : il n'y a que deux ou trois
// champs, et l'écran sert surtout à corriger un intitulé.
// ============================================================

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n/i18n-context";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmAction } from "@/components/ui/confirm-action";
import { Field, Label, fieldClasses } from "@/components/ui/field";
import { Chip } from "@/components/ui/badge";
import { TrashIcon } from "@/components/ui/icons";
import { Tr, Td } from "@/components/ui/table";
import {
  createFunctionalRole,
  createOrganisation,
  deleteFunctionalRole,
  deleteOrganisation,
  updateFunctionalRole,
  updateOrganisation,
  type OrgResult,
} from "@/app/(app)/admin/organisations/actions";

export interface OrgRow {
  id: string;
  code: string;
  name: string;
  accessMode: string;
  userCount: number;
  roleCount: number;
}

export interface RoleRow {
  id: string;
  code: string;
  title: string;
  organisationId: string;
  organisationCode: string;
  posts: number;
  userCount: number;
}

/** Tout l'écran partage la même mécanique d'écriture et de refus. */
function useWrite() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<OrgResult>, onDone?: () => void) => {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(t(`orgs.error_${result.error}`));
        return;
      }
      onDone?.();
      router.refresh();
    });
  };

  return { error, pending, run };
}

// ── Organisations ───────────────────────────────────────────────────────────

export function OrganisationRow({ org }: { org: OrgRow }) {
  const t = useT();
  const { error, pending, run } = useWrite();
  const [name, setName] = useState(org.name);
  const [accessMode, setAccessMode] = useState(org.accessMode);

  const dirty = name !== org.name || accessMode !== org.accessMode;
  const used = org.userCount + org.roleCount;

  return (
    <Tr>
      <Td>
        {/* Le CODE est en lecture : il colore les barres du plan de charge,
            nomme les assignataires de la roadmap et figure dans le formulaire
            d'inscription. Le changer ferait d'un rebaptême une migration. */}
        <Chip>{org.code}</Chip>
      </Td>
      <Td>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClasses({ focusStyle: "border" }) + " py-1 text-sm"}
        />
      </Td>
      <Td>
        <select
          value={accessMode}
          onChange={(e) => setAccessMode(e.target.value)}
          className={fieldClasses({ focusStyle: "border" }) + " py-1 text-xs"}
        >
          <option value="contributor">{t("users.contributor")}</option>
          <option value="read_only">{t("users.readOnly")}</option>
        </select>
      </Td>
      <Td align="right" className="whitespace-nowrap text-xs tabular-nums text-[var(--text-muted)]">
        {t("orgs.counts", { users: String(org.userCount), roles: String(org.roleCount) })}
      </Td>
      <Td align="right">
        <span className="flex items-center justify-end gap-2">
          {error && (
            <span className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
          {dirty && (
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() => run(() => updateOrganisation(org.id, name, accessMode))}
            >
              {t("common.save")}
            </Button>
          )}
          <ConfirmAction
            message={t("orgs.confirmDeleteOrg", { name: org.name })}
            disabled={pending || used > 0}
            onConfirm={() => run(() => deleteOrganisation(org.id))}
          >
            {(arm) => (
              <IconButton
                label={used > 0 ? t("orgs.error_inUse") : t("orgs.deleteOrg")}
                disabled={pending || used > 0}
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

export function NewOrganisation() {
  const t = useT();
  const { error, pending, run } = useWrite();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [accessMode, setAccessMode] = useState("contributor");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {t("orgs.addOrg")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => createOrganisation(code, name, accessMode), () => {
          setCode("");
          setName("");
          setOpen(false);
        });
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-28">
        <Field label={t("orgs.code")} required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="min-w-[220px] flex-1">
        <Field label={t("orgs.name")} required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-org-mode">{t("orgs.accessMode")}</Label>
        <select
          id="new-org-mode"
          value={accessMode}
          onChange={(e) => setAccessMode(e.target.value)}
          className={fieldClasses() + " mt-1"}
        >
          <option value="contributor">{t("users.contributor")}</option>
          <option value="read_only">{t("users.readOnly")}</option>
        </select>
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

// ── Rôles fonctionnels ──────────────────────────────────────────────────────

export function FunctionalRoleRow({
  role,
  organisations,
}: {
  role: RoleRow;
  organisations: { id: string; code: string; name: string }[];
}) {
  const t = useT();
  const { error, pending, run } = useWrite();
  const [title, setTitle] = useState(role.title);
  const [organisationId, setOrganisationId] = useState(role.organisationId);
  const [posts, setPosts] = useState(String(role.posts));

  const dirty =
    title !== role.title ||
    organisationId !== role.organisationId ||
    posts !== String(role.posts);

  return (
    <Tr>
      <Td>
        <Chip>{role.code}</Chip>
      </Td>
      <Td>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClasses({ focusStyle: "border" }) + " py-1 text-sm"}
        />
      </Td>
      <Td>
        <select
          value={organisationId}
          onChange={(e) => setOrganisationId(e.target.value)}
          className={fieldClasses({ focusStyle: "border" }) + " py-1 text-xs"}
        >
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code}
            </option>
          ))}
        </select>
      </Td>
      <Td align="right">
        <input
          type="number"
          min={1}
          value={posts}
          onChange={(e) => setPosts(e.target.value)}
          className={fieldClasses({ focusStyle: "border" }) + " w-16 py-1 text-right text-xs"}
        />
      </Td>
      <Td align="right" className="whitespace-nowrap text-xs tabular-nums text-[var(--text-muted)]">
        {role.userCount}
      </Td>
      <Td align="right">
        <span className="flex items-center justify-end gap-2">
          {error && (
            <span className="text-xs" style={{ color: "var(--danger)" }}>
              {error}
            </span>
          )}
          {dirty && (
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() =>
                run(() =>
                  updateFunctionalRole(role.id, title, organisationId, Number(posts)),
                )
              }
            >
              {t("common.save")}
            </Button>
          )}
          <ConfirmAction
            message={t("orgs.confirmDeleteRole", { name: role.title })}
            disabled={pending || role.userCount > 0}
            onConfirm={() => run(() => deleteFunctionalRole(role.id))}
          >
            {(arm) => (
              <IconButton
                label={role.userCount > 0 ? t("orgs.error_inUse") : t("orgs.deleteRole")}
                disabled={pending || role.userCount > 0}
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

export function NewFunctionalRole({
  organisations,
}: {
  organisations: { id: string; code: string; name: string }[];
}) {
  const t = useT();
  const { error, pending, run } = useWrite();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [organisationId, setOrganisationId] = useState(organisations[0]?.id ?? "");
  const [posts, setPosts] = useState("1");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]"
      >
        {t("orgs.addRole")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createFunctionalRole(code, title, organisationId, Number(posts)),
          () => {
            setCode("");
            setTitle("");
            setPosts("1");
            setOpen(false);
          },
        );
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-28">
        <Field label={t("orgs.code")} required value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div className="min-w-[220px] flex-1">
        <Field label={t("orgs.title_")} required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="new-role-org">{t("users.organisation")}</Label>
        <select
          id="new-role-org"
          value={organisationId}
          onChange={(e) => setOrganisationId(e.target.value)}
          className={fieldClasses() + " mt-1"}
        >
          {organisations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.code} — {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-20">
        <Field
          label={t("orgs.posts")}
          type="number"
          min={1}
          value={posts}
          onChange={(e) => setPosts(e.target.value)}
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
