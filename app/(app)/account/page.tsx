import { getI18n } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/server";
import { Card, Section } from "@/components/ui/card";
import { Badge, Chip } from "@/components/ui/badge";
import { ProfileForm } from "@/components/account/profile-form";

/**
 * Sa propre fiche.
 *
 * Elle n'existait pas : un nom mal orthographié à l'inscription — ou saisi tout
 * en minuscules — ne pouvait se corriger que par SQL, donc en demandant à
 * quelqu'un. Demandé le 01/10/2026.
 *
 * ⚠ CE QU'ON NE RÈGLE PAS SOI-MÊME EST MONTRÉ À PART, en lecture. Organisation,
 * rôle, périmètre et niveau d'accès sont des décisions d'administration ; les
 * afficher comme des champs grisés ferait croire à un droit qu'on aurait perdu
 * plutôt qu'à une décision qui ne nous appartient pas. Les voir reste utile :
 * c'est ce qu'on cite en demandant un changement.
 */
export default async function AccountPage() {
  const { t } = await getI18n();
  const me = await requireUser();

  // Le découpage prénom / nom date de la migration 0036. Les comptes ouverts
  // avant portent encore un `full_name` d'un seul tenant : on le recoupe pour
  // l'affichage, à la première espace, comme la migration l'a fait.
  const space = me.fullName.indexOf(" ");
  const firstName = space === -1 ? me.fullName : me.fullName.slice(0, space);
  const lastName = space === -1 ? "" : me.fullName.slice(space + 1);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Section title={t("account.title")} description={t("account.intro")}>
        <ProfileForm
          firstName={firstName}
          lastName={lastName}
          jobTitle={me.jobTitle ?? ""}
          email={me.email}
        />
      </Section>

      <Section title={t("account.managedTitle")} description={t("account.managedIntro")}>
        <Card className="flex flex-col gap-2 p-4 text-sm">
          <Row label={t("users.organisation")}>
            <Chip>{me.organisation.code}</Chip>
            <span className="text-[var(--text-muted)]">{me.organisation.name}</span>
          </Row>
          <Row label={t("users.accessLevel")}>
            <Badge
              tone={
                me.accessLevel === "administrator"
                  ? "running"
                  : me.accessLevel === "editor"
                    ? "done"
                    : "upcoming"
              }
            >
              {t(`users.level_${me.accessLevel}`)}
            </Badge>
          </Row>
          <Row label={t("users.role")}>
            <span className="text-[var(--text)]">{me.role.title}</span>
          </Row>
          <Row label={t("users.scope")}>
            {me.scopes.length === 0 ? (
              <span className="text-[var(--text-muted)]">{t("users.noScope")}</span>
            ) : (
              me.scopes.map((s, i) => (
                <Chip key={i}>
                  {s.kind === "global"
                    ? t("users.globalScope")
                    : (s.siteId ?? s.lotId ?? s.subproject ?? s.kind)}
                </Chip>
              ))
            )}
          </Row>
        </Card>
      </Section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="w-40 shrink-0 text-xs uppercase tracking-wide text-[var(--text-muted)]">
        {label}
      </span>
      {children}
    </span>
  );
}
