import { Fragment } from "react";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { listHiddenNav } from "@/lib/queries/nav";
import { NAV, isHideable } from "@/lib/nav";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { AlertIcon, NavIcon } from "@/components/ui/icons";
import { TabToggle } from "./tab-toggle";

/**
 * Visibilité des onglets.
 *
 * Plusieurs modules sont en cours de finition : ils existent dans le menu,
 * s'ouvrent, et montrent un écran à moitié fait. Les soustraire aux autres
 * comptes demandait jusqu'ici une mise en production — le code servait donc de
 * registre d'exploitation.
 *
 * ⚠ CET ÉCRAN NE PROTÈGE RIEN. Masquer un onglet retire une entrée de menu et
 * refuse l'écran à qui en connaîtrait l'adresse ; les données restent
 * exactement aussi lisibles qu'avant par l'API, puisque c'est la RLS qui en
 * décide et elle seule (brief §8). L'avertissement est affiché à l'écran pour
 * que personne ne s'y trompe en l'utilisant.
 */
export default async function NavigationAdminPage() {
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

  const hidden = await listHiddenNav();

  // Les écrans d'administration et le tableau de bord ne figurent pas : voir
  // `HIDEABLE_HREFS`. Un groupe qui n'en contient aucun autre disparaît.
  const groups = NAV.map((group) => ({
    labelKey: group.labelKey,
    items: group.items.filter((i) => isHideable(i.href)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Section title={t("tabs.title")} description={t("tabs.intro")}>
        <Card
          className="flex items-start gap-3 p-4"
          style={{ borderColor: "var(--accent-2)" }}
        >
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--accent-2)" }}
            aria-hidden="true"
          />
          <div className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            <p>{t("tabs.warning")}</p>
            <p>{t("tabs.adminKept")}</p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("tabs.tab")}</Th>
              <Th align="right">{t("tabs.state")}</Th>
            </Thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.labelKey ?? "root"}>
                  {group.labelKey && (
                    <tr>
                      <td
                        colSpan={2}
                        className="border-b border-t border-[var(--border)] bg-[var(--app-bg)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]"
                      >
                        {t(group.labelKey)}
                      </td>
                    </tr>
                  )}
                  {group.items.map((item) => (
                    <Tr key={item.href}>
                      <Td>
                        <span className="flex items-center gap-2.5">
                          <NavIcon
                            name={item.icon}
                            className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
                          />
                          <span className="font-medium text-[var(--text)]">
                            {t(item.labelKey)}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{item.href}</span>
                        </span>
                      </Td>
                      <Td align="right">
                        <TabToggle href={item.href} hidden={hidden.has(item.href)} />
                      </Td>
                    </Tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </Card>
      </Section>
    </div>
  );
}
