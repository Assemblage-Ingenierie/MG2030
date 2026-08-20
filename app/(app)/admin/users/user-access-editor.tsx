"use client";

// ============================================================
// user-access-editor.tsx — rôle fonctionnel et périmètre d'un compte.
//
// Les trois dimensions des droits (brief §8) :
//   1. l'ORGANISATION dit en lecture ou en contribution — elle est fixée à la
//      création du compte et ne se change pas ici ;
//   2. le RÔLE FONCTIONNEL dit quoi ;
//   3. le PÉRIMÈTRE dit sur quoi.
//
// Les deux dernières ne se réglaient que par SQL. Un écran d'administration
// qui affiche le rôle et le périmètre sans permettre de les changer
// n'administre rien — et avec une trentaine de comptes à ouvrir, cela voulait
// dire une trentaine de requêtes écrites à la main.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { setUserRole, setUserScope } from "./actions";

export type ScopeKind = "global" | "subproject" | "site" | "lot";

export interface RoleChoice {
  id: string;
  code: string;
  title: string;
  organisationCode: string;
}

export interface ScopeTarget {
  id: string;
  code: string;
  name: string;
}

const SUBPROJECTS = ["athletes_village", "training_venues"];

export function UserAccessEditor({
  userId,
  userName,
  organisationCode,
  currentRoleId,
  currentScopeKind,
  roles,
  sites,
  lots,
}: {
  userId: string;
  userName: string;
  organisationCode: string;
  currentRoleId: string;
  currentScopeKind: ScopeKind | null;
  roles: RoleChoice[];
  sites: ScopeTarget[];
  lots: ScopeTarget[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState(currentRoleId);
  const [kind, setKind] = useState<ScopeKind>(currentScopeKind ?? "global");
  const [target, setTarget] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Un rôle appartient à une organisation : proposer ceux des autres
  // reviendrait à offrir des permissions conçues pour un autre corps de métier.
  const eligible = roles.filter((r) => r.organisationCode === organisationCode);

  const targets = kind === "site" ? sites : kind === "lot" ? lots : [];
  const needsTarget = kind === "site" || kind === "lot" || kind === "subproject";

  function submit() {
    setError(null);
    if (needsTarget && target === "") {
      setError(t("users.error_targetRequired"));
      return;
    }
    start(async () => {
      try {
        if (roleId !== currentRoleId) await setUserRole(userId, roleId);
        await setUserScope(userId, kind, kind === "global" ? null : target);
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("users.error_writeFailed"));
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
        {t("users.editAccess")}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        closeLabel={t("common.close")}
        title={t("users.accessTitle", { name: userName })}
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label>{t("users.role")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {eligible.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.title}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("users.roleHint", { org: organisationCode })}
            </p>
          </div>

          <div>
            <Label>{t("users.scope")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as ScopeKind);
                setTarget("");
              }}
            >
              <option value="global">{t("users.globalScope")}</option>
              <option value="subproject">{t("users.subprojectScope")}</option>
              <option value="site">{t("users.siteScope")}</option>
              <option value="lot">{t("users.lotScope")}</option>
            </select>
          </div>

          {kind === "subproject" && (
            <div>
              <Label>{t("users.subprojectScope")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">{t("users.chooseTarget")}</option>
                {SUBPROJECTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`schedule.sub_${s}`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(kind === "site" || kind === "lot") && (
            <div>
              <Label>{kind === "site" ? t("users.siteScope") : t("users.lotScope")}</Label>
              <select
                className={fieldClasses() + " mt-1"}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">{t("users.chooseTarget")}</option>
                {targets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} — {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Le périmètre est REMPLACÉ, pas cumulé : on le dit avant, parce
              qu'un administrateur pourrait croire ajouter un site à une liste. */}
          <p className="text-xs text-[var(--text-muted)]">{t("users.scopeReplacedNote")}</p>

          {error && (
            <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" disabled={pending} onClick={submit}>
              {pending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
