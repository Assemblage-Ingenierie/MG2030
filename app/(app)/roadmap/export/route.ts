// ============================================================
// Export Excel de la roadmap.
//
// ⚠ UNE ROUTE, ET NON UNE ACTION DE SERVEUR. Un fichier se TÉLÉCHARGE : il lui
// faut un type MIME, un nom de fichier et un code 200, c'est-à-dire une
// réponse HTTP. Une action de serveur rend une valeur à React, pas un
// téléchargement, et le détour par une URL `blob:` fabriquée dans le navigateur
// aurait ajouté du code client pour un lien qui existe déjà.
//
// Les FILTRES de l'écran voyagent dans la requête : on exporte ce qu'on voit.
// Un bouton d'export qui rend tout alors que l'écran montre un sous-ensemble
// est un piège — on envoie à l'AFD un tableau qu'on n'a pas relu.
//
// La RLS s'applique comme partout : la route lit avec la session de l'appelant,
// jamais avec une clé de service.
// ============================================================

import { getI18n } from "@/lib/i18n/server";
import { listRoadmapActions, listRoadmapSubjects } from "@/lib/queries/roadmap";
import { applyFilters, groupBySubject, sortActions } from "@/lib/roadmap/filter";
import { parseRoadmapParams } from "@/lib/roadmap/url";
import { toExportRows } from "@/lib/roadmap/export-rows";
import { timelineLabel } from "@/lib/roadmap/timeline";
import { buildXlsx } from "@/lib/export/xlsx";
import { localToday } from "@/lib/schedule/dates";
import type { RoadmapActionRow } from "@/lib/roadmap/types";

export async function GET(request: Request) {
  const { t, locale } = await getI18n();

  const url = new URL(request.url);
  const params = parseRoadmapParams(Object.fromEntries(url.searchParams.entries()));

  const [subjects, actions] = await Promise.all([
    listRoadmapSubjects(),
    listRoadmapActions(params.archived),
  ]);

  const { actions: visible } = applyFilters(actions, params.filters);
  const groups = groupBySubject(sortActions(visible, params.sort), subjects);

  const rows = toExportRows(groups, {
    noSubject: t("roadmap.noSubject"),
    status: (value) => (value ? t(`roadmap.status_${value}`) : ""),
    priority: (value) => (value ? t(`roadmap.priority_${value}`) : ""),
    timeline: (row) => {
      const label = timelineLabel((row as RoadmapActionRow).timeline, locale);
      return t(`roadmap.timeline_${label.key}`, label.values);
    },
  });

  const file = buildXlsx({
    name: t("roadmap.printTitle"),
    // Largeurs choisies sur les données réelles : l'intitulé et le détail
    // portent des phrases, le reste des mots.
    columns: [
      { header: t("roadmap.subjectColumn"), width: 26 },
      { header: t("roadmap.action"), width: 52, wrap: true },
      { header: t("roadmap.detail"), width: 44, wrap: true },
      { header: t("roadmap.timeline"), width: 20 },
      { header: t("roadmap.status"), width: 14 },
      { header: t("roadmap.priority"), width: 12 },
      { header: t("roadmap.assignee"), width: 26, wrap: true },
    ],
    rows: rows.map((r) => [
      r.subject,
      r.action,
      r.detail,
      r.timeline,
      r.status,
      r.priority,
      r.assignees,
    ]),
  });

  // La DATE dans le nom du fichier : trois exports dans la même semaine
  // finissent sinon en « roadmap (2).xlsx », et personne ne sait lequel est
  // lequel une fois la pièce jointe partie.
  const name = `MG2030-roadmap-${localToday()}.xlsx`;

  return new Response(file as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      // Le contenu dépend des filtres ET du compte qui demande : aucun cache
      // partagé ne doit le resservir à quelqu'un d'autre.
      "Cache-Control": "private, no-store",
    },
  });
}
