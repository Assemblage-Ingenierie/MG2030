import { getI18n } from "@/lib/i18n/server";
import { listSites } from "@/lib/queries/referential";
import { Card, Section } from "@/components/ui/card";
import { SourceNote } from "@/components/referential/source-note";
import { SiteMap, type MapSite } from "@/components/map/site-map";

/**
 * Carte des sites.
 *
 * Hors périmètre annoncé de la version 1 (brief §9 : « carte » listée parmi
 * les modules de phase 2), mais implémentée à la demande explicite du
 * 25/08/2026, une fois les 14 sites géolocalisés depuis la cartographie
 * fournie (GAPS 71). Voir docs/GAPS.md pour la décision et son détail.
 */
export default async function MapPage() {
  const { t } = await getI18n();
  const sites = await listSites();

  const located: MapSite[] = sites
    .filter((s): s is typeof s & { latitude: number; longitude: number } =>
      s.latitude !== null && s.longitude !== null,
    )
    .map((s) => ({
      id: s.id,
      siteCode: s.siteCode,
      name: s.name,
      subproject: s.subproject,
      latitude: s.latitude,
      longitude: s.longitude,
      buildingCount: s.buildingCount,
    }));

  const missing = sites.length - located.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Section title={t("map.title")} description={t("map.intro")}>
        {located.length === 0 ? (
          <Card className="p-8 text-center text-sm text-[var(--text-muted)]">
            {t("map.noCoordinates")}
          </Card>
        ) : (
          <SiteMap
            sites={located}
            labels={{
              athletesVillage: t("schedule.sub_athletes_village"),
              trainingVenues: t("schedule.sub_training_venues"),
              buildings: t("map.buildingsUnit"),
            }}
          />
        )}

        {missing > 0 && (
          <SourceNote>{t("map.missingCoordinates", { count: String(missing) })}</SourceNote>
        )}
        <SourceNote>{t("map.sourceNote")}</SourceNote>
      </Section>
    </div>
  );
}
