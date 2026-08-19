import { getI18n } from "@/lib/i18n/server";
import { listBuildings } from "@/lib/queries/referential";
import { formatAmount, formatNumber } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";
import { Pagination } from "@/components/ui/pagination";

/**
 * Liste des bâtiments.
 *
 * Paginée CÔTÉ SERVEUR (brief §4). 36 lignes aujourd'hui, mais c'est la liste
 * qui grossira le plus : chaque bâtiment nouveau du Student Center s'y ajoute.
 */
export default async function BuildingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; site?: string; intervention?: string }>;
}) {
  const { t, locale } = await getI18n();
  const params = await searchParams;

  const { rows, total, page, pageCount } = await listBuildings({
    page: Number(params.page ?? 1),
    siteCode: params.site,
    intervention: params.intervention,
  });

  // Somme des estimations de la page courante. On indique explicitement qu'il
  // s'agit de la page, pas du total projet : additionner ce qu'on voit est le
  // réflexe naturel, et il serait faux.
  const pageEstimate = rows.reduce((sum, b) => sum + (b.worksEstimate ?? 0), 0);
  const withoutArea = rows.filter((b) => b.netArea === null).length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Section title={t("buildings.title")} description={t("buildings.intro")}>
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("buildings.code")}</Th>
              <Th>{t("buildings.name")}</Th>
              <Th>{t("buildings.site")}</Th>
              <Th align="center">{t("buildings.zone")}</Th>
              <Th align="center">{t("buildings.intervention")}</Th>
              <Th align="right">{t("buildings.netArea")}</Th>
              <Th align="right">{t("buildings.grossArea")}</Th>
              <Th align="right">{t("buildings.estimate")}</Th>
              <Th align="right">{t("buildings.built")}</Th>
            </Thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={9}>{t("common.empty")}</EmptyRow>}
              {rows.map((b) => {
                // Écart net/brut marqué : les deux valeurs viennent des sources
                // et aucune n'a été arbitrée (Tetori : 1 987 contre 3 934 m²).
                const areaGap =
                  b.netArea !== null &&
                  b.grossArea !== null &&
                  Math.abs(b.grossArea - b.netArea) / Math.max(b.netArea, 1) > 0.15;

                return (
                  <Tr key={b.id}>
                    <Td className="font-medium whitespace-nowrap">{b.buildingCode}</Td>
                    <Td>{b.name}</Td>
                    <Td className="whitespace-nowrap text-xs text-[var(--text-muted)]">
                      {b.siteCode}
                    </Td>
                    <Td align="center">
                      {b.zone ? (
                        <Chip>{t(`buildings.${b.zone}`)}</Chip>
                      ) : (
                        <span
                          className="text-[var(--text-muted)]"
                          title={t("buildings.zoneNote")}
                        >
                          —
                        </span>
                      )}
                    </Td>
                    <Td align="center">
                      <Chip>{t(`buildings.${b.interventionType}`)}</Chip>
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {b.netArea === null ? "—" : formatNumber(b.netArea, locale)}
                    </Td>
                    <Td
                      align="right"
                      className="tabular-nums"
                      style={areaGap ? { color: "var(--accent-2)" } : undefined}
                      title={areaGap ? t("buildings.areaNote") : undefined}
                    >
                      {b.grossArea === null ? "—" : formatNumber(b.grossArea, locale)}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {b.worksEstimate === null
                        ? "—"
                        : formatAmount(b.worksEstimate, locale, {
                            compact: true,
                            withSuffix: false,
                          })}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      {b.yearOfConstruction ?? "—"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2">
            <span className="text-xs text-[var(--text-muted)]">
              {t("buildings.totalEstimate")} ({t("common.page")} {page}) :{" "}
              <span className="font-medium tabular-nums text-[var(--text)]">
                {formatAmount(pageEstimate, locale)}
              </span>
            </span>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              basePath="/buildings"
              params={params}
              labels={{
                page: t("common.page"),
                of: t("common.of"),
                previous: t("common.previous"),
                next: t("common.next"),
              }}
            />
          </div>
        </Card>

        {withoutArea > 0 && <SourceNote>{t("buildings.areaNote")}</SourceNote>}
      </Section>
    </div>
  );
}
