"use client";

// ============================================================
// access-requests.tsx — traitement des demandes d'accès.
//
// Approuver crée le membre INACTIF et sans périmètre : il faut encore
// l'activer et lui régler rôle et périmètre. C'est délibéré — un compte
// approuvé n'est pas un compte configuré, et laisser entrer quelqu'un avant
// d'avoir décidé de son périmètre lui donnerait, le temps d'un réglage, le
// périmètre par défaut.
// ============================================================

import { useState, useTransition } from "react";
import { useT } from "@/components/i18n/i18n-context";
import { Button } from "@/components/ui/button";
import { Label, fieldClasses } from "@/components/ui/field";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/i18n/format";
import { approveAccessRequest, rejectAccessRequest } from "@/app/actions/access-request";

export interface PendingRequest {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  message: string | null;
  createdAt: string;
}

export interface OrgChoice {
  id: string;
  code: string;
  name: string;
}

export interface RoleChoice {
  id: string;
  code: string;
  title: string;
  organisationCode: string;
}

export function AccessRequestList({
  requests,
  organisations,
  roles,
}: {
  requests: PendingRequest[];
  organisations: OrgChoice[];
  roles: RoleChoice[];
}) {
  const t = useT();

  if (requests.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-[var(--text-muted)]">
        {t("users.noPendingRequests")}
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {requests.map((request) => (
        <RequestRow
          key={request.id}
          request={request}
          organisations={organisations}
          roles={roles}
        />
      ))}
    </div>
  );
}

function RequestRow({
  request,
  organisations,
  roles,
}: {
  request: PendingRequest;
  organisations: OrgChoice[];
  roles: RoleChoice[];
}) {
  const t = useT();
  const [orgId, setOrgId] = useState(organisations[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const org = organisations.find((o) => o.id === orgId) ?? null;
  // Un rôle appartient à une organisation : proposer ceux des autres offrirait
  // des permissions conçues pour un autre corps de métier.
  const eligible = roles.filter((r) => r.organisationCode === org?.code);
  const [roleId, setRoleId] = useState("");
  const effectiveRole = eligible.some((r) => r.id === roleId) ? roleId : eligible[0]?.id ?? "";

  function approve() {
    setError(null);
    start(async () => {
      const result = await approveAccessRequest(request.id, orgId, effectiveRole);
      if (!result.ok) setError(t(`users.error_${result.error}`));
    });
  }

  function reject() {
    setError(null);
    start(async () => {
      const result = await rejectAccessRequest(request.id);
      if (!result.ok) setError(t(`users.error_${result.error}`));
    });
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium text-[var(--text)]">{request.fullName}</span>
        <span className="text-sm text-[var(--text-muted)]">{request.email}</span>
        {request.jobTitle && (
          <span className="text-xs text-[var(--text-muted)]">{request.jobTitle}</span>
        )}
        <span className="ml-auto text-xs text-[var(--text-muted)]">
          {formatDateTime(request.createdAt)}
        </span>
      </div>

      {request.message && (
        <p className="text-sm text-[var(--text-muted)]">{request.message}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Label>{t("users.organisation")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              setRoleId("");
            }}
          >
            {organisations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.code} — {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[220px]">
          <Label>{t("users.role")}</Label>
          <select
            className={fieldClasses() + " mt-1"}
            value={effectiveRole}
            onChange={(e) => setRoleId(e.target.value)}
          >
            {eligible.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.title}
              </option>
            ))}
          </select>
        </div>

        <span className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={pending || effectiveRole === ""}
            title={t("users.approveHint")}
            onClick={approve}
          >
            {t("users.approve")}
          </Button>
          <Button variant="secondary" size="sm" disabled={pending} onClick={reject}>
            {t("users.reject")}
          </Button>
        </span>
      </div>

      <p className="text-xs text-[var(--text-muted)]">{t("users.approveNote")}</p>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </Card>
  );
}
