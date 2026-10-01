"use client";

// ============================================================
// user-access-editor.tsx — ce qu'un compte a le droit de faire.
//
// Trois réglages, qui répondent à trois questions distinctes :
//   • le NIVEAU D'ACCÈS dit QUOI — lire, écrire, administrer. Depuis la
//     migration 0037 c'est la seule autorité sur le droit d'écrire ;
//   • le PÉRIMÈTRE dit SUR QUOI — tout le projet, un sous-projet, un site ;
//   • le RÔLE FONCTIONNEL dit QUEL POSTE, pour l'organigramme et l'annuaire.
//     Il n'accorde plus rien.
//
// Aucun ne se réglait autrement que par SQL ; avec une trentaine de comptes à
// ouvrir, cela voulait dire une trentaine de requêtes écrites à la main.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Modal } from "@/components/ui/modal";
import { Label, fieldClasses } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ACCESS_LEVELS, type AccessLevel } from "@/lib/auth/types";
import { setUserAccessLevel, setUserRole, setUserScope } from "./actions";

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
  currentAccessLevel,
  currentRoleId,
  currentScopeKind,
  roles,
  sites,
  lots,
  isSelf,
}: {
  userId: string;
  userName: string;
  organisationCode: string;
  currentAccessLevel: AccessLevel;
  currentRoleId: string;
  currentScopeKind: ScopeKind | null;
  roles: RoleChoice[];
  sites: ScopeTarget[];
  lots: ScopeTarget[];
  /** Sa propre fiche : on ne se retire pas l'administration par mégarde. */
  isSelf: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<AccessLevel>(currentAccessLevel);
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
        if (level !== currentAccessLevel) await setUserAccessLevel(userId, level);
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
          {/* Le niveau EN PREMIER : c'est la question qu'on vient régler. Le
              rôle et le périmètre viennent ensuite, et ne gouvernent rien de
              l'écriture. */}
          <div>
            <Label>{t("users.accessLevel")}</Label>
            <select
              className={fieldClasses() + " mt-1"}
              value={level}
              onChange={(e) => setLevel(e.target.value as AccessLevel)}
              disabled={isSelf}
            >
              {ACCESS_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {t(`users.level_${l}`)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t(`users.level_${level}_desc`)}
            </p>
            {isSelf && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {t("users.cannotDemoteSelf")}
              </p>
            )}
          </div>

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
