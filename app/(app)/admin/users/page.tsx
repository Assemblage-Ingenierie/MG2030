import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import {
  listOrganisations,
  listPendingAccessRequests,
  listRoles,
  listUsers,
} from "@/lib/queries/users";
import { listLots, listSiteOptions } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge, Chip } from "@/components/ui/badge";
import { AlertIcon } from "@/components/ui/icons";
import { UserRowActions } from "./user-row-actions";
import { UserAccessEditor, type ScopeKind } from "./user-access-editor";
import { AccessRequestList } from "./access-requests";

/**
 * Administration des comptes.
 *
 * Cette page ne CRÉE aucun compte : la création d'identifiants relève de
 * l'administrateur humain, via Supabase Auth (voir docs/ADMIN.md).
 *
 * Elle règle en revanche les DEUX dimensions de droits qui ne dépendent pas de
 * l'authentification : le rôle fonctionnel et le périmètre (brief §8). Elles ne
 * se réglaient jusqu'ici que par SQL — donc, avec une trentaine de comptes à
 * ouvrir, une trentaine de requêtes écrites à la main.
 */
export default async function UsersPage() {
  const { t } = await getI18n();
  const me = await getCurrentUser();

  if (!isPlatformAdmin(me)) {
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <AlertIcon className="mx-auto h-7 w-7" style={{ color: "var(--danger)" }} />
        <p className="mt-3 text-sm text-[var(--text-muted)]">{t("errors.forbidden")}</p>
      </Card>
    );
  }

  const [users, roles, sites, lots, requests, organisations] = await Promise.all([
    listUsers(),
    listRoles(),
    listSiteOptions(),
    listLots(),
    listPendingAccessRequests(),
    listOrganisations(),
  ]);

  const roleChoices = roles.map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    organisationCode: r.organisation.code,
  }));
  const siteTargets = sites.map((s) => ({ id: s.id, code: s.siteCode, name: s.name }));
  const lotTargets = lots.map((l) => ({ id: l.id, code: l.lotCode, name: l.name }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Les demandes EN PREMIER : c'est ce qu'un administrateur vient traiter,
          et une demande non vue est quelqu'un qui attend. */}
      <Section
        title={t("users.requestsTitle")}
        description={t("users.requestsIntro")}
      >
        <AccessRequestList
          requests={requests}
          organisations={organisations}
          roles={roleChoices}
        />
      </Section>

      <Section title={t("users.title")} description={t("users.intro")}>
        {/* Le pool d'authentification est partagé : c'est la première chose
            qu'un administrateur doit comprendre en arrivant sur cet écran. */}
        <Card
          className="flex items-start gap-3 p-4"
          style={{ borderColor: "var(--accent-2)" }}
        >
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--accent-2)" }}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-muted)]">{t("users.sharedAuthWarning")}</p>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("users.name")}</Th>
              <Th>{t("users.organisation")}</Th>
              <Th>{t("users.role")}</Th>
              <Th>{t("users.scope")}</Th>
              <Th>{t("users.status")}</Th>
              <Th align="right">{t("common.edit")}</Th>
            </Thead>
            <tbody>
              {users.length === 0 && <EmptyRow colSpan={6}>{t("common.empty")}</EmptyRow>}
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <span className="block font-medium text-[var(--text)]">{u.fullName}</span>
                    <span className="block text-xs text-[var(--text-muted)]">{u.email}</span>
                  </Td>
                  <Td>
                    <Chip>{u.organisation.code}</Chip>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">
                      {u.organisation.accessMode === "contributor"
                        ? t("users.contributor")
                        : t("users.readOnly")}
                    </span>
                  </Td>
                  <Td className="text-sm">{u.role.title}</Td>
                  <Td className="text-sm">
                    {u.scopes.length === 0 ? (
                      <span className="text-[var(--text-muted)]">{t("users.noScope")}</span>
                    ) : (
                      u.scopes.map((s, i) => (
                        <Chip key={i} className="mr-1">
                          {s.kind === "global"
                            ? t("users.globalScope")
                            : (s.siteCode ?? s.lotCode ?? s.subproject ?? s.kind)}
                        </Chip>
                      ))
                    )}
                  </Td>
                  <Td>
                    <Badge tone={u.isActive ? "done" : "upcoming"}>
                      {u.isActive ? t("users.active") : t("users.pending")}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <span className="flex items-center justify-end gap-1">
                      <UserAccessEditor
                        userId={u.id}
                        userName={u.fullName}
                        organisationCode={u.organisation.code}
                        currentRoleId={u.role.id}
                        currentScopeKind={(u.scopes[0]?.kind as ScopeKind) ?? null}
                        roles={roleChoices}
                        sites={siteTargets}
                        lots={lotTargets}
                      />
                      <UserRowActions
                        userId={u.id}
                        isActive={u.isActive}
                        isSelf={u.id === me!.id}
                      />
                    </span>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Section>

      {/* La matrice rôle × permission est une DONNÉE : la lire ici évite de
          devoir ouvrir la base pour comprendre qui peut quoi. */}
      <Section title={t("users.permissions")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("users.role")}</Th>
              <Th align="center">{t("users.organisation")}</Th>
              <Th>{t("users.permissions")}</Th>
            </Thead>
            <tbody>
              {roles.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <span className="font-medium text-[var(--text)]">{r.code}</span>
                    <span className="ml-2 text-xs text-[var(--text-muted)]">{r.title}</span>
                    {r.posts > 1 && <Chip className="ml-2">{`x${r.posts}`}</Chip>}
                  </Td>
                  <Td align="center">
                    <Chip>{r.organisation.code}</Chip>
                  </Td>
                  <Td>
                    {r.permissions.length === 0 ? (
                      <span className="text-xs text-[var(--text-muted)]">
                        {r.organisation.accessMode === "read_only"
                          ? t("users.readOnly")
                          : t("common.empty")}
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {r.permissions.map((p) => (
                          <Chip key={p}>{p}</Chip>
                        ))}
                      </span>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
