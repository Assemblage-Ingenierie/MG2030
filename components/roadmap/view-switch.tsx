import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { cn } from "@/lib/cn";
import { ListViewIcon, TimelineViewIcon } from "@/components/ui/icons";
import { buildRoadmapQuery, type RoadmapParams } from "@/lib/roadmap/url";

/**
 * Bascule liste / frise.
 *
 * ⚠ SORTIE DE LA BARRE DE FILTRES, et c'est le but. Elle y était alignée avec
 * les chips de priorité et de statut, dans la même boîte et le même gris : un
 * choix de VUE se lisait comme un filtre de plus, noyé parmi douze autres. Or
 * les deux ne font pas la même chose — un filtre retire des lignes, celui-ci
 * change tout l'écran.
 *
 * Il vit donc à côté du titre, avec des icônes : c'est le seul contrôle de la
 * page qui en porte, ce qui suffit à le distinguer sans l'encadrer.
 *
 * Le libellé reste écrit à côté de l'icône. Une icône seule demande d'être
 * apprise, et celle d'une frise n'est conventionnelle pour personne.
 */
export async function ViewSwitch({ params }: { params: RoadmapParams }) {
  const { t } = await getI18n();

  const item = (
    view: "list" | "timeline",
    Icon: typeof ListViewIcon,
    label: string,
  ) => {
    const active = params.view === view;
    return (
      <Link
        href={buildRoadmapQuery(params, { view })}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          active
            ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
            : "text-[var(--text-muted)] hover:text-[var(--text)]",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </Link>
    );
  };

  return (
    <div
      role="group"
      aria-label={t("roadmap.view")}
      className="inline-flex items-center gap-0.5 rounded-md bg-[var(--app-bg)] p-0.5"
    >
      {item("list", ListViewIcon, t("roadmap.viewList"))}
      {item("timeline", TimelineViewIcon, t("roadmap.viewTimeline"))}
    </div>
  );
}
