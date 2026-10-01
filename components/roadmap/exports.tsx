// ============================================================
// components/roadmap/exports.tsx — sortir la roadmap du navigateur.
//
// Deux destinations, et elles ne servent pas à la même chose :
//
//   • PDF — la revue hebdomadaire et l'annexe du rapport mensuel. On le lit,
//     on ne le retouche pas. Passe par une page mise en pages pour le papier,
//     puis par la boîte d'impression du navigateur, qui sait déjà écrire un
//     PDF — même parti pris que le plan de charge.
//   • EXCEL — ce que l'AFD ou le MSY veulent trier, filtrer, recopier. Un
//     vrai `.xlsx`, construit par `lib/export/xlsx.ts`.
//
// ⚠ LES DEUX EMPORTENT LES FILTRES EN COURS. Un export qui rendrait tout
// pendant que l'écran montre un sous-ensemble ferait partir un tableau que
// personne n'a relu.
// ============================================================

"use client";

import Link from "next/link";
import { useT } from "@/components/i18n/i18n-context";
import { DownloadIcon, PrinterIcon } from "@/components/ui/icons";
import { roadmapQueryString, type RoadmapParams } from "@/lib/roadmap/url";

export function RoadmapExports({ params }: { params: RoadmapParams }) {
  const t = useT();
  const query = roadmapQueryString(params);
  const suffix = query === "" ? "" : `?${query}`;

  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href={`/roadmap/print${suffix}`}
        target="_blank"
        rel="noopener"
        title={t("roadmap.exportPdfHint")}
        className={LINK}
      >
        <PrinterIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {t("roadmap.exportPdf")}
      </Link>
      {/* Un lien et non un bouton : le téléchargement est une navigation, et
          un lien se rouvre dans un autre onglet, se copie, s'envoie. */}
      <a href={`/roadmap/export${suffix}`} title={t("roadmap.exportExcelHint")} className={LINK}>
        <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {t("roadmap.exportExcel")}
      </a>
    </span>
  );
}

const LINK =
  "inline-flex items-center gap-1.5 rounded border border-[var(--border)] " +
  "bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] " +
  "hover:bg-[var(--app-bg)]";
