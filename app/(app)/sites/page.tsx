import { getI18n } from "@/lib/i18n/server";
import { listSites } from "@/lib/queries/referential";
import { formatNumber } from "@/lib/i18n/format";
import { Card, Section } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Chip } from "@/components/ui/badge";
import { SourceNote } from "@/components/referential/source-note";

/**
 * Liste des sites.
 *
 * 14 lignes : la pagination serveur n'a pas lieu d'être (brief §4 la demande
 * au-delà de 100). Le filtre par sous-projet passe par l'URL, donc il est
 * partageable et survit à un rechargement.
 */
export default async function SitesPage({
  searchParams,
}: {
  searchParams: Promise<{ subproject?: string }>;
}) {
  const { t, locale } = await getI18n();
  const { subproject } = await searchParams;
  const sites = await listSites(subproject);

  const missingGeo = sites.filter((s) => !s.address && s.latitude === null).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Section
        title={t("sites.title")}
        description={t("sites.intro")}
        actions={<SubprojectFilter current={subproject} labels={{
          all: t("common.all"),
          athletes_village: t("sites.athletes_village"),
          training_venues: t("sites.training_venues"),
        }} />}
      >
        <Card className="overflow-hidden">
          <Table>
            <Thead>
              <Th>{t("sites.code")}</Th>
              <Th>{t("sites.name")}</Th>
              <Th>{t("sites.subproject")}</Th>
              <Th align="right">{t("sites.buildings")}</Th>
              <Th align="right">{t("sites.area")}</Th>
              <Th align="right">{t("sites.built")}</Th>
              <Th>{t("sites.address")}</Th>
            </Thead>
            <tbody>
              {sites.length === 0 && <EmptyRow colSpan={7}>{t("common.empty")}</EmptyRow>}
              {sites.map((s) => (
                <Tr key={s.id}>
                  <Td className="font-medium">{s.siteCode}</Td>
                  <Td>
                    <span className="block">{s.name}</span>
                    {s.beneficiary && (
                      <span className="block text-xs text-[var(--text-muted)]">
                        {s.beneficiary}
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Chip>{t(`sites.${s.subproject}`)}</Chip>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {s.buildingCount}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {s.grossArea === null ? "—" : `${formatNumber(s.grossArea, locale)} m²`}
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {s.yearOfConstruction ?? "—"}
                  </Td>
                  {/* Une donnée absente s'affiche comme absente, jamais comme
                      une chaîne vide qui se lirait comme « rien à dire ». */}
                  <Td className="text-[var(--text-muted)]">{s.address ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {missingGeo > 0 && <SourceNote>{t("sites.missingGeo")}</SourceNote>}
      </Section>
    </div>
  );
}

function SubprojectFilter({
  current,
  labels,
}: {
  current: string | undefined;
  labels: { all: string; athletes_village: string; training_venues: string };
}) {
  const options = [
    { value: undefined, label: labels.all },
    { value: "athletes_village", label: labels.athletes_village },
    { value: "training_venues", label: labels.training_venues },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5">
      {options.map((o) => {
        const active = current === o.value;
        return (
          <a
            key={o.label}
            href={o.value ? `/sites?subproject=${o.value}` : "/sites"}
            className={
              active
                ? "rounded bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--text)] shadow-sm"
                : "rounded px-3 py-1 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
            }
          >
            {o.label}
          </a>
        );
      })}
    </div>
  );
}
