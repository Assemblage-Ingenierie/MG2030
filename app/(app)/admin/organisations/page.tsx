import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, EmptyRow } from "@/components/ui/table";
import { AlertIcon } from "@/components/ui/icons";
import {
  FunctionalRoleRow,
  NewFunctionalRole,
  NewOrganisation,
  OrganisationRow,
  type OrgRow,
  type RoleRow,
} from "@/components/admin/org-admin";

/**
 * Organisations et postes.
 *
 * Les deux tables venaient du seed et n'avaient aucun écran : ajouter une
 * organisation ou corriger l'intitulé d'un poste demandait du SQL — donc, en
 * pratique, d'attendre quelqu'un. Demandé le 01/10/2026.
 *
 * ⚠ CE QUE CES DEUX TABLES NE FONT PLUS. Depuis la migration 0037, ni le mode
 * d'accès de l'organisation ni le rôle fonctionnel n'accordent le moindre
 * droit : tout vient de `mg2030_app_user.access_level`. L'organisation sert
 * encore à colorer les barres du plan de charge et à nommer les assignataires ;
 * le rôle décrit un POSTE, pour l'organigramme et l'annuaire. L'écran le dit,
 * sans quoi on croirait régler des droits ici.
 */
export default async function OrganisationsAdminPage() {
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

  const supabase = await createClient();

  // Les comptes sont comptés ICI plutôt que par table : c'est ce qui dit si
  // une organisation ou un poste se supprime, et l'écran grise le bouton en
  // conséquence au lieu de laisser la contrainte parler à sa place.
  const [{ data: orgs }, { data: roles }, { data: users }] = await Promise.all([
    supabase.from("mg2030_organisation").select("id, code, name, access_mode").order("code"),
    supabase
      .from("mg2030_functional_role")
      .select("id, code, title, posts, organisation_id, mg2030_organisation ( code )")
      .order("code"),
    supabase.from("mg2030_app_user").select("organisation_id, functional_role_id"),
  ]);

  const usersByOrg = new Map<string, number>();
  const usersByRole = new Map<string, number>();
  for (const u of users ?? []) {
    const o = u.organisation_id as string;
    const r = u.functional_role_id as string;
    usersByOrg.set(o, (usersByOrg.get(o) ?? 0) + 1);
    usersByRole.set(r, (usersByRole.get(r) ?? 0) + 1);
  }

  const rolesByOrg = new Map<string, number>();
  for (const r of roles ?? []) {
    const o = r.organisation_id as string;
    rolesByOrg.set(o, (rolesByOrg.get(o) ?? 0) + 1);
  }

  const organisations: OrgRow[] = (orgs ?? []).map((o) => ({
    id: o.id as string,
    code: o.code as string,
    name: o.name as string,
    accessMode: o.access_mode as string,
    userCount: usersByOrg.get(o.id as string) ?? 0,
    roleCount: rolesByOrg.get(o.id as string) ?? 0,
  }));

  const roleRows: RoleRow[] = (roles ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      code: string;
      title: string;
      posts: number;
      organisation_id: string;
      mg2030_organisation: { code: string } | null;
    };
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      organisationId: row.organisation_id,
      organisationCode: row.mg2030_organisation?.code ?? "",
      posts: row.posts,
      userCount: usersByRole.get(row.id) ?? 0,
    };
  });

  const choices = organisations.map((o) => ({ id: o.id, code: o.code, name: o.name }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Section title={t("orgs.title")} description={t("orgs.intro")}>
        <Card className="flex items-start gap-3 p-4" style={{ borderColor: "var(--accent-2)" }}>
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--accent-2)" }}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-muted)]">{t("orgs.warning")}</p>
        </Card>

        <Card className="overflow-hidden">
          {/* Largeur minimale : sinon les champs de saisie se replient à trois
              caractères sur un écran de portable, et on édite à l'aveugle. */}
          <Table className="min-w-[700px]">
            <Thead>
              <Th>{t("orgs.code")}</Th>
              <Th>{t("orgs.name")}</Th>
              <Th>{t("orgs.accessMode")}</Th>
              <Th align="right">{t("orgs.used")}</Th>
              <Th align="right">{t("common.actions")}</Th>
            </Thead>
            <tbody>
              {organisations.length === 0 && <EmptyRow colSpan={5}>{t("common.empty")}</EmptyRow>}
              {organisations.map((org) => (
                <OrganisationRow key={org.id} org={org} />
              ))}
            </tbody>
          </Table>
          <div className="border-t border-[var(--border)] px-3 py-2">
            <NewOrganisation />
          </div>
        </Card>
      </Section>

      <Section title={t("orgs.rolesTitle")} description={t("orgs.rolesIntro")}>
        <Card className="overflow-hidden">
          <Table className="min-w-[720px]">
            <Thead>
              <Th>{t("orgs.code")}</Th>
              <Th>{t("orgs.title_")}</Th>
              <Th>{t("users.organisation")}</Th>
              <Th align="right">{t("orgs.posts")}</Th>
              <Th align="right">{t("orgs.accounts")}</Th>
              <Th align="right">{t("common.actions")}</Th>
            </Thead>
            <tbody>
              {roleRows.length === 0 && <EmptyRow colSpan={6}>{t("common.empty")}</EmptyRow>}
              {roleRows.map((role) => (
                <FunctionalRoleRow key={role.id} role={role} organisations={choices} />
              ))}
            </tbody>
          </Table>
          <div className="border-t border-[var(--border)] px-3 py-2">
            <NewFunctionalRole organisations={choices} />
          </div>
        </Card>
      </Section>
    </div>
  );
}
