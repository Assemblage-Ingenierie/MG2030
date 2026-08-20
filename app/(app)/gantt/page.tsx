import { redirect } from "next/navigation";

/**
 * `/gantt` n'existe plus comme écran distinct.
 *
 * La grille de saisie et le diagramme sont désormais LA MÊME page : le Gantt
 * est le prolongement des colonnes éditables, et non une seconde vue à tenir
 * synchronisée. On redirige plutôt que de supprimer la route — les liens et
 * les signets déjà partagés continuent de fonctionner.
 */
export default async function GanttPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const suffix = query.toString();
  redirect(suffix ? `/schedule?${suffix}` : "/schedule");
}
