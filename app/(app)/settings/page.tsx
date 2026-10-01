import { Fragment } from "react";
import { getI18n } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/server";
import { isPlatformAdmin } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { listHiddenNav } from "@/lib/queries/nav";
import { listTagOptions } from "@/lib/queries/library";
import { NAV, isHideable } from "@/lib/nav";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { AlertIcon, NavIcon } from "@/components/ui/icons";
import { TabToggle } from "@/components/admin/tab-toggle";
import { GamesFrame } from "@/components/admin/games-frame";
import { TagColour, TagName, NewTag } from "@/components/library/tag-admin";

/**
 * PARAMÈTRES DE LA PLATEFORME.
 *
 * Trois réglages d'exploitation qui vivaient sur deux écrans séparés et, pour
 * le troisième, nulle part. Ils ont en commun de ne concerner personne d'autre
 * que l'administrateur, et de ne se toucher que quelques fois par an : leur
 * donner chacun une entrée de menu encombrait la navigation de tout le monde
 * pour des gestes rares. Demandé le 01/10/2026.
 *
 *   • LE CADRE DES JEUX — échéance et marge terminale. Nouveau : ces deux
 *     valeurs venaient du chargement initial et se corrigeaient en SQL, alors
 *     qu'une date de cérémonie peut bouger et que la marge est un arbitrage de
 *     pilotage, pas une donnée technique.
 *   • LES ONGLETS — ce que les autres comptes voient dans le menu.
 *   • LES ÉTIQUETTES — le vocabulaire documentaire.
 *
 * ⚠ CET ÉCRAN NE PROTÈGE RIEN. Le garde ci-dessous referme la page, mais c'est
 * la RLS qui décide (brief §8) : `mg2030_nav_visibility`, `mg2030_tag` et
 * `mg2030_schedule_scenario` refusent déjà l'écriture à qui n'est pas
 * administrateur. Le contrôle applicatif évite d'envoyer une requête vouée à
 * l'échec — et surtout de laisser croire à une écriture qui n'a pas eu lieu.
 */
export default async function SettingsPage() {
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
  const [{ data: scenarios }, hidden, tags] = await Promise.all([
    supabase
      .from("mg2030_schedule_scenario")
      .select("code, deadline_date, buffer_months")
      .order("code"),
    listHiddenNav(),
    listTagOptions(),
  ]);

  /* Le cadre est le MÊME sur tous les scénarios, et l'action l'y réécrit en
     bloc (voir `setGamesFrame`). On lit donc celui qui en porte un, sans
     chercher lequel : s'ils divergeaient, l'écran le corrigerait au premier
     enregistrement. */
  const frame =
    (scenarios ?? []).find((s) => s.deadline_date !== null) ?? (scenarios ?? [])[0] ?? null;

  // Les écrans d'administration et le tableau de bord ne figurent pas : voir
  // `HIDEABLE_HREFS`. Un groupe qui n'en contient aucun autre disparaît.
  const groups = NAV.map((group) => ({
    labelKey: group.labelKey,
    items: group.items.filter((i) => isHideable(i.href)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      {/* ── Le cadre des Jeux ──────────────────────────────────────────── */}
      <Section title={t("settings.frameTitle")} description={t("settings.frameIntro")}>
        <Card className="p-4">
          <GamesFrame
            deadline={(frame?.deadline_date as string | null) ?? null}
            bufferMonths={(frame?.buffer_months as number | null) ?? null}
          />
          <p className="mt-3 text-xs text-[var(--text-muted)]">{t("settings.frameNote")}</p>
        </Card>
      </Section>

      {/* ── Les onglets ────────────────────────────────────────────────── */}
      <Section title={t("tabs.title")} description={t("tabs.intro")}>
        <Card className="flex items-start gap-3 p-4" style={{ borderColor: "var(--accent-2)" }}>
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

      {/* ── Les étiquettes documentaires ───────────────────────────────── */}
      <Section title={t("tags.title")} description={t("tags.intro")}>
        <Card className="flex items-start gap-3 p-4" style={{ borderColor: "var(--accent-2)" }}>
          <AlertIcon
            className="mt-0.5 h-5 w-5 shrink-0"
            style={{ color: "var(--accent-2)" }}
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--text-muted)]">{t("tags.warning")}</p>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("tags.label")}</Th>
              <Th>{t("tags.code")}</Th>
              <Th align="right">{t("tags.colour")}</Th>
            </Thead>
            <tbody>
              {tags.length === 0 && <EmptyRow colSpan={3}>{t("common.empty")}</EmptyRow>}
              {tags.map((tag) => (
                <Tr key={tag.id}>
                  <Td>
                    <TagName tagId={tag.id} label={tag.label} />
                  </Td>
                  {/* Le CODE ne se change pas : il identifie l'étiquette dans
                      les autorisations et dans le tag par défaut des dossiers.
                      Le renommer ferait d'un rebaptême une migration. */}
                  <Td className="font-mono text-xs text-[var(--text-muted)]">{tag.code}</Td>
                  <Td align="right">
                    <TagColour tagId={tag.id} colour={tag.color} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="border-t border-[var(--border)] px-3 py-2">
            <NewTag />
          </div>
        </Card>
      </Section>
    </div>
  );
}
